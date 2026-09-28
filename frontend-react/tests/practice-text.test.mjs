import test from "node:test";
import assert from "node:assert/strict";
import {
  parsePracticeText,
  textTemplate,
  exerciseToText,
} from "../src/practice-text.js";
import { EXERCISE_TYPES, previewData } from "../src/exercise-types.js";
import { gradeExercise } from "../src/local-learning.js";
import { readyToCheck, mergeProgress } from "../src/practice-session.js";

test("seven text formats round trip and grade through the existing engine", () => {
  assert.equal(EXERCISE_TYPES.length, 7);
  for (const [mode] of EXERCISE_TYPES) {
    const e = parsePracticeText(textTemplate(mode)).nodes[0].payload;
    const data = previewData(e);
    const values = {};
    for (const q of data.questions) {
      if (q.blanks.length)
        q.blanks.forEach((b, i) => (values[`${q.id}_${i}`] = b.answers[0]));
      else
        values[q.id] =
          q.kind === "order" ? q.accepted_answers : q.accepted_answers[0];
    }
    const result = gradeExercise(e, data.questions, values);
    assert.equal(result.score, result.total, mode);
    assert.deepEqual(parsePracticeText(exerciseToText(e)).nodes[0].payload, e);
    assert.equal(gradeExercise(e, data.questions, {}).score, 0, mode);
  }
});
test("invalid text is rejected with useful line errors before saving", () => {
  for (const text of [
    "",
    "CAU: Missing exercise",
    textTemplate().replace("DANG:", "UNKNOWN:"),
    textTemplate().replace("{{2}}", "{{1}}"),
    textTemplate("inline_selection").replace(
      "is => is | are",
      "was => is | are",
    ),
    textTemplate("categorization").replace("DAP_AN: Fruit", "DAP_AN: Other"),
    textTemplate().replace("STYLE: drag_drop", "STYLE: made_up"),
    textTemplate() + "DAP_AN: a\nDAP_AN: b",
  ]) {
    assert.throws(() => parsePracticeText(text), /Dòng/);
  }
});
test("batch imports accept BOM, CRLF, comments and duplicate sentence words keep separate IDs", () => {
  const result = parsePracticeText(
    "\uFEFF# comment\r\n" +
      EXERCISE_TYPES.map(([m]) => textTemplate(m)).join("\r\n"),
  );
  assert.equal(result.nodes.length, 7);
  const e = parsePracticeText(
    textTemplate("sentence_building").replace(
      "She | is | reading | a book.",
      "had | had",
    ),
  ).nodes[0].payload;
  assert.deepEqual(e.questions[0].accepted_answers, ["1", "2"]);
});

test("all eleven styles parse and invalid cross-out and partial tasks are rejected", () => {
  assert.doesNotThrow(() =>
    parsePracticeText(textTemplate("error_correction", "cross_out")),
  );
  assert.throws(
    () =>
      parsePracticeText(
        textTemplate("error_correction").replace("click_edit", "cross_out"),
      ),
    /bỏ từ/,
  );
  assert.throws(
    () =>
      parsePracticeText(textTemplate("short_answer").replace(/GOI_Y:.*\n/, "")),
    /GOI_Y/,
  );
});
test("multiline context and question survive editing", () => {
  const text = textTemplate("short_answer").replace(
    "CAU:",
    "NGU_CANH: First line\n> Second line\nCAU:",
  );
  const e = parsePracticeText(text).nodes[0].payload;
  e.questions[0].prompt += "\nAnother line";
  assert.deepEqual(parsePracticeText(exerciseToText(e)).nodes[0].payload, e);
});
test("automatic grading waits until every blank or token is filled", () => {
  const q = previewData(parsePracticeText(textTemplate()).nodes[0].payload)
    .questions[0];
  assert.equal(readyToCheck(q, { "1_0": "drink" }), false);
  assert.equal(readyToCheck(q, { "1_0": "drink", "1_1": "morning" }), true);
  const order = previewData(
    parsePracticeText(textTemplate("sentence_building")).nodes[0].payload,
  ).questions[0];
  assert.equal(readyToCheck(order, { 1: ["1", "2"] }), false);
  assert.equal(readyToCheck(order, { 1: ["1", "2", "3", "4"] }), true);
  assert.equal(readyToCheck(order, { 1: ["1", "2", "3", "3"] }), false);
});
test("progress merges across devices, excludes examples and obsolete IDs", () => {
  const qs = [{ id: "1" }, { id: "2" }, { id: "3", example: true }];
  assert.deepEqual(mergeProgress(qs, ["1"], ["2", "1", "3", "99"]), ["1", "2"]);
  assert.deepEqual(mergeProgress(qs, {}, null), []);
});
