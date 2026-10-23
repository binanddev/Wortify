import test from 'node:test';
import assert from 'node:assert/strict';
import {discoveryHistoryKey,discoveryHistory,rememberDiscovery,discoveryHistoryParams} from '../src/features/flashcards/discovery-history.js';

test('Flashcard history is separated by account, guest and language',()=>{
 const keys=[discoveryHistoryKey(1,'de'),discoveryHistoryKey(1,'en'),discoveryHistoryKey(2,'de'),discoveryHistoryKey(null,'de')];
 assert.equal(new Set(keys).size,4);
});
test('Search and folder history promote repeats without mutating input',()=>{
 const first=rememberDiscovery({}, {query:'  B1  ',folder:12},1);
 const second=rememberDiscovery(first,{query:'Travel',folder:13},2);
 const next=rememberDiscovery(second,{query:'b1',folder:12},3);
 assert.deepEqual(next.queries.map(row=>row.query),['b1','Travel']);
 assert.deepEqual(next.folders.map(row=>row.id),[12,13]);
 assert.deepEqual(first.folders,[{id:12,at:1}]);
 assert.deepEqual(discoveryHistoryParams(next),{recent:'["b1","Travel"]',recent_folders:'12,13'});
});
test('Malformed history is ignored and bounded; blank searches retain recent folders',()=>{
 assert.deepEqual(discoveryHistory({queries:[null],folders:[null,{id:'3',at:1},{id:-1,at:2},{id:1,at:'bad'}]}),{queries:[],folders:[]});
 const history=discoveryHistory({folders:Array.from({length:50},(_,i)=>({id:i+1,at:i}))});
 assert.equal(history.folders.length,30);
 assert.equal(rememberDiscovery(history,{query:'   '}).folders[0].id,50);
 assert.deepEqual(discoveryHistory({}),{queries:[],folders:[]});
});
