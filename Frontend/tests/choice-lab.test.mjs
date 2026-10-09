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
