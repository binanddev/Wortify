import test from "node:test";
import assert from "node:assert/strict";
function fakeDatabase() {
  const rows = new Map(),
    connections = [];
  let opens = 0,
    closed = 0;
  const indexedDB = {
    open() {
      opens++;
      const db = {
        createObjectStore() {},
        close() {
          closed++;
        },
        transaction() {
          const tx = {};
          const done = (result) => {
            const request = { result };
            queueMicrotask(() => tx.oncomplete?.());
            return request;
          };
          tx.objectStore = () => ({
            get: (key) => done(structuredClone(rows.get(key))),
            put(value, key) {
              rows.set(key, structuredClone(value));
              return done(key);
            },
            delete(key) {
              rows.delete(key);
              return done(undefined);
            },
          });
          return tx;
        },
      };
      connections.push(db);
      const request = { result: db };
      queueMicrotask(() => request.onsuccess());
      return request;
    },
  };
  return {
    indexedDB,
    connections,
    get opens() {
      return opens;
    },
    get closed() {
      return closed;
    },
  };
}
test("draft operations share one connection and clear acknowledged recovery records", async (t) => {
  const previous = globalThis.indexedDB,
    fake = fakeDatabase();
  globalThis.indexedDB = fake.indexedDB;
  t.after(() => (globalThis.indexedDB = previous));
  const { draftStore } = await import(
    `../src/features/teaching/draft-store.js?reuse=${Date.now()}`
  );
  await draftStore("lesson", { queue: [1] });
  await draftStore("lesson", { queue: [1, 2] });
  assert.deepEqual(await draftStore("lesson"), { queue: [1, 2] });
  assert.equal(fake.opens, 1);
  assert.equal(fake.closed, 0);
  await draftStore("lesson", null);
  assert.equal(await draftStore("lesson"), undefined);
  assert.equal(fake.opens, 1);
  fake.connections[0].onversionchange();
  assert.equal(fake.closed, 1);
  await draftStore("lesson", { queue: [3] });
  assert.equal(fake.opens, 2);
});
test("a synchronous storage failure does not poison later recovery attempts", async (t) => {
  const previous = globalThis.indexedDB,
    fake = fakeDatabase();
  let fail = true;
  globalThis.indexedDB = {
    open() {
      if (fail) throw Error("storage temporarily blocked");
      return fake.indexedDB.open();
    },
  };
  t.after(() => (globalThis.indexedDB = previous));
  const { draftStore } = await import(
    `../src/features/teaching/draft-store.js?retry=${Date.now()}`
  );
  await assert.rejects(
    draftStore("lesson", { queue: [1] }),
    /temporarily blocked/,
  );
  fail = false;
  await draftStore("lesson", { queue: [2] });
  assert.deepEqual(await draftStore("lesson"), { queue: [2] });
});
