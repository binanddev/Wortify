import test from 'node:test';
import assert from 'node:assert/strict';
import { profileNextStep } from '../src/features/account/profile-next-step.js';

test('a fresh learner discovers content in the selected language without invented lesson IDs', () => {
  for (const lang of ['en', 'de']) {
    assert.deepEqual(profileNextStep({decks: [], resume: null}, lang), {
      to: `/${lang}/flashcard/discover`, label: 'Discover',
    });
    assert.deepEqual(profileNextStep({decks: [{id: 78, total: 0, due: 0}], resume: null}, lang), {
      to: `/${lang}/flashcard/discover`, label: 'Discover',
    });
  }
});

test('newly imported content becomes a usable next step without prior learning history', () => {
  assert.deepEqual(profileNextStep({decks: [{id: 927, total: 3, due: 0}]}, 'de'), {
    to: '/de/flashcard/deck/927', label: 'Start learning',
  });
});

test('resume wins over suggestions and due cards point to the due deck', () => {
  const decks = [{id: 48, total: 5, due: 0}, {id: 132, total: 4, due: 2}];
  assert.deepEqual(profileNextStep({decks}, 'en'), {
    to: '/en/flashcard/deck/132', label: 'Review due cards',
  });
  assert.deepEqual(profileNextStep({decks, resume: '/en/flashcard/session/current'}, 'en'), {
    to: '/en/flashcard/session/current', label: 'Continue session',
  });
});


test('existing activity continues learning instead of restarting a learner with no due cards', () => {
  for (const activity of [
    {reviews: 1}, {sessions: 1}, {today_questions: 2}, {timeline: [{kind: 'practice'}]},
    {cards: {familiar: 1}}, {cards: {mastered: 1}},
  ]) {
    assert.deepEqual(profileNextStep({decks: [{id: 927, total: 3, due: 0}], ...activity}, 'de'), {
      to: '/de/flashcard/deck/927', label: 'Continue learning',
    });
  }
});
