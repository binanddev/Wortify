import test from "node:test";
import assert from "node:assert/strict";
import { createLearningQueueStore } from "../src/features/learning/learning-queue-store.js";
const key = "wortify:sync:9:en";
function fixture() {
  const rows = new Map(),
    snapshots = new Map();
  let blocked = false;
  const storage = () => ({
    getItem: (k) => rows.get(k) ?? null,
    setItem(k, value) {
      if (blocked) throw Error("Quota");
      rows.set(k, value);
    },
  });
  const backup = {
    get: async (k) => structuredClone(snapshots.get(k)),
    put: async (k, value) => {
      snapshots.set(k, structuredClone(value));
    },
  };
  return {
    rows,
    snapshots,
    storage,
    backup,
    block() {
      blocked = true;
    },
  };
}
const append = (token) => (queue) => [...queue, { token }];
test("a full localStorage falls back to IndexedDB and recovers pending progress after reload", async () => {
  const f = fixture();
  f.rows.set(key, JSON.stringify([{ token: "old" }]));
  f.block();
  const first = createLearningQueueStore(f);
  first.update(key, append("new"));
  await first.settled(key);
  assert.equal(first.durable(key), true);
  const reload = createLearningQueueStore(f);
  await reload.restore(key);
  assert.deepEqual(
    reload.read(key).map((e) => e.token),
    ["old", "new"],
  );
});
test("an interaction during recovery merges with recovered events instead of replacing them", async () => {
  const f = fixture();
  f.block();
  f.snapshots.set(key, { value: [{ token: "recovered" }], localValue: null });
  const queue = createLearningQueueStore(f);
  queue.update(key, append("new"));
  await queue.settled(key);
  assert.deepEqual(
    queue.read(key).map((e) => e.token),
    ["recovered", "new"],
  );
});
test("acknowledged events stay removed after reload even while localStorage remains full", async () => {
  const f = fixture();
  f.rows.set(key, JSON.stringify([{ token: "old" }]));
  f.block();
  const queue = createLearningQueueStore(f);
  await queue.restore(key);
  queue.update(key, (rows) => rows.filter((e) => e.token !== "old"));
  queue.update(key, append("next"));
  await queue.settled(key);
  const reload = createLearningQueueStore(f);
  await reload.restore(key);
  assert.deepEqual(reload.read(key), [{ token: "next" }]);
});
test("both storage failures are reported and unsent events remain available in memory", async () => {
  const f = fixture();
  f.block();
  f.backup.get = f.backup.put = async () => {
    throw Error("Blocked");
  };
  const queue = createLearningQueueStore(f);
  queue.update(key, append("unsaved"));
  await queue.settled(key);
  assert.equal(queue.durable(key), false);
  assert.deepEqual(queue.read(key), [{ token: "unsaved" }]);
});
test("a newer local snapshot takes precedence over an interrupted older backup", async () => {
  const f = fixture();
  f.rows.set(key, "[]");
  f.snapshots.set(key, {
    value: [{ token: "acknowledged" }],
    localValue: '[{"token":"acknowledged"}]',
  });
  const queue = createLearningQueueStore(f);
  await queue.restore(key);
  assert.deepEqual(queue.read(key), []);
});
