import test from "node:test";
import assert from "node:assert/strict";
import { publicExploreNodes, exploreFolders } from "../src/explore-folders.js";
const all = [
  {
    id: 1,
    parent: null,
    kind: "folder",
    title: "Grammar",
    visibility: "public",
  },
  { id: 2, parent: 1, kind: "folder", title: "Tenses", visibility: "public" },
  {
    id: 3,
    parent: 2,
    kind: "exercise",
    title: "Present simple",
    interaction: "short_answer",
    visibility: "public",
  },
  {
    id: 4,
    parent: 1,
    kind: "exercise",
    title: "Private draft",
    interaction: "short_answer",
    visibility: "private",
  },
  {
    id: 5,
    parent: null,
    kind: "folder",
    title: "Private",
    visibility: "private",
  },
  {
    id: 6,
    parent: null,
    kind: "folder",
    title: "Vocabulary",
    visibility: "public",
  },
  {
    id: 7,
    parent: 1,
    kind: "exercise",
    title: "Retired",
    interaction: "audio_dictation",
    visibility: "public",
  },
];
const nodes = publicExploreNodes(all);
test("Explore shows only public folde roots, then direct public contents", () => {
  assert.deepEqual(
    nodes.map((n) => n.id),
    [1, 2, 3, 6],
  );
  assert.deepEqual(
    exploreFolders(nodes, []).map((n) => n.id),
    [1, 6],
  );
  assert.deepEqual(
    exploreFolders(nodes, [], 1).map((n) => n.id),
    [2],
  );
  assert.deepEqual(
    exploreFolders(nodes, [], 2).map((n) => n.id),
    [3],
  );
});
test("search finds containing folde without flattening nested results or revealing private drafts", () => {
  assert.deepEqual(
    exploreFolders(nodes, [{ id: 3 }], null, true).map((n) => n.id),
    [1],
  );
  assert.deepEqual(
    exploreFolders(nodes, [{ id: 3 }], 1, true).map((n) => n.id),
    [2],
  );
  assert.deepEqual(
    exploreFolders(nodes, [{ id: 4 }, { id: 999 }], null, true),
    [],
  );
  assert.deepEqual(exploreFolders(nodes, [], null, true), []);
});
