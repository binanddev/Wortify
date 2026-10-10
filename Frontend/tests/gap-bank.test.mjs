import test from 'node:test';
import assert from 'node:assert/strict';
import {sharedGapQuestions,questionWordBank} from '../src/features/practice/gap-bank.js';
test('all sentences receive the full bank including final-question distractors',()=>{
 const source=[{blanks:[{answers:['auf']},{answers:['den']}]},{blanks:[{answers:['den']},{answers:['den']}],presentation:{word_bank:['auf','den','den','mit']}}];
 const result=sharedGapQuestions(source);
 assert.deepEqual(result[0].presentation.word_bank,['auf','den','den','mit']);
 assert.deepEqual(result[1].presentation.word_bank,result[0].presentation.word_bank);
 assert.equal(source[0].presentation,undefined);
 assert.deepEqual(questionWordBank(result[0]),result[0].presentation.word_bank);
});
test('accepted alternatives and imported banks survive rebuilding and examples are excluded',()=>{
 const result=sharedGapQuestions([{blanks:[{answers:['a','b']}],presentation:{word_bank:['a','extra']}},{example:true,blanks:[{answers:['example']}]}]);
 assert.deepEqual(result[0].presentation.word_bank,['a','extra','b']);
});
