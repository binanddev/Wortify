import test from "node:test";
import assert from "node:assert/strict";
import {
  searchHistoryKey,
  normalizeHistory,
  rememberSearch,
  cleanSearch,
} from "../src/features/explore/explore-history.js";
test("search history isolates accounts and languages", () => {
  assert.notEqual(searchHistoryKey(1, "en"), searchHistoryKey(1, "de"));
  assert.notEqual(searchHistoryKey(1, "en"), searchHistoryKey(2, "en"));
});
test("history normalizes and promotes repeated searches without mutating the old history", () => {
  const old = [
    { query: "Grammar", at: 1 },
    { query: "Words", at: 2 },
  ];
  const result = rememberSearch(old, "  GRAMMAR  ", 3);
  assert.deepEqual(result, [
    { query: "GRAMMAR", at: 3 },
    { query: "Words", at: 2 },
  ]);
  assert.equal(old[0].query, "Grammar");
  assert.equal(cleanSearch("  present   simple  "), "present simple");
  assert.equal(cleanSearch("a".repeat(250)).length, 200);
  assert.deepEqual(rememberSearch([], "   "), []);
});
test("malformed history is ignored and retained history is limited to 30 newest queries", () => {
  assert.deepEqual(normalizeHistory({}), []);
  assert.deepEqual(
    normalizeHistory([
      null,
      { query: "x" },
      { query: 2, at: 1 },
      { query: "", at: 1 },
    ]),
    [],
  );
  const result = normalizeHistory(
    Array.from({ length: 40 }, (_, i) => ({ query: `Query ${i}`, at: i })),
  );
  assert.equal(result.length, 30);
  assert.equal(result[0].query, "Query 39");
  assert.equal(result.at(-1).query, "Query 10");
});
