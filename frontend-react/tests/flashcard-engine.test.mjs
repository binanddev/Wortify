import test from 'node:test';
import assert from 'node:assert/strict';
import {makeQuestion,checkQuestion,advanceProgress,nextLearningCard,createTest} from '../src/flashcard-engine.js';
const cards = ['one','two','three','four'].map((word,i)=>({id:i+1,german_text:word,vietnamese_meaning:`meaning ${i}`,accepted_answers:[]}));
test('every test format evaluates locally in both directions',()=>{
  for(const direction of ['term','definition']) for(const type of ['choice','written','truefalse','matching']) {
    const q=makeQuestion(cards[0],type,cards,direction);
    const answer=type==='truefalse'?q.truth:type==='matching'?Object.fromEntries(q.left.map(l=>[l.id,l.id])):q.expected;
    assert.equal(checkQuestion(q,answer),true);
    assert.equal(checkQuestion(q,undefined),false);
  }
});
test('test respects selected types and caps unique cards',()=>{
  const questions=createTest(cards,100,['written'],'definition');
  assert.equal(questions.length,4);
  assert.equal(new Set(questions.map(q=>q.id)).size,4);
  assert.ok(questions.every(q=>q.type==='written'));
  assert.throws(()=>createTest(cards,3,[],'term'));
});
test('comprehensive mastery requires writing and errors return sooner',()=>{
  let progress;
  for(let i=0;i<3;i++)progress=advanceProgress(progress,true,'choice',i,'comprehensive');
  assert.equal(progress.stage,'familiar');
  progress=advanceProgress(progress,true,'written',3,'comprehensive');
  assert.equal(progress.stage,'mastered');
  const wrong=advanceProgress(progress,false,'written',4,'comprehensive');
  assert.equal(wrong.due,5);
  assert.equal(wrong.streak,0);
  assert.equal(nextLearningCard(cards,{1:progress},0).id,2);
});
