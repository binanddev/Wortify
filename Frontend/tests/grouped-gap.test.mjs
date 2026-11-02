import test from 'node:test';
import assert from 'node:assert/strict';
import {groupGapQuestions, groupedWordBank, allocateGroupedGapTokens, groupedGapMove} from '../src/features/practice/gap-bank.js';
const question = (id, words) => ({id, blanks: words.map(word=>({answers:[word]}))});
const tokens = words => words.map((text,index)=>({id:String(index),text}));

test('group bank supplies repeated answer words across different questions without multiplying repeated authored banks',()=>{
 const questions=[question(1,['the']),question(2,['the'])].map(q=>({...q,presentation:{word_bank:['the','the','unused']}}));
 assert.deepEqual(groupedWordBank(questions),['the','the','unused']);
 assert.deepEqual(groupedWordBank([question(1,['the']),question(2,['the'])]),['the','the']);
});
test('group allocation consumes each repeated token once across question IDs',()=>{
 const questions=[question(11,['a']),question(12,['a','b'])];
 const state=allocateGroupedGapTokens(tokens(['a','a','b']),{'11_0':'a','12_0':'a'},questions);
 assert.notEqual(state.slots['11_0'].id,state.slots['12_0'].id);
 assert.equal(state.slots['12_1'],null);
 assert.deepEqual(state.bank.map(token=>token.text),['b']);
});
test('group movement swaps across questions, returns to bank and protects correct source and target',()=>{
 const [a,b]=tokens(['a','b']);
 const slots={'1_0':a,'2_0':b,'3_0':null};
 assert.deepEqual(groupedGapMove(slots,a,'2_0'),[['1_0','b'],['2_0','a']]);
 assert.deepEqual(groupedGapMove(slots,a,null),[['1_0','']]);
 assert.deepEqual(groupedGapMove(slots,a,'2_0',new Set(['2_0'])),[]);
 assert.deepEqual(groupedGapMove(slots,a,null,new Set(['1_0'])),[]);
 assert.deepEqual(groupedGapMove(slots,a,'missing'),[]);
 assert.deepEqual(groupedGapMove(slots,a,'1_0'),[]);
});
test('replacing from bank returns displaced token while keeping independent duplicate allocations',()=>{
 const questions=[question(1,['a']),question(2,['a']),question(3,['b'])], chips=tokens(['a','a','b']);
 const answers={'1_0':'a','2_0':'a'};
 const state=allocateGroupedGapTokens(chips,answers,questions);
 const changes=groupedGapMove(state.slots,state.bank[0],'1_0');
 const after=allocateGroupedGapTokens(chips,{...answers,...Object.fromEntries(changes)},questions);
 assert.equal(after.slots['1_0'].text,'b');
 assert.equal(after.slots['2_0'].text,'a');
 assert.deepEqual(after.bank.map(token=>token.text),['a']);
});
test('grouping excludes examples and preserves question IDs and final partial group',()=>{
 const questions=Array.from({length:14},(_,index)=>question(index+1,['x']));
 const groups=groupGapQuestions([{id:0,example:true},...questions]);
 assert.deepEqual(groups.map(group=>group.length),[6,6,2]);
 assert.deepEqual(groups.flat(),questions);
 assert.deepEqual(groupGapQuestions(questions,8).map(group=>group.length),[8,6]);
});
