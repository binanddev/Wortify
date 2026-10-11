import test from "node:test";
import assert from "node:assert/strict";
import { aiAuthoringGuide } from "../src/features/practice/ai-authoring-guide.js";
import { completePracticeGuide, parsePracticeText } from "../src/features/practice/practice-text.js";
import { EXERCISE_TYPES, exerciseStylesOf } from "../src/features/practice/exercise-types.js";
import { FORMAT_EXAMPLES } from "../src/features/practice/formatting-examples.js";

test("AI instructions include the current importable library and formatting reference", () => {
  const bundle = aiAuthoringGuide("de", "B1 travel, 10 questions");
  assert.ok(bundle.includes(completePracticeGuide()));
  for (const [, example] of FORMAT_EXAMPLES) assert.ok(bundle.includes(example));
  const parsed = parsePracticeText(completePracticeGuide());
  assert.equal(parsed.nodes.length, EXERCISE_TYPES.reduce((n, [mode]) => n + exerciseStylesOf(mode).length, 0));
  assert.ok(bundle.includes("Learning language: German."));
  assert.ok(bundle.includes("B1 travel, 10 questions"));
});

test("empty requests ask for a brief and theory stays separate from exercise imports", () => {
  const bundle = aiAuthoringGuide("en", "  ");
  assert.ok(bundle.includes("Ask me for the topic"));
  assert.ok(bundle.includes("Learning language: English."));
  assert.ok(bundle.includes("Do not wrap theory in EXERCISE fields"));
  assert.ok(bundle.includes("Do not claim the result has been tested"));
});
