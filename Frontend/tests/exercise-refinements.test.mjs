import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceQueue,
  activeQuestions,
  needsManualCheck,
} from "../src/practice-session.js";
import {
  placeSentenceToken,
  sentenceInsertionIndex,
} from "../src/sentence-tokens.js";
import { gradeExercise } from "../src/local-learning.js";

test("categorization presents and grades all words as one exercise, including retries", () => {
  const questions = [
    { id: "a", accepted_answers: ["Fruit"] },
    { id: "b", accepted_answers: ["Animal"] },
    { id: "c", accepted_answers: ["Fruit"] },
  ];
  const batch = activeQuestions("categorization", questions, 1);
  assert.deepEqual(batch, questions);
  assert.equal(
    gradeExercise({}, batch, { a: "Fruit", b: "Animal", c: "Fruit" }).score,
    3,
  );
  assert.equal(gradeExercise({}, batch, { a: "Fruit" }).score, 1);
  assert.deepEqual(advanceQueue(["a", "b", "c"], false, true), []);
  assert.deepEqual(advanceQueue(["a", "b", "c"], true, true), ["a", "b", "c"]);
  assert.deepEqual(activeQuestions("categorization", questions, 3), []);
});

test("revealed questions rotate to the end, including repeated skips and the final question", () => {
  let queue = advanceQueue(["a", "b", "c"], true);
  assert.deepEqual(queue, ["b", "c", "a"]);
  queue = advanceQueue(queue);
  queue = advanceQueue(queue, true);
  assert.deepEqual(queue, ["a", "c"]);
  queue = advanceQueue(queue);
  assert.deepEqual(advanceQueue(queue, true), ["c"]);
  assert.deepEqual(advanceQueue(queue), []);
});
test("matching shows every row and grades a pair independently", () => {
  const qs = [
    { id: 1, accepted_answers: ["one"] },
    { id: 2, accepted_answers: ["two"] },
  ];
  assert.equal(activeQuestions("matching", qs, 1).length, 2);
  assert.equal(gradeExercise({}, [qs[0]], { 1: "two" }).score, 0);
  assert.equal(gradeExercise({}, [qs[0]], { 1: "one" }).score, 1);
  assert.equal(needsManualCheck("short_answer", "sentence_rewrite"), true);
});
test("sentence tokens insert, reorder both directions, remove and preserve duplicate words by id", () => {
  const tokens = [
    { id: "a", text: "ich" },
    { id: "b", text: "bin" },
    { id: "c", text: "ich" },
  ];
  assert.deepEqual(placeSentenceToken(tokens, ["a", "c"], "b", 1), [
    "a",
    "b",
    "c",
  ]);
  assert.deepEqual(placeSentenceToken(tokens, ["a", "b", "c"], "a", 2), [
    "b",
    "c",
    "a",
  ]);
  assert.deepEqual(placeSentenceToken(tokens, ["a", "b", "c"], "c", 0), [
    "c",
    "a",
    "b",
  ]);
  assert.deepEqual(placeSentenceToken(tokens, ["a", "b", "c"], "b", null), [
    "a",
    "c",
  ]);
  assert.deepEqual(placeSentenceToken(tokens, ["a"], "unknown", 0), ["a"]);
});
test("sentence insertion handles the beginning, end and wrapped lines", () => {
  const rects = [
    { left: 0, right: 50, top: 0, bottom: 30 },
    { left: 60, right: 110, top: 0, bottom: 30 },
    { left: 0, right: 50, top: 40, bottom: 70 },
  ];
  assert.equal(sentenceInsertionIndex({ x: 0, y: 10 }, rects), 0);
  assert.equal(sentenceInsertionIndex({ x: 55, y: 10 }, rects), 1);
  assert.equal(sentenceInsertionIndex({ x: 0, y: 50 }, rects), 2);
  assert.equal(sentenceInsertionIndex({ x: 70, y: 50 }, rects), 3);
});

test("partial input requires manual checking and random retries preserve the remaining questions", async () => {
  const { needsManualCheck, repeatLater } = await import(
    "../src/practice-session.js"
  );
  assert.equal(needsManualCheck("short_answer", "partial_input"), true);
  assert.deepEqual(
    repeatLater(["a", "b", "c", "d"], () => 0),
    ["b", "a", "c", "d"],
  );
  assert.deepEqual(
    repeatLater(["a", "b", "c", "d"], () => 0.99),
    ["b", "c", "d", "a"],
  );
  assert.deepEqual(repeatLater(["a"]), ["a"]);
});
