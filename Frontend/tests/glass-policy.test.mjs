import test from 'node:test';
import assert from 'node:assert/strict';
import {glassPolicy} from '../src/themes/glass/policy.js';
test('Glass fixes typography and geometry, clamps transparency without modifying Studio',()=>{
 const old={interface:'glass',textColor:'#000000',navScale:150,textSize:22,transparency:0};
 const fixed=glassPolicy(old);
 assert.equal(fixed.textColor,'#ffffff');assert.equal(fixed.navScale,100);assert.equal(fixed.textSize,18);assert.equal(fixed.transparency,10);
 assert.equal(glassPolicy({...old,transparency:200}).transparency,100);
 const studio={...old,interface:'studio'};assert.equal(glassPolicy(studio),studio);
});
