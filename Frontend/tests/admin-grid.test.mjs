import test from 'node:test';
import assert from 'node:assert/strict';
import {toggleSort,sortQuery} from '../src/features/admin/grid-state.js';
test('Shift sorting preserves priority and regular clicks replace sort',()=>{
 let sort=toggleSort([],'role');sort=toggleSort(sort,'date_joined',true);
 assert.equal(sortQuery(sort),'role,date_joined');
 sort=toggleSort(sort,'role',true);assert.equal(sortQuery(sort),'-role,date_joined');
 assert.equal(sortQuery(toggleSort(sort,'username')),'username');
});
