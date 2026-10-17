import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  request,
  clearContentCache,
  primeContentCache,
} from "../src/lib/request.js";
const path = "/api/de/decks/1/";
const response = (data) => ({ ok: true, json: async () => data });
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
beforeEach(() => {
  clearContentCache();
  globalThis.document = { cookie: "" };
});
test("concurrent readers share one fetch and receive independent objects", async () => {
  const pending = deferred();
  let calls = 0;
  globalThis.fetch = () => {
    calls++;
    return pending.promise;
  };
  const a = request(path),
    b = request(path);
  pending.resolve(response({ cards: [{ id: 1 }] }));
  const [first, second] = await Promise.all([a, b]);
  first.cards[0].id = 99;
  assert.equal(second.cards[0].id, 1);
  assert.equal((await request(path)).cards[0].id, 1);
  assert.equal(calls, 1);
});
test("one consumer abort does not cancel another reader", async () => {
  const pending = deferred();
  let sharedSignal;
  globalThis.fetch = (_, options) => {
    sharedSignal = options.signal;
    return pending.promise;
  };
  const controller = new AbortController();
  const first = request(path, "GET", undefined, controller.signal),
    second = request(path);
  controller.abort();
  await assert.rejects(first, { name: "AbortError" });
  assert.equal(sharedSignal.aborted, false);
  pending.resolve(response({ id: 1 }));
  assert.equal((await second).id, 1);
});
test("last reader abort cancels transport and next reader starts fresh", async () => {
  let calls = 0,
    firstSignal;
  const pending = deferred();
  globalThis.fetch = (_, options) => {
    calls++;
    if (calls === 1) {
      firstSignal = options.signal;
      return pending.promise;
    }
    return Promise.resolve(response({ id: 2 }));
  };
  const controller = new AbortController();
  const first = request(path, "GET", undefined, controller.signal);
  controller.abort();
  await assert.rejects(first, { name: "AbortError" });
  assert.equal(firstSignal.aborted, true);
  assert.equal((await request(path)).id, 2);
  pending.resolve(response({ id: 1 }));
  assert.equal(calls, 2);
});
test("response from before a mutation cannot poison the refreshed cache", async () => {
  const pending = deferred();
  let reads = 0;
  globalThis.fetch = (_, options) =>
    options.method === "GET"
      ? ++reads === 1
        ? pending.promise
        : Promise.resolve(response({ version: 2 }))
      : Promise.resolve(response({ ok: true }));
  const old = request(path);
  await request(path, "PATCH", { title: "new" });
  assert.equal((await request(path)).version, 2);
  pending.resolve(response({ version: 1 }));
  await old;
  assert.equal((await request(path)).version, 2);
  assert.equal(reads, 2);
});
test("clearing account cache prevents pending responses from repopulating it", async () => {
  const pending = deferred();
  globalThis.fetch = () => pending.promise;
  const old = request(path);
  clearContentCache();
  pending.resolve(response({ owner: "old" }));
  await old;
  globalThis.fetch = async () => response({ owner: "new" });
  assert.equal((await request(path)).owner, "new");
});
test("learning sync invalidates deck lists and study packs as well as details", async () => {
  const paths = [path, "/api/de/decks/", "/api/de/study-pack/?filter=due"];
  paths.forEach((p) => primeContentCache(p, { stale: true }));
  globalThis.fetch = async () => response({ fresh: true });
  await request("/api/de/learning/sync/", "POST", { events: [] });
  for (const p of paths) assert.equal((await request(p)).fresh, true);
});

test("new session response is reused without another request", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return response({ token: "session-1", cards: [] });
  };
  await request("/api/de/sessions/", "POST", {});
  assert.equal(
    (await request("/api/de/sessions/session-1/")).token,
    "session-1",
  );
  assert.equal(calls, 1);
});
