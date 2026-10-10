import test from 'node:test';
import assert from 'node:assert/strict';
import {gradeExercise} from '../src/features/learning/local-learning.js';
import {newExercise,exerciseStylesOf} from '../src/features/practice/exercise-types.js';
test('new choice styles use the existing answer checking contract',()=>{
 for(const mode of ['multiple_choice','true_false_not_given']) {
 const e=newExercise(mode);assert.equal(e.kind,'choice');assert.ok(exerciseStylesOf(mode).length);
 const q={id:1,kind:'choice',prompt:'Test',options:['TRUE','FALSE','NOT_GIVEN'],accepted_answers:['NOT_GIVEN']};
 assert.equal(gradeExercise(e,[q],{'1':'NOT_GIVEN'}).score,1);
 assert.equal(gradeExercise(e,[q],{'1':'FALSE'}).score,0);
 assert.equal(gradeExercise(e,[q],{}).score,0);
 }
});

import {shuffleChoices} from '../src/features/practice/choice-order.js';
test('shuffled choices preserve content and grade by text rather than position',()=>{
 const source=['correct','wrong','other'];
 const mixed=shuffleChoices(source,()=>0);
 assert.deepEqual(source,['correct','wrong','other']);
 assert.notEqual(mixed[0],'correct');
 assert.deepEqual([...mixed].sort(),[...source].sort());
 const e=newExercise('multiple_choice');
 const q={id:1,kind:'choice',options:mixed,accepted_answers:['correct']};
 assert.equal(gradeExercise(e,[q],{'1':'correct'}).score,1);
 assert.equal(gradeExercise(e,[q],{'1':mixed[0]}).score,0);
 const positions=new Set([0,.4,.8].map(random=>shuffleChoices(source,()=>random).indexOf('correct')));
 assert.equal(positions.size,3);
});
