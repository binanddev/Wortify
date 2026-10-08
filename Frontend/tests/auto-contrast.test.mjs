import test from 'node:test';
import assert from 'node:assert/strict';
import {luminance,readableInk} from '../src/features/appearance/auto-contrast.js';
import {exerciseSolution} from '../src/features/learning/skip-learning.js';
test('automatic foreground meets 4.5:1 contrast on light, dark and saturated surfaces',()=>{
  for(const rgb of [[255,255,255],[0,0,0],[37,41,79],[222,220,255],[255,0,0],[0,180,90],[128,128,128]]) {
    const l=luminance(rgb), white=readableInk(rgb)==='#ffffff';
    assert.ok((white?1.05/(l+.05):(l+.05)/.05)>=4.5);
  }
});
test('repeated accepted corrections appear once in revealed solutions',()=>{
  assert.deepEqual(exerciseSolution({kind:'text'},{id:1,accepted_answers:['Ich lerne.','Ich lerne.']}),['Ich lerne.']);
});
