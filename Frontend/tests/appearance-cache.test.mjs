import test from "node:test";
import assert from "node:assert/strict";
import {
  loadLoginSnapshot,
  clearLoginAppearance,
} from "../src/appearance-cache.js";
function store() {
  const rows = new Map();
  return {
    rows,
    get: async (key) => structuredClone(rows.get(key)),
    put: async (key, value) => rows.set(key, structuredClone(value)),
  };
}
const response = () => ({
  ok: true,
  blob: async () => new Blob(["image"], { type: "image/png" }),
});
test("same background in both languages downloads once and a page reload reads only persisted blobs", async () => {
  const storage = store();
  let metadata = 0,
    images = 0;
  const manifest = async () => {
    metadata++;
    return {
      de: { background_url: "/image" },
      en: { background_url: "/image" },
    };
  };
  const image = async () => {
    images++;
    return response();
  };
  const [a, b] = await Promise.all([
    loadLoginSnapshot("user:login", manifest, image, storage),
    loadLoginSnapshot("user:login", manifest, image, storage),
  ]);
  assert.equal(metadata, 1);
  assert.equal(images, 1);
  assert.equal(a.images["/image"].size, 5);
  assert.equal(b.warning, "");
  const reload = await import("../src/appearance-cache.js?reload");
  const cached = await reload.loadLoginSnapshot(
    "user:login",
    () => assert.fail("metadata fetched on reload"),
    () => assert.fail("image fetched on reload"),
    storage,
  );
  assert.equal(cached.images["/image"].size, 5);
  await reload.loadLoginSnapshot("user:next-login", manifest, image, storage);
  assert.equal(metadata, 2);
  assert.equal(images, 2);
});
test("different language themes and accounts retain independent snapshots", async () => {
  const storage = store(),
    urls = [];
  await loadLoginSnapshot(
    "first:login",
    async () => ({
      de: { background_url: "/de" },
      en: { background_url: "/en" },
    }),
    async (url) => {
      urls.push(url);
      return response();
    },
    storage,
  );
  await loadLoginSnapshot(
    "second:login",
    async () => ({ de: { background_url: "" }, en: { background_url: "" } }),
    () => assert.fail("no image"),
    storage,
  );
  assert.deepEqual(urls, ["/de", "/en"]);
  assert.equal(storage.rows.get("second:login").images["/de"], undefined);
});
test("interrupted download marker and failed downloads do not silently retry on reload", async () => {
  const storage = store();
  await storage.put("interrupted", {
    data: {},
    images: {},
    warning: "pending",
  });
  const cached = await loadLoginSnapshot(
    "interrupted",
    () => assert.fail(),
    () => assert.fail(),
    storage,
  );
  assert.equal(cached.warning, "pending");
  await loadLoginSnapshot(
    "failed",
    async () => ({ de: { background_url: "/bad" } }),
    async () => ({ ok: false }),
    storage,
  );
  const reload = await import("../src/appearance-cache.js?failure-reload");
  const failure = await reload.loadLoginSnapshot(
    "failed",
    () => assert.fail(),
    () => assert.fail(),
    storage,
  );
  assert.ok(failure.warning);
});
test("blocked browser storage prevents background downloads", async () => {
  const snapshot = await loadLoginSnapshot(
    "blocked",
    () => assert.fail(),
    () => assert.fail(),
    {
      get: async () => {
        throw new Error("blocked");
      },
    },
  );
  assert.ok(snapshot.warning);
});
test("logout prevents an in-flight response from writing private blobs back to storage", async () => {
  const storage = store();
  let release;
  const waiting = new Promise((resolve) => {
    release = resolve;
  });
  let fetching;
  const started = new Promise((resolve) => {
    fetching = resolve;
  });
  const pending = loadLoginSnapshot(
    "logout",
    async () => ({ de: { background_url: "/private" } }),
    async () => {
      fetching();
      await waiting;
      return response();
    },
    storage,
  );
  await started;
  await clearLoginAppearance();
  storage.rows.clear();
  release();
  await assert.rejects(pending, /session ended/);
  assert.equal(storage.rows.size, 0);
});
