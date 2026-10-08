import test from "node:test";
import assert from "node:assert/strict";
import {
  exerciseSolution,
  cardSolution,
  SKIPPED_ANSWER,
} from "../src/features/learning/skip-learning.js";
import { gradeCard } from "../src/features/learning/local-learning.js";
test("skip reveals readable solutions for blanks, multi-select and order without editing answers", () => {
  const q = {
    id: 1,
    kind: "text",
    blanks: [{ answers: ["bin", "sei"] }, { answers: ["gut"] }],
  };
  assert.deepEqual(exerciseSolution({}, q), ["Gap 1: bin / sei", "Gap 2: gut"]);
  assert.deepEqual(
    exerciseSolution(
      {},
      {
        id: 2,
        kind: "order",
        accepted_answers: ["b", "a"],
        presentation: {
          tokens: [
            { id: "a", text: "hier" },
            { id: "b", text: "Ich bin" },
          ],
        },
      },
    ),
    ["Ich bin hier"],
  );
  assert.deepEqual(
    exerciseSolution(
      {},
      { id: 3, kind: "multi", accepted_answers: ["cat", "dog"] },
    ),
    ["cat / dog"],
  );
});
test("flashcard solutions cover both true/false and every matching pair", () => {
  assert.deepEqual(
    cardSolution({ type: "truefalse", truth: false, expected: "house" }),
    ["False — house"],
  );
  assert.deepEqual(
    cardSolution({
      type: "matching",
      left: [
        { id: "1", text: "house" },
        { id: "2", text: "cat" },
      ],
      right: [
        { id: "2", text: "mèo" },
        { id: "1", text: "nhà" },
      ],
    }),
    ["house — nhà", "cat — mèo"],
  );
});
test("skipped answers never count as correct for any flashcard session mode", () => {
  for (const mode of ["flash", "quiz", "write"]) {
    const result = gradeCard(
      { mode, target: SKIPPED_ANSWER, meaning: SKIPPED_ANSWER },
      SKIPPED_ANSWER,
    );
    assert.equal(result.is_correct, false);
    assert.equal(result.skipped, true);
  }
});
