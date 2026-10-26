import test from "node:test";
import assert from "node:assert/strict";
import {matchReadingDrafts} from "../src/features/reading/reading-authoring.js";
const node=(title,context)=>({title,payload:{title,context,presentation:{interaction:"reading"},questions:[]}});
test("reordering duplicate reading titles keeps media with its original passage",()=>{
 const before=[node("Same","Bus"),node("Same","Train")];
 assert.deepEqual(matchReadingDrafts([before[1],before[0]],before),[1,0]);
});
test("ambiguous duplicate titles and passages require reassignment",()=>{
 const before=[node("Same","Bus"),node("Same","Bus")];
 assert.deepEqual(matchReadingDrafts([...before].reverse(),before),[-1,-1]);
 const changed=[node("Same","Train"),node("Same","Train")];
 assert.deepEqual(matchReadingDrafts(changed,[node("Same","Bus"),node("Same","Train")]),[-1,-1]);
});
test("a unique title retains media when reading questions or passage are edited",()=>{
 assert.deepEqual(matchReadingDrafts([node("One","New"),node("Two","Text")],[node("One","Old"),node("Two","Text")]),[0,1]);
});
test("single reading renaming preserves the draft identity",()=>{
 assert.deepEqual(matchReadingDrafts([node("Renamed","New")],[node("Before","Old")]),[0]);
});
test("different passages retain identities across batch renaming and reordering",()=>{
 assert.deepEqual(matchReadingDrafts([node("New B","Train"),node("New A","Bus")],[node("A","Bus"),node("B","Train")]),[1,0]);
});
