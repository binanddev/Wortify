import test from "node:test";
import assert from "node:assert/strict";
import {
  allocateGapTokens,
  gapMove,
  canFillGapBank,
} from "../src/gap-tokens.js";
const chips = [
  { id: "0", text: "the" },
  { id: "1", text: "the" },
  { id: "2", text: "a" },
];
test("gap bank consumes occurrences, preserves duplicate words and returns replaced tokens", () => {
  const answers = { q_0: "the", q_1: "the" };
  const { slots, bank } = allocateGapTokens(chips, answers, "q", 2);
  assert.deepEqual(
    slots.map((t) => t.id),
    ["0", "1"],
  );
  assert.deepEqual(
    bank.map((t) => t.id),
    ["2"],
  );
  for (const [key, value] of gapMove("q", slots, bank[0], 0))
    answers[key] = value;
  assert.deepEqual(
    allocateGapTokens(chips, answers, "q", 2).bank.map((t) => t.text),
    ["the"],
  );
});
test("moving a placed word clears its source and dropping back restores the bank", () => {
  let answers = { q_0: "a" };
  let state = allocateGapTokens(chips, answers, "q", 2);
  assert.deepEqual(gapMove("q", state.slots, chips[2], 0), []);
  for (const [key, value] of gapMove("q", state.slots, chips[2], 1))
    answers[key] = value;
  assert.deepEqual(answers, { q_0: "", q_1: "a" });
  state = allocateGapTokens(chips, answers, "q", 2);
  for (const [key, value] of gapMove("q", state.slots, chips[2], null))
    answers[key] = value;
  assert.equal(allocateGapTokens(chips, answers, "q", 2).bank.length, 3);
});

test("banks require enough physical tokens and support overlapping accepted answers", () => {
  assert.equal(
    canFillGapBank([{ answers: ["the"] }, { answers: ["the"] }], ["the"]),
    false,
  );
  assert.equal(
    canFillGapBank(
      [{ answers: ["the"] }, { answers: ["the"] }],
      ["the", "the"],
    ),
    true,
  );
  assert.equal(
    canFillGapBank(
      [{ answers: ["a", "the"] }, { answers: ["a"] }],
      ["a", "the"],
    ),
    true,
  );
});
