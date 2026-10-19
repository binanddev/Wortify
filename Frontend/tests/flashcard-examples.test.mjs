import test from 'node:test';
import assert from 'node:assert/strict';
import {studyCards,isExample,sourceCardId,makeQuestion,checkQuestion,createTest,nextLearningCard,termProgress} from '../src/features/flashcards/flashcard-engine.js';
const cards=[1,2,3].map(id=>({id,german_text:`term ${id}`,vietnamese_meaning:`meaning ${id}`,example_german:`sentence ${id}`,example_vietnamese:`translation ${id}`,accepted_answers:['term alias']}));
const opts={includeExamples:true,exampleOrder:'after',exampleDirection:'front'};
test('examples are derived without changing the real cards; disabled mode has only terms',()=>{
 const before=structuredClone(cards), queue=studyCards(cards,opts);
 assert.deepEqual(queue.map(c=>c.id),[1,'example:1',2,'example:2',3,'example:3']);
 assert.deepEqual(cards,before);assert.deepEqual(studyCards(cards,{}),cards);
 assert.equal(sourceCardId(queue[1]),1);assert.equal(queue[1].german_text,cards[0].example_german);
 assert.deepEqual(queue[1].accepted_answers,[]);
});
test('incomplete sentence pairs are omitted',()=>{
 const queue=studyCards([{...cards[0],example_german:' '},{...cards[1],example_vietnamese:''},cards[2]],opts);
 assert.equal(queue.filter(isExample).length,1);
});
test('shuffling terms preserves attached examples; mixed mode can separate them',()=>{
 const grouped=studyCards(cards,{...opts,shuffle:true},()=>0);
 for(let i=0;i<grouped.length;i+=2)assert.equal(sourceCardId(grouped[i+1]),grouped[i].id);
 const mixed=studyCards(cards,{...opts,exampleOrder:'mixed'},()=>0);
 assert.equal(mixed.length,6);assert.equal(new Set(mixed.map(c=>c.id)).size,6);
 assert.notDeepEqual(mixed.map(c=>c.id),studyCards(cards,opts).map(c=>c.id));
});
test('sentence direction is independent from term direction for all question types',()=>{
 for(const direction of ['front','back']) {
 const queue=studyCards(cards,{...opts,exampleDirection:direction});
 for(const type of ['choice','written','truefalse','matching']) {
 const q=makeQuestion(queue[1],type,queue,'random',()=>0);
 assert.equal(q.prompt,direction==='front'?'sentence 1':'translation 1');
 assert.equal(q.expected,direction==='front'?'translation 1':'sentence 1');
 const answer=type==='truefalse'?q.truth:type==='matching'?Object.fromEntries(q.left.map(c=>[c.id,c.id])):q.expected;
 assert.equal(checkQuestion(q,answer),true);
 if(q.left)assert.ok(q.left.every(c=>c.id.startsWith('example:')));
 if(q.options)assert.ok(q.options.every(c=>!c.startsWith('term ')&&!c.startsWith('meaning ')));
 }
 }
});
test('tests include terms and examples in chosen sequence',()=>{
 const questions=createTest(cards,6,['written'],'term',()=>0,opts);
 assert.deepEqual(questions.map(q=>q.id),[1,'example:1',2,'example:2',3,'example:3']);
 assert.equal(questions[0].prompt,'meaning 1');assert.equal(questions[1].prompt,'sentence 1');
});
test('learning follows a term with its example even after term mastery',()=>{
 const queue=studyCards(cards,opts);
 assert.equal(nextLearningCard(queue,{1:{stage:'mastered'}},4,1,opts).id,'example:1');
 assert.equal(isExample(nextLearningCard(queue,{},5,'example:1',opts)),false);
});
test('only term progress is persisted and changed examples derive from the source',()=>{
 assert.deepEqual(termProgress({'1':{hits:2},'example:1':{hits:1}}),{'1':{hits:2}});
 assert.equal(studyCards([{...cards[0],example_german:'updated'}],opts)[1].german_text,'updated');
 assert.equal(studyCards([{...cards[0],example_vietnamese:''}],opts).length,1);
});
