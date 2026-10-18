import test from 'node:test';
import assert from 'node:assert/strict';
import { checkRecall } from '../src/features/flashcards/notebook-recall.js';
test('Notebook recall accepts aliases and correct articles, preserves umlauts', () => {
  const card = { german_text: 'Fähre', article: 'die', accepted_answers: ['Fährschiff'] };
  for (const answer of ['Fähre', ' DIE   FÄHRE! ', 'Fährschiff', 'Fa\u0308hre']) assert.equal(checkRecall(card, answer), true);
  for (const answer of ['', '!!!', 'Fahre', 'der Fähre', 'Schiff']) assert.equal(checkRecall(card, answer), false);
});
