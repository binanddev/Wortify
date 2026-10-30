import test from "node:test";
import assert from "node:assert/strict";
import {
  hitsStroke,
  strokeBounds,
} from "../src/features/teaching/board-model.js";
import { paintStrokeLayer } from "../src/features/teaching/stroke-layer.js";
import { createPdfDocumentCache } from "../src/features/teaching/pdf-document-cache.js";
import {
  pollLessons,
  sameLessons,
} from "../src/features/teaching/lesson-poll.js";
const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

test("committed and active ink stay on separate layers without reallocating a stable canvas", () => {
  let width = 0,
    height = 0,
    resizes = 0;
  const ctx = { setTransform() {}, clearRect() {} };
  const canvas = {
    get width() {
      return width;
    },
    set width(v) {
      width = v;
      resizes++;
    },
    get height() {
      return height;
    },
    set height(v) {
      height = v;
      resizes++;
    },
    getContext() {
      return ctx;
    },
  };
  const page = { width: 400, height: 300 },
    seen = [];
  paintStrokeLayer(canvas, page, [{ id: "old" }, { id: "active" }], {
    scale: 2,
    exclude: "active",
    draw: (ctx, stroke) => seen.push(stroke.id),
  });
  assert.deepEqual(seen, ["old"]);
  assert.equal(resizes, 2);
  paintStrokeLayer(canvas, page, [{ id: "old" }, { id: "active" }], {
    scale: 2,
    draw: (ctx, stroke) => seen.push(stroke.id),
  });
  assert.deepEqual(seen, ["old", "old", "active"]);
  assert.equal(
    resizes,
    2,
    "vector updates must not reset canvas backing stores",
  );
});

test("eraser reuses cached bounds and updates only newly appended points", () => {
  let reads = 0;
  const raw = Array.from({ length: 10000 }, (_, i) => [i, 0]);
  const points = new Proxy(raw, {
    get(target, key, receiver) {
      if (/^\d+$/.test(String(key))) reads++;
      return Reflect.get(target, key, receiver);
    },
  });
  const stroke = { tool: "pen", width: 2, points };
  assert.equal(hitsStroke(stroke, [50000, 50000]), false);
  assert.equal(reads, 10000);
  reads = 0;
  assert.equal(hitsStroke(stroke, [50000, 50000]), false);
  assert.equal(reads, 0, "outside hit test should not walk old stroke points");
  raw.push([10001, 200]);
  const bounds = strokeBounds(stroke);
  assert.equal(reads, 1);
  assert.equal(bounds.maxY, 200);
});

test("PDF cache shares active loads and destroys old tasks instead of retaining every visited file", async () => {
  const tasks = new Map(),
    loads = [];
  const cache = createPdfDocumentCache((key) => {
    loads.push(key);
    const task = {
      promise: Promise.resolve({ id: key }),
      destroyed: 0,
      destroy() {
        this.destroyed++;
        return Promise.resolve();
      },
    };
    tasks.set(key, task);
    return task;
  });
  const first = cache.get("a");
  assert.equal(cache.get("a"), first);
  await first;
  await cache.get("b");
  assert.equal(tasks.get("a").destroyed, 1);
  assert.deepEqual(loads, ["a", "b"]);
  cache.clear();
  assert.equal(tasks.get("b").destroyed, 1);
});

test("leaving a PDF during download aborts it and disposal before load does not start a worker", async () => {
  let reject;
  const task = {
    promise: new Promise((resolve, r) => {
      reject = r;
    }),
    destroyed: 0,
    destroy() {
      this.destroyed++;
      reject(new DOMException("cancelled", "AbortError"));
      return Promise.resolve();
    },
  };
  let calls = 0;
  const cache = createPdfDocumentCache(() => {
    calls++;
    return task;
  });
  const loading = cache.get("a");
  const rejected = assert.rejects(loading, { name: "AbortError" });
  await settle();
  cache.clear();
  await rejected;
  assert.equal(task.destroyed, 1);
  const next = cache.get("never-start");
  const gone = assert.rejects(next, { name: "AbortError" });
  cache.clear();
  await gone;
  assert.equal(calls, 1);
});

