import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cardFields} from '../src/features/flashcards/card-fields.js';
import {flashcardAiGuide} from '../src/features/flashcards/flashcard-ai-guide.js';
test('card forms and copied examples share five ordinary fields',()=>{
 const fields=['german_text','vietnamese_meaning','example_german','example_vietnamese','part_of_speech'];
 assert.deepEqual(cardFields.map(f=>f.name),fields);
 assert.deepEqual(cardFields.filter(f=>f.isRequired).map(f=>f.name),fields.slice(0,2));
 assert.ok(cardFields.every(f=>!f.advanced));
 for(const lang of ['en','de']) {
  const examples=flashcardAiGuide(lang).match(/\{[^{}]+\}/g).map(JSON.parse);
  assert.equal(examples.length,3);
  for(const example of examples)assert.deepEqual(Object.keys(example),fields);
 }
});
