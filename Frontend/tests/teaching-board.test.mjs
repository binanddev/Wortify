import test from "node:test";
import assert from "node:assert/strict";
import {
  applyOperation,
  hitsStroke,
  takeOperations,
} from "../src/features/teaching/board-model.js";
test("live chunks replay without duplicating ink after a retry", () => {
  const state = { pages: [{ id: "p" }], active: "p", strokes: {} };
  const first = {
    kind: "ink",
    id: "s",
    page: "p",
    tool: "pen",
    color: "#000000",
    width: 2,
    offset: 0,
    points: [
      [0, 0],
      [10, 10],
    ],
  };
  applyOperation(state, first);
  applyOperation(state, first);
  applyOperation(state, { ...first, offset: 2, points: [[20, 20]] });
  assert.deepEqual(state.strokes.s.points, [
    [0, 0],
    [10, 10],
    [20, 20],
  ]);
  first.points[0][0] = 999;
  assert.equal(state.strokes.s.points[0][0], 0);
  applyOperation(state, {
    kind: "visibility",
    page: "p",
    ids: ["s"],
    visible: false,
  });
  assert.equal(state.strokes.s.visible, false);
  applyOperation(state, {
    kind: "visibility",
    page: "p",
    ids: ["s"],
    visible: true,
  });
  assert.equal(state.strokes.s.visible, true);
});
test("eraser detects the segment between sparse points, not just endpoints", () => {
  assert.equal(
    hitsStroke(
      {
        points: [
          [0, 0],
          [100, 0],
        ],
        width: 2,
        tool: "line",
      },
      [50, 0],
    ),
    true,
  );
  assert.equal(
    hitsStroke(
      {
        points: [
          [0, 0],
          [100, 0],
        ],
        width: 2,
        tool: "line",
      },
      [50, 50],
    ),
    false,
  );
  assert.equal(
    hitsStroke(
      {
        points: [
          [0, 0],
          [100, 100],
        ],
        width: 2,
        tool: "rectangle",
      },
      [50, 0],
    ),
    true,
  );
  assert.equal(
    hitsStroke(
      {
        points: [
          [0, 0],
          [100, 100],
        ],
        width: 2,
        tool: "rectangle",
      },
      [50, 50],
    ),
    false,
  );
  assert.equal(
    hitsStroke(
      {
        points: [
          [0, 0],
          [100, 100],
        ],
        width: 2,
        tool: "ellipse",
      },
      [100, 50],
    ),
    true,
  );
});

test("offline backlogs are split by serialized byte size, preserving every operation", () => {
  const queue = Array.from({ length: 128 }, (_, i) => ({
      kind: "ink",
      id: String(i),
      points: Array.from({ length: 2048 }, (_, j) => [j, j]),
    })),
    all = [];
  while (queue.length) {
    const packet = takeOperations(queue);
    assert.ok(
      Buffer.byteLength(JSON.stringify({ operations: packet }), "utf8") <
        256000,
    );
    all.push(...packet);
  }
  assert.equal(all.length, 128);
  assert.equal(all.at(-1).id, "127");
});
