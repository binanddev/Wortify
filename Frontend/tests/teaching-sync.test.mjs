import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  applyOperation,
  uid,
  takeOperations,
} from "../src/features/teaching/board-model.js";
const source = (
  await readFile(
    new URL("../src/features/teaching/use-board.js", import.meta.url),
    "utf8",
  )
)
  .replace(/^import .*;\r?\n/gm, "")
  .replace("export function useBoard", "function useBoard");
const create = new Function(
  "useEffect",
  "useRef",
  "useState",
  "request",
  "applyOperation",
  "uid",
  "takeOperations",
  "draftStore",
  "createBoardRealtime",
  "Date",
  "window",
  "document",
  "setTimeout",
  "clearTimeout",
  source + ";return useBoard;",
);
const fresh = () => ({
  pages: [{ id: "p", width: 1120, height: 792, paper: "plain" }],
  active: "p",
  strokes: {},
});
const ink = (id) => ({
  kind: "ink",
  id,
  page: "p",
  tool: "pen",
  width: 2,
  color: "#123456",
  offset: 0,
  points: [
    [0, 0],
    [10, 10],
  ],
});
async function harness({
  draft = null,
  storageFails = false,
  loseAck = false,
  conflict = false,
  manage = true,
  initialMode = "fallback",
  readFailures = 0,
  deferPoll = false,
} = {}) {
  let clock = 1000;
  const realtime = { publish() {}, close() {} };
  const effects = [],
    timers = [],
    states = [],
    posts = [],
    reads = [],
    saves = [];
  let releasePoll;
  let stored = draft,
    server = fresh(),
    rev = 0;
  const receipts = new Map();
  const store = async (key, value) => {
    if (storageFails) throw Error("Storage disabled");
    if (value !== undefined) {
      saves.push(structuredClone(value));
      stored = structuredClone(value);
    }
    return structuredClone(stored);
  };
  const request = async (url, method = "GET", data) => {
    if (method === "POST") {
      posts.push(structuredClone(data));
      if (receipts.has(data.batch))
        return { revision: receipts.get(data.batch) };
      if (conflict) {
        const e = Error("The board changed in another window.");
        e.status = 409;
        throw e;
      }
      assert.equal(data.revision, rev);
      for (const op of data.operations) applyOperation(server, op);
      receipts.set(data.batch, ++rev);
      if (loseAck) {
        loseAck = false;
        throw Error("Network failed after commit");
      }
      return { revision: rev };
    }
    if (url.includes("?since=")) {
      reads.push(clock);
      if (readFailures-- > 0) throw new Error("Network failed");
      if (deferPoll)
        await new Promise((resolve) => {
          releasePoll = resolve;
        });
      return { revision: rev, events: [] };
    }
    return { revision: rev, state: structuredClone(server) };
  };
  const useState = (value) => {
    const i = states.length;
    states.push(value);
    return [
      value,
      (v) => (states[i] = typeof v === "function" ? v(states[i]) : v),
    ];
  };
  const hook = create(
    (fn) => effects.push(fn),
    (v) => ({ current: v }),
    useState,
    request,
    applyOperation,
    uid,
    takeOperations,
    store,
    (options) => {
      realtime.options = options;
      options.onState(initialMode);
      return realtime;
    },
    { now: () => clock },
    { addEventListener() {}, removeEventListener() {} },
    { hidden: false },
    (fn, delay) => {
      const entry = { fn, at: clock + delay };
      timers.push(entry);
      return entry;
    },
    (fn) => {
      const i = timers.indexOf(fn);
      if (i >= 0) timers.splice(i, 1);
    },
  );
  const api = hook("/board/", manage),
    cleanup = effects[0]();
  const settle = async () => {
    for (let i = 0; i < 30; i++) await Promise.resolve();
  };
  await settle();
  return {
    api,
    states,
    realtime,
    posts,
    reads,
    saves,
    settle,
    releasePoll: () => releasePoll?.(),
    nextDelay: () => Math.min(...timers.map((t) => t.at)) - clock,
    get stored() {
      return stored;
    },
    get server() {
      return server;
    },
    async tick() {
      assert.ok(timers.length, "sync timer scheduled");
      timers.sort((a, b) => a.at - b.at);
      const entry = timers.shift();
      clock = entry.at;
      await entry.fn();
      await settle();
    },
    cleanup,
  };
}
test("lost acknowledgement retries the exact durable batch without duplicating points", async () => {
  const h = await harness({ loseAck: true });
  h.api.dispatch(ink("stroke"));
  await h.tick();
  assert.equal(h.api.pending(), true);
  assert.equal(h.stored.flight.batch, h.posts[0].batch);
  await h.tick();
  assert.deepEqual(h.posts[0], h.posts[1]);
  assert.equal(h.api.pending(), false);
  assert.equal(h.server.strokes.stroke.points.length, 2);
  assert.equal(h.stored, null);
  h.cleanup();
});
test("new input arriving during retries stays queued behind the original batch", async () => {
  const h = await harness({ loseAck: true });
  h.api.dispatch(ink("first"));
  await h.tick();
  h.api.dispatch(ink("second"));
  await h.tick(); // Respect the network retry delay even when new input wakes the loop.
  assert.equal(h.posts.length, 1);
  await h.tick(); // Coalesced device checkpoint, without a premature HTTP write.
  assert.equal(h.posts.length, 1);
  await h.tick();
  assert.equal(h.api.pending(), true);
  await h.tick();
  assert.equal(h.posts[2].revision, 1);
  assert.equal(h.posts[2].operations[0].id, "second");
  assert.equal(Object.keys(h.server.strokes).length, 2);
  assert.equal(h.api.pending(), false);
  h.cleanup();
});
test("storage denial keeps live saving available and exposes a recovery warning", async () => {
  const h = await harness({ storageFails: true });
  h.api.dispatch(ink("stroke"));
  await h.tick();
  assert.equal(h.api.pending(), false);
  assert.equal(h.posts.length, 1);
  assert.match(h.states[3], /storage is unavailable/);
  h.cleanup();
});
test("another writing window pauses sync, retains the draft and rejects further edits", async () => {
  const h = await harness({ conflict: true });
  h.api.dispatch(ink("stroke"));
  await h.tick();
  assert.equal(h.states[1], "conflict");
  assert.equal(h.api.pending(), true);
  assert.equal(h.api.dispatch(ink("blocked")), false);
  assert.equal(h.stored.flight.operations[0].id, "stroke");
  h.cleanup();
});
test("reopening a lesson restores unsent ink from the device and flushes it", async () => {
  const state = fresh(),
    op = ink("restored");
  applyOperation(state, op);
  const h = await harness({
    draft: { state, revision: 0, queue: [op], flight: null },
  });
  assert.equal(h.api.model.current.strokes.restored.points.length, 2);
  assert.equal(h.server.strokes.restored.points.length, 2);
  assert.equal(h.api.pending(), false);
  h.cleanup();
});

