import test from 'node:test';
import assert from 'node:assert/strict';
import {ActiveClock} from '../src/active-clock.js';
test('answer clock excludes paused time and repeated visibility events',()=>{
  let now=100;const clock=new ActiveClock(()=>now);
  clock.resume();now=1100;assert.equal(clock.read(),1000);
  clock.pause();now=10000;assert.equal(clock.read(),1000);
  clock.pause();clock.resume();clock.resume();now=11000;
  assert.equal(clock.read(),2000);clock.pause();assert.equal(clock.read(),2000);
});
