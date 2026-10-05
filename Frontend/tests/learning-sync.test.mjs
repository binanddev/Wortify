import test from "node:test";
import assert from "node:assert/strict";
import {
  enqueueLearning,
  flushLearning,
  pendingLearning,
} from "../src/learning-sync.js";
test("offline practice progress coalesces without losing completed questions", () => {
  const stored = new Map();
  globalThis.localStorage = {
    getItem: (k) => stored.get(k) || null,
    setItem: (k, v) => stored.set(k, v),
  };
  globalThis.window = new EventTarget();
  enqueueLearning(890, "en", "practice_progress", {
    node: 1,
    revision: "a",
    completed: ["1"],
  });
  enqueueLearning(890, "en", "practice_progress", {
    node: 1,
    revision: "a",
    completed: ["2"],
  });
  enqueueLearning(890, "en", "practice_progress", {
    node: 2,
    revision: "a",
    completed: ["1"],
  });
  const queue = pendingLearning(890, "en");
  assert.equal(queue.length, 2);
  assert.deepEqual(queue[0].payload.completed, ["1", "2"]);
  assert.equal(queue[0].payload.answers, undefined);
  assert.equal(queue[0].payload.score, undefined);
});
test("offline batch retains IDs, retries without loss, and isolates accounts", async () => {
  const stored = new Map();
  globalThis.localStorage = {
    getItem: (k) => stored.get(k) || null,
    setItem: (k, v) => stored.set(k, v),
  };
  globalThis.window = new EventTarget();
  globalThis.document = { cookie: "" };
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error("Offline");
  };
  const token = enqueueLearning(1, "en", "star", {
    deck: 1,
    card: 2,
    value: true,
  });
  enqueueLearning(2, "en", "star", { deck: 1, card: 3, value: true });
  assert.equal(calls, 0, "star interaction must not send its own request");
  await flushLearning(1, "en");
  assert.equal(pendingLearning(1, "en")[0].token, token);
  globalThis.fetch = async (path, options) => {
    const events = JSON.parse(options.body).events;
    assert.equal(events[0].token, token);
    return {
      ok: true,
      json: async () => ({
        accepted: events.map((e) => ({ token: e.token })),
        errors: [],
      }),
    };
  };
  await flushLearning(1, "en");
  assert.equal(pendingLearning(1, "en").length, 0);
  assert.equal(pendingLearning(2, "en").length, 1);
});
test("preference snapshots coalesce and invalid changes remain recoverable", async () => {
  const stored = new Map();
  globalThis.localStorage = {
    getItem: (k) => stored.get(k) || null,
    setItem: (k, v) => stored.set(k, v),
  };
  globalThis.window = new EventTarget();
  globalThis.document = { cookie: "" };
  enqueueLearning(1, "en", "options", { deck: 1, options: { count: 5 } });
  const token = enqueueLearning(1, "en", "options", {
    deck: 1,
    options: { count: 10 },
  });
  assert.equal(pendingLearning(1, "en").length, 1);
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      accepted: [],
      errors: [{ token, error: "Changed content" }],
    }),
  });
  await flushLearning(1, "en");
  assert.equal(pendingLearning(1, "en")[0].error, "Changed content");
});

test("blocked browser storage still sends preferences to the server", async () => {
  globalThis.localStorage = {
    getItem() {
      throw new Error("Blocked");
    },
    setItem() {
      throw new Error("Blocked");
    },
  };
  globalThis.window = new EventTarget();
  globalThis.document = { cookie: "" };
  let sent = [];
  globalThis.fetch = async (path, options) => {
    sent = JSON.parse(options.body).events;
    return {
      ok: true,
      json: async () => ({
        accepted: sent.map((e) => ({ token: e.token })),
        errors: [],
      }),
    };
  };
  enqueueLearning(73, "de", "preferences", { textSize: 20 });
  await flushLearning(73, "de");
  assert.equal(sent[0].payload.textSize, 20);
  assert.equal(pendingLearning(73, "de").length, 0);
});

test("obsolete unavailable receipts leave the retry queue and remain recoverable locally", async () => {
  const stored = new Map();
  globalThis.localStorage = {
    getItem: (k) => stored.get(k) || null,
    setItem: (k, v) => stored.set(k, v),
  };
  globalThis.window = new EventTarget();
  globalThis.document = { cookie: "" };
  const key = "wortify:sync:701:en";
  stored.set(
    key,
    JSON.stringify([
      {
        token: "old",
        error: "Nội dung không còn truy cập được.",
        kind: "practice_progress",
        payload: { node: 9 },
      },
    ]),
  );
  assert.deepEqual(pendingLearning(701, "en"), []);
  assert.equal(JSON.parse(stored.get(`${key}:unavailable`))[0].token, "old");
  const token = enqueueLearning(701, "en", "practice_progress", {
    node: 10,
    completed: [],
  });
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      accepted: [],
      errors: [{ token, error: "Unavailable", code: "content_unavailable" }],
    }),
  });
  await flushLearning(701, "en");
  assert.deepEqual(pendingLearning(701, "en"), []);
  assert.equal(JSON.parse(stored.get(`${key}:unavailable`)).length, 2);
});
