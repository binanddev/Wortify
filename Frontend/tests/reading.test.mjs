import test from "node:test";
import assert from "node:assert/strict";
import { parsePracticeText, textTemplate, exerciseToText } from "../src/features/practice/practice-text.js";
import { previewData } from "../src/features/practice/exercise-types.js";
import { gradeExercise } from "../src/features/learning/local-learning.js";
import { needsManualCheck } from "../src/features/practice/practice-session.js";
import { readingImageSource, readingStyle } from "../src/features/practice/reading-html.js";
test("reading import/export preserves HTML and mixed single/multiple questions", () => {
 const e = parsePracticeText(textTemplate("reading")).nodes[0].payload;
 assert.equal(e.questions[0].kind,"choice"); assert.equal(e.questions[1].kind,"multi");
 assert.deepEqual(parsePracticeText(exerciseToText(e)).nodes[0].payload,e);
 assert.equal(needsManualCheck("reading","split_reading"),true);
 const q = previewData(e).questions;
 assert.equal(gradeExercise(e,q,{"1":"Friday","2":["Carrots","Tomatoes"]}).score,2);
 assert.ok(gradeExercise(e,q,{"1":"Friday","2":["Carrots"]}).score < 2);
 assert.ok(gradeExercise(e,q,{"1":"Friday","2":["Carrots","Tomatoes","Potatoes"]}).score < 2);
});
test("reading rejects missing passages and invalid answer choices", () => {
 assert.throws(()=>parsePracticeText(textTemplate("reading").replace(/CONTEXT:.*\n>.*\n/,"")));
 assert.throws(()=>parsePracticeText(textTemplate("reading").replace("ANSWER: Friday","ANSWER: Missing")));
});
test("reading HTML styles and image sources cannot inject global CSS or scripts", () => {
 assert.equal(readingImageSource("javascript:alert(1)"),null);
 assert.equal(readingImageSource("//evil.com/a"),null);
 assert.equal(readingImageSource("https://user:pass@evil.com/a"),null);
 assert.equal(readingImageSource("/api/en/practice-hub/media/abc/"),"/api/en/practice-hub/media/abc/");
 assert.deepEqual(readingStyle("position:fixed;z-index:999; background:url(evil);width:900%;height:9999px;float:right;text-align:center;"),{width:"100%",height:"1200px",float:"right",textAlign:"center"});
});

test("reading question fields reject HTML while the passage accepts it", () => {
 for (const [before, after] of [
  ["QUESTION: When do Mia", "QUESTION: <b>When</b> do Mia"],
  ["OPTIONS: Friday", "OPTIONS: <b>Friday</b>"],
  ["EXPLANATION: The first", "EXPLANATION: <b>The</b> first"],
 ]) assert.throws(() => parsePracticeText(textTemplate("reading").replace(before,after)));
 assert.equal(parsePracticeText(textTemplate("reading")).nodes.length,1);
});
