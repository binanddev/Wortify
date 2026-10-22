import test from "node:test";
import assert from "node:assert/strict";
import {draggedSelection,readDeckDrag,movableDecks,toggleVisibleSelection} from "../src/features/flashcards/library-management.js";
const decks=[{id:1,folder_id:2},{id:2,folder_id:null},{id:3,folder_id:2}];
test("dragging a selected deck moves the selection; an unselected deck moves alone",()=>{
  assert.deepEqual(draggedSelection(1,[1,3],decks),[1,3]);
  assert.deepEqual(draggedSelection(2,[1,3],decks),[2]);
  assert.deepEqual(draggedSelection(1,[1,999],decks),[1]);
});
test("foreign, malformed and cross-workspace drag payloads are ignored",()=>{
  const scope={language:"de",session:"local",decks};
  const data={language:"de",session:"local",ids:[1,3]};
  assert.deepEqual(readDeckDrag(JSON.stringify(data),scope),[1,3]);
  for(const invalid of ["not json",JSON.stringify({...data,ids:[999]}),JSON.stringify({...data,ids:[1,1]}),JSON.stringify({...data,ids:[true]}),JSON.stringify({...data,language:"en"}),JSON.stringify({...data,session:"other"})])assert.deepEqual(readDeckDrag(invalid,scope),[]);
});
test("same-folder moves are no-ops, including the library root",()=>{
  assert.deepEqual(movableDecks([1,2,3],decks,2),[2]);
  assert.deepEqual(movableDecks([1,2,3],decks,null),[1,3]);
  assert.deepEqual(movableDecks([2],decks,"all"),[]);
});
test("visible select-all preserves other checks, clear only removes visible rows and limit is 100",()=>{
  assert.deepEqual(toggleVisibleSelection([1],[2,3],true),[1,2,3]);
  assert.deepEqual(toggleVisibleSelection([1,2,3],[2],false),[1,3]);
  assert.equal(toggleVisibleSelection([],Array.from({length:120},(_,i)=>i+1),true).length,100);
});
