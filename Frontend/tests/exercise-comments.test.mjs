import test from "node:test";
import assert from "node:assert/strict";
import {visibleExerciseComments} from "../src/features/practice/exercise-comments.js";
import {parsePracticeText,exerciseToText} from "../src/features/practice/practice-text.js";
const exercise={presentation:{comment:"Shared note"}},questions=[{id:1,presentation:{explanation:"First"}},{id:2,presentation:{explanation:"Second"}}];
test("comments stay hidden until correct or reveal and matching reveals only completed pairs",()=>{
 const input={exercise,questions,mode:"matching"};
 assert.deepEqual(visibleExerciseComments(input),[]);
 assert.deepEqual(visibleExerciseComments({...input,answers:{1:"yes"}}).map(n=>n.text),["First"]);
 assert.equal(visibleExerciseComments({...input,correct:true}).length,3);
 assert.equal(visibleExerciseComments({...input,mode:"short_answer",revealed:true}).length,3);
 assert.deepEqual(visibleExerciseComments({...input,mode:"short_answer",answers:{1:"wrong"}}),[]);
});
test("exercise and per-pair comments round trip without loss",()=>{
 const source="EXERCISE: Match\nTYPE: matching\nCOMMENT: General\n> Next line\nQUESTION: Hello\nANSWER: Hallo\nEXPLANATION: A greeting\nQUESTION: Bye\nANSWER: Tschüss\nEXPLANATION: A farewell";
 const node=parsePracticeText(source).nodes[0];
 const again=parsePracticeText(exerciseToText({...node.payload,title:node.title})).nodes[0];
 assert.equal(again.payload.presentation.comment,"General\nNext line");
 assert.equal(again.payload.questions[1].presentation.explanation,"A farewell");
});
