import test from "node:test";
import assert from "node:assert/strict";
import { treeWindow } from "../src/tree-window.js";
test("long branches stay compact while preserving the active path and every item when expanded", () => {
  const nodes = Array.from({ length: 20 }, (_, id) => ({ id }));
  assert.equal(treeWindow(nodes, new Set()).length, 8);
  assert.equal(treeWindow(nodes, new Set([17])).at(-1).id, 17);
  assert.deepEqual(treeWindow(nodes, new Set([17]), true), nodes);
  assert.deepEqual(treeWindow(nodes.slice(0, 3), new Set()), nodes.slice(0, 3));
  assert.equal(nodes[7].id, 7);
});
