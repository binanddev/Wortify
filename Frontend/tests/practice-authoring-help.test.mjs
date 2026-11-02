import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISE_TYPES, CREATABLE_EXERCISE_TYPES, newExercise } from '../src/features/practice/exercise-types.js';
import { parsePracticeText, exerciseToText, textTemplate, TEXT_GUIDE } from '../src/features/practice/practice-text.js';

test('matching examples can share a partner but practice pairs must stay unique', () => {
  const source='EXERCISE: Examples\nTYPE: matching\nSTYLE: tap_match\nQUESTION: example cat\nANSWER: animal\nEXAMPLE: yes\nQUESTION: cat\nANSWER: animal\nQUESTION: tree\nANSWER: plant';
  const exercise=parsePracticeText(source).nodes[0].payload;
  assert.deepEqual(exercise.questions[0].options,['animal','plant']);
  assert.deepEqual(parsePracticeText(exerciseToText(exercise)).nodes[0].payload,exercise);
  assert.throws(()=>parsePracticeText(source.replace('ANSWER: plant','ANSWER: animal')),/distinct answers/);
});

test('new creation choices exclude legacy TFNG while import, edit and export remain supported', () => {
  assert.equal(EXERCISE_TYPES.length, 9);
  assert.equal(CREATABLE_EXERCISE_TYPES.length, 8);
  assert.equal(CREATABLE_EXERCISE_TYPES.some(([type]) => type === 'true_false_not_given'), false);
  assert.equal(newExercise('true_false_not_given').presentation.interaction, 'true_false_not_given');
  const legacy = parsePracticeText(textTemplate('true_false_not_given')).nodes[0].payload;
  assert.deepEqual(parsePracticeText(exerciseToText(legacy)).nodes[0].payload, legacy);
  assert.equal(CREATABLE_EXERCISE_TYPES.find(([mode]) => mode === 'cloze_drag_drop')[1], 'Word bank gaps');
  assert.equal(CREATABLE_EXERCISE_TYPES.find(([mode]) => mode === 'inline_selection')[1], 'Choose words in sentences');
});

test('optional hints and distractor explanations round trip without changing the accepted answer', () => {
  const source = textTemplate('multiple_choice') + 'HINT: Think about an offer.\n> What could you order?\nDISTRACTOR_EXPLANATION: Yesterday refers to time.\n> At home refers to a place.\nEXPLANATION: Tea is a drink.\n';
  const exercise = parsePracticeText(source).nodes[0].payload;
  assert.equal(exercise.questions[0].presentation.hint, 'Think about an offer.\nWhat could you order?');
  assert.equal(exercise.questions[0].presentation.distractor_explanation, 'Yesterday refers to time.\nAt home refers to a place.');
  assert.deepEqual(exercise.questions[0].accepted_answers, ['Tea, please.']);
  assert.deepEqual(parsePracticeText(exerciseToText(exercise)).nodes[0].payload, exercise);
});

test('optional author help validates duplicates and limits including continuation lines', () => {
  const source = textTemplate('multiple_choice');
  assert.throws(() => parsePracticeText(source + 'HINT: one\nHINT: two'), /HINT is duplicated/);
  assert.throws(() => parsePracticeText(source + 'DISTRACTOR_EXPLANATION: one\nDISTRACTOR_EXPLANATION: two'), /DISTRACTOR_EXPLANATION is duplicated/);
  assert.throws(() => parsePracticeText(source + 'HINT: ' + 'x'.repeat(3999) + '\n> x'), /HINT must contain/);
  assert.throws(() => parsePracticeText(source + 'DISTRACTOR_EXPLANATION: ' + 'x'.repeat(12001)), /DISTRACTOR_EXPLANATION must contain/);
  assert.doesNotThrow(() => parsePracticeText(source + 'HINT: ' + 'x'.repeat(4000)));
  const question = parsePracticeText(source).nodes[0].payload.questions[0];
  assert.equal(question.presentation.hint, undefined);
  assert.equal(question.presentation.distractor_explanation, undefined);
});


test('correction templates declare the exact operation required by their sample answer', () => {
  const edit = parsePracticeText(textTemplate('error_correction', 'click_edit')).nodes[0].payload;
  assert.match(edit.instruction, /Correct exactly one incorrect word/);
  const before = edit.questions[0].prompt.split(' '), after = edit.questions[0].accepted_answers[0].split(' ');
  assert.equal(before.length, after.length);
  assert.equal(before.filter((word, index) => word !== after[index]).length, 1);
  const remove = parsePracticeText(textTemplate('error_correction', 'cross_out')).nodes[0].payload;
  assert.match(remove.instruction, /Remove exactly one extra word/);
  assert.equal(remove.questions[0].prompt.split(' ').length - remove.questions[0].accepted_answers[0].split(' ').length, 1);
});

test('authoring instructions distinguish tasks and describe the actual feedback and storage contract', () => {
  for (const [mode, verb] of [['matching', /Match/], ['categorization', /category/], ['multiple_choice', /Choose/], ['cloze_drag_drop', /word bank/], ['inline_selection', /within the sentence/], ['short_answer', /present perfect/]]) {
    const exercise = parsePracticeText(textTemplate(mode)).nodes[0].payload;
    assert.match(exercise.instruction, verb, mode);
  }
  assert.match(TEXT_GUIDE, /HINT: optional clue available after a first incorrect attempt/);
  assert.match(TEXT_GUIDE, /Open Exercise settings to choose Practice or Self-check/);
  assert.match(TEXT_GUIDE, /save submitted answers and server-graded results/);
  assert.doesNotMatch(TEXT_GUIDE, /progress rather than scores|clue before answering/);
});
