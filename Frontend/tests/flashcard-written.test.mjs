import test from "node:test";
import assert from "node:assert/strict";
import {compareAnswer} from "../src/features/flashcards/answer-comparison.js";
import {makeQuestion,checkQuestion,assessQuestion,advanceProgress,createTest} from "../src/features/flashcards/flashcard-engine.js";
import {cardSolution} from "../src/features/learning/skip-learning.js";
const flexible = {gradingMode:"flexible"};
const card = {id:1,german_text:"der Bahnhof",vietnamese_meaning:"nhà ga xe lửa",accepted_answers:["Bahnhof"]};

test("exact remains default, honors normalization and accepted alternatives", () => {
  assert.equal(compareAnswer("Hello world!", "hello world").correct,true);
  assert.equal(compareAnswer("hello world", "hello").correct,false);
  assert.equal(compareAnswer("Hello", "hello", {ignore_case:false}).correct,false);
  assert.equal(compareAnswer("Hello!", "Hello", {ignore_punctuation:false}).correct,false);
  assert.equal(compareAnswer("schön", "schoen", {transliteration:true}).correct,true);
  assert.equal(compareAnswer("der Bahnhof", "Bahnhof", {}, ["Bahnhof"]).correct,true);
});
test("70 percent boundary includes omissions and penalizes extra and repeated words", () => {
  const target="one two three four five six seven eight nine ten";
  const pass=compareAnswer(target,"one two three four five six seven",flexible);
  assert.equal(pass.score,70);assert.equal(pass.correct,true);assert.equal(pass.words.filter(w=>w.kind==="missing").length,3);
  assert.equal(compareAnswer(target,"one two three four five six",flexible).correct,false);
  assert.equal(compareAnswer("one two three", "one two three extra extra",flexible).score,60);
  const repeat=compareAnswer("das ist das Haus","das ist Haus",flexible);
  assert.equal(repeat.score,75);assert.equal(repeat.words.filter(w=>w.kind==="missing").length,1);
  assert.equal(compareAnswer("one two three","one one one",flexible).correct,false);
});
test("small typos are accepted with visible corrections; short and unrelated terms stay strict", () => {
  const result=compareAnswer("Bahnhof", "Banhof",flexible);
  assert.equal(result.correct,true);assert.equal(result.words[0].kind,"replace");
  assert.equal(result.words[0].actual,"Banhof");assert.equal(result.words[0].expected,"Bahnhof");
  assert.equal(compareAnswer("cat","car",flexible).correct,false);
  assert.equal(compareAnswer("train","water",flexible).correct,false);
  assert.equal(compareAnswer("red blue green","green blue red",flexible).correct,false);
});
test("changed or missing negation fails even above the 70 percent threshold", () => {
  for(const [target,answer] of [["I am not ready","I am ready"],["Ich fahre nicht nach Hause","Ich fahre nach Hause"],["Tôi không đi đến trường","Tôi đi đến trường"],["I don't want to go home","I want to go home"],["I cannot go home today","I can go home today"]]) {
    const result=compareAnswer(target,answer,flexible);assert.equal(result.correct,false);assert.equal(result.negationMismatch,true);
  }
  assert.equal(compareAnswer("I do not go", "I do not go",flexible).correct,true);
});
test("empty and oversized responses cannot gain credit; Unicode remains canonical", () => {
  assert.equal(compareAnswer("word","",flexible).score,0);
  assert.equal(compareAnswer("","",flexible).correct,false);
  assert.equal(compareAnswer("Tôi đến trường","Tôi đến trường",flexible).score,100);
  assert.equal(compareAnswer("word","word ".repeat(1000),flexible).correct,false);
});
test("dictation hides the prompt and requires both independently graded answers", () => {
  const q=makeQuestion(card,"dictation",[card],"definition");
  assert.equal(q.prompt,"");assert.deepEqual(cardSolution(q),[card.german_text,card.vietnamese_meaning]);
  assert.equal(checkQuestion(q,{term:"Bahnhof",definition:"nhà ga xe lửa"}),true);
  assert.equal(checkQuestion(q,{term:"der Bahnhof",definition:""},flexible),false);
  const near=assessQuestion(q,{term:"der Banhof",definition:"nhà ga lửa"},flexible);
  assert.equal(near.term.correct,true);assert.equal(near.definition.score,75);assert.equal(near.correct,true);
  assert.equal(checkQuestion(q,{term:"der Bahnhof",definition:"nhà ga"},flexible),false);
});
test("dictation can be the only format and counts as written recall for mastery", () => {
  assert.equal(createTest([card],1,["dictation"],"random")[0].type,"dictation");
  let progress;
  for(let i=0;i<3;i++)progress=advanceProgress(progress,true,"dictation",i,"comprehensive");
  assert.equal(progress.written,true);assert.equal(progress.stage,"mastered");
});
test("flexible checking never changes choice, matching or true/false scoring", () => {
  assert.equal(checkQuestion({type:"choice",expected:"Bahnhof"},"Banhof",flexible),false);
  assert.equal(checkQuestion({type:"truefalse",truth:false},false,flexible),true);
});