test("lesson list requests remain sequential, pause when hidden, and abort on teardown", async () => {
  let resolve,
    requests = 0,
    visible = true;
  const timers = [],
    data = [],
    errors = [],
    signals = [];
  const poll = pollLessons({
    load: (signal) => {
      requests++;
      signals.push(signal);
      return new Promise((r) => {
        resolve = r;
      });
    },
    onData: (value) => data.push(value),
    onError: (error) => errors.push(error),
    visible: () => visible,
    setTimer(fn, delay) {
      const timer = { fn, delay };
      timers.push(timer);
      return timer;
    },
    clearTimer(timer) {
      const i = timers.indexOf(timer);
      if (i >= 0) timers.splice(i, 1);
    },
  });
  poll.refresh();
  poll.refresh();
  assert.equal(requests, 1);
  resolve({ boards: [] });
  await settle();
  assert.equal(data.length, 1);
  assert.equal(timers.length, 1);
  visible = false;
  await timers.shift().fn();
  assert.equal(requests, 1);
  visible = true;
  poll.refresh();
  assert.equal(requests, 2);
  poll.stop();
  assert.equal(signals.at(-1).aborted, true);
  resolve({ boards: ["late"] });
  await settle();
  assert.equal(data.length, 1);
  assert.equal(timers.length, 0);
  assert.equal(errors.length, 0);
  assert.equal(
    sameLessons(
      [{ id: 1, title: "A", updated_at: "x" }],
      [{ id: 1, title: "A", updated_at: "x" }],
    ),
    true,
  );
  assert.equal(
    sameLessons([{ id: 1, title: "A" }], [{ id: 1, title: "B" }]),
    false,
  );
});

test("streaming an active stroke does not repaint unchanged committed ink", () => {
  let draws = 0;
  const ctx = { setTransform() {}, clearRect() {} },
    canvas = { width: 400, height: 300, getContext: () => ctx },
    page = { id: "p", width: 400, height: 300 };
  const old = {
      id: "old",
      points: [
        [0, 0],
        [10, 10],
      ],
      visible: true,
    },
    active = { id: "active", points: [[20, 20]], visible: true };
  const options = { exclude: "active", draw: () => draws++ };
  assert.equal(paintStrokeLayer(canvas, page, [old, active], options), true);
  assert.equal(draws, 1);
  for (let i = 0; i < 100; i++) {
    active.points.push([i, i]);
    assert.equal(paintStrokeLayer(canvas, page, [old, active], options), false);
  }
  assert.equal(draws, 1, "100 live chunks should not redraw the old scene");
  assert.equal(
    paintStrokeLayer(canvas, page, [old, active], { draw: () => draws++ }),
    true,
  );
  assert.equal(
    draws,
    3,
    "completion paints old and finished stroke exactly once",
  );
});

test("a PDF loading task that resolves after unmount is destroyed before it can be used", async () => {
  let resolve;
  const task = {
    promise: Promise.resolve({}),
    destroyed: 0,
    destroy() {
      this.destroyed++;
      return Promise.resolve();
    },
  };
  const cache = createPdfDocumentCache(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const request = cache.get("late-import"),
    rejected = assert.rejects(request, { name: "AbortError" });
  await settle();
  cache.clear();
  resolve(task);
  await rejected;
  assert.equal(task.destroyed, 1);
});

test("failed PDF loads release their worker and can be retried", async () => {
  let attempts = 0,
    destroyed = 0;
  const cache = createPdfDocumentCache(() => {
    const fail = ++attempts === 1;
    return {
      promise: fail
        ? Promise.reject(new Error("offline"))
        : Promise.resolve({ id: "recovered" }),
      destroy() {
        destroyed++;
        return Promise.resolve();
      },
    };
  });
  await assert.rejects(cache.get("pdf"), /offline/);
  assert.equal(destroyed, 1);
  assert.equal((await cache.get("pdf")).id, "recovered");
  await cache.clear();
  assert.equal(destroyed, 2);
});
