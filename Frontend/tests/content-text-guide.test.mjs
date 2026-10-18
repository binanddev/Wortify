import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {contentTextGuide,contentTextExample} from '../src/features/admin/content-text-guide.js';
import {EXERCISE_TYPES,exerciseStylesOf} from '../src/features/practice/exercise-types.js';
test('deployed rules and examples stay aligned with the UI guide',()=>{
 for(const base of ['../public/templates/','../../Backend/sample_data/']) {
  assert.equal(readFileSync(new URL(base+'content-authoring.txt',import.meta.url),'utf8'),contentTextGuide());
  assert.equal(readFileSync(new URL(base+'content-package.txt',import.meta.url),'utf8'),contentTextExample);
 }
});
test('backend parser parity fixtures cover every current editor type and style',()=>{
 const fixtures=JSON.parse(readFileSync(new URL('../../Backend/sample_data/content-text-cases.json',import.meta.url),'utf8'));
 const expected=[...EXERCISE_TYPES.map(([mode])=>mode),'reading'].flatMap(mode=>exerciseStylesOf(mode).map(([style])=>mode+'/'+style));
 assert.deepEqual(fixtures.map(f=>f.mode+'/'+f.style),expected);
});