test("idle live boards do not poll at the old 350 ms interval", async () => {
  const h = await harness();
  h.realtime.options.onState("live");
  h.realtime.options.onEvent({ type: "resync" });
  await h.tick();
  // A socket event applies immediately without a per-student HTTP read.
  h.realtime.options.onEvent({
    type: "batch",
    revision: 1,
    operations: [ink("remote")],
  });
  await h.tick();
  assert.equal(h.api.model.current.strokes.remote.points.length, 2);
  assert.equal(h.api.pending(), false);
  h.cleanup();
});

test("read-only viewers lose future data when their access is revoked", async () => {
  const h = await harness({ manage: false });
  h.realtime.options.onEvent({ type: "access-denied", status: 404 });
  await h.tick();
  assert.equal(h.api.model.current, null);
  assert.equal(h.states[1], "unavailable");
  assert.equal(h.api.dispatch(ink("blocked")), false);
  h.cleanup();
});

test("failed live reconciliation backs off instead of scheduling an HTTP retry at 0 ms", async () => {
  const h = await harness({ initialMode: "live", readFailures: 2 });
  assert.deepEqual(h.reads, [1000]);
  assert.equal(h.nextDelay(), 2000);
  await h.tick();
  assert.deepEqual(h.reads, [1000, 3000]);
  assert.equal(h.nextDelay(), 4000);
  await h.tick();
  assert.deepEqual(h.reads, [1000, 3000, 7000]);
  assert.equal(h.nextDelay(), 30000);
  h.cleanup();
});
test("a queued wake cannot start a second reconciliation while the first request is pending", async () => {
  const h = await harness({ initialMode: "live", deferPoll: true });
  assert.equal(h.reads.length, 1);
  await h.tick();
  assert.equal(h.reads.length, 1);
  h.releasePoll();
  await h.settle();
  h.cleanup();
});
test("rapid local chunks coalesce recovery checkpoints rather than cloning the full board per chunk", async () => {
  const h = await harness();
  for (let i = 0; i < 50; i++) h.api.dispatch(ink(`s${i}`));
  await h.settle();
  assert.equal(h.saves.length, 0);
  await h.tick();
  assert.equal(h.posts.length, 1);
  assert.equal(h.saves.length, 2);
  assert.equal(h.saves[0].flight.operations.length, 50);
  assert.equal(h.saves[1], null);
  assert.equal(Object.keys(h.server.strokes).length, 50);
  h.cleanup();
});
test("closing before a coalesced checkpoint flushes the latest unsent local draft", async () => {
  const h = await harness();
  h.api.dispatch(ink("closing"));
  h.cleanup();
  await h.settle();
  assert.equal(h.posts.length, 0);
  assert.equal(h.stored.queue[0].id, "closing");
});
