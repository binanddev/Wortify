import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gradeExercise,gradeCard,normalize} from '../src/local-learning.js';
import {parseImport,jsonTemplate} from '../src/json-import.js';
import {EXERCISE_TYPES} from '../src/exercise-types.js';
import {request,clearContentCache} from '../src/core.js';
test('current JSON compatibility examples survive import and grade locally without fetch', () => {
 globalThis.fetch=()=>{throw new Error('Unexpected network');};
 for(const [mode] of EXERCISE_TYPES) {
  const e=parseImport(JSON.stringify(jsonTemplate('exercise',mode)),'exercise');
  const qs=e.questions.map((q,i)=>({...q,id:i+1,position:i+1,kind:e.kind}));
  const values={};
  for(const q of qs) if(q.blanks.length) q.blanks.forEach((b,i)=>values[`${q.id}_${i}`]=b.answers[0]);else values[q.id]=['multi','order'].includes(e.kind) ? q.accepted_answers : q.accepted_answers[0];
  const r=gradeExercise({...e,check_mode:'auto_check'},qs,values);
  assert.equal(r.score,r.total,mode);
 }
});
test('the full Practice Hub UX demo dataset imports and grades for every exercise type', () => {
 const demo=JSON.parse(readFileSync(new URL('../public/templates/practice-hub-demo.json',import.meta.url),'utf8'));
 assert.equal(demo.nodes.length,9);
 for(const entry of demo.nodes) {
  const e=parseImport(JSON.stringify(entry.payload),'exercise');
  assert.ok(e.questions.length>=3,entry.title);
  const qs=e.questions.map((q,i)=>({...q,id:String(i+1),position:i+1,kind:e.kind}));
  const values={};
  for(const q of qs) {
   if(q.blanks.length) q.blanks.forEach((b,i)=>values[`${q.id}_${i}`]=b.answers[0]);
   else values[q.id]=['multi','order'].includes(e.kind) ? q.accepted_answers : q.accepted_answers[0];
  }
  const result=gradeExercise({...e,check_mode:'auto_check'},qs,values);
  assert.equal(result.score,result.total,entry.title);
 }
});
test('normalization preserves accents, honors case and punctuation, supports German transliteration',()=>{
 assert.equal(normalize('  Hello, world! '),'hello world');
 assert.notEqual(normalize('schön'),normalize('schon'));
 assert.equal(gradeCard({mode:'write',target:'Straße',alternatives:[],grading:{transliteration:true}},'strasse').is_correct,true);
 assert.equal(gradeCard({mode:'write',target:'Hallo',grading:{ignore_case:false}},'hallo').is_correct,false);
});
test('multiple choice sets and examples',()=>{
 const e={kind:'multi',check_mode:'auto_check'};
 const qs=[{id:1,position:1,accepted_answers:['A','B'],presentation:{}},{id:2,example:true}];
 assert.equal(gradeExercise(e,qs,{1:['B','A']}).score,1);
 assert.equal(gradeExercise(e,qs,{1:['A','A']}).score,0);

});
test('imports append to the selected scope, strip model IDs and retain token IDs',()=>{
 const e=jsonTemplate('exercise','sentence_building');e.id=9;e.questions[0].id=8;
 const imported=parseImport(JSON.stringify(e),'exercise');
 assert.equal(imported.id,undefined);assert.equal(imported.questions[0].id,undefined);assert.equal(imported.questions[0].presentation.tokens[0].id,'a');
 assert.throws(()=>parseImport('{"title":"Broken","questions":{}}','exercise'));
});
test('content cache avoids repeated fetches and mutations invalidate it',async()=>{
 clearContentCache();let calls=0;globalThis.document={cookie:''};globalThis.fetch=async()=>({ok:true,json:async()=>({count:++calls})});
 assert.equal((await request('/api/en/practice-hub/nodes/1/')).count,1);
 assert.equal((await request('/api/en/practice-hub/nodes/1/')).count,1);
 await request('/api/en/practice-hub/nodes/1/','POST',{});
 assert.equal((await request('/api/en/practice-hub/nodes/1/')).count,3);
 clearContentCache();
});