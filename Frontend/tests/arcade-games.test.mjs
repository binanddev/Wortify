import test from "node:test";
import assert from "node:assert/strict";
import { nextBridgeWord, reward } from "../src/features/flashcards/arcade-engine.js";
test("bridge accepts equivalent duplicate tiles but never reuses a collected tile", () => {
 const tokens = [{id:"0",text:"go"},{id:"1",text:"go"},{id:"2",text:"home"}];
 assert.equal(nextBridgeWord(tokens, [], "2"), false);
 assert.equal(nextBridgeWord(tokens, [], "1"), true);
 assert.equal(nextBridgeWord(tokens, ["1"], "1"), false);
 assert.equal(nextBridgeWord(tokens, ["1"], "0"), true);
 assert.equal(nextBridgeWord(tokens, ["1","0"], "2"), true);
 assert.equal(nextBridgeWord(tokens, ["1","0","2"], "missing"), false);
});
test("hints and misses lower rewards; combos are capped", () => {
 assert.equal(reward(0,0,0),100);
 assert.ok(reward(1,1,0) < reward(0,0,0));
 assert.equal(reward(0,0,5),reward(0,0,100));
 assert.ok(reward(5,40,0) >= 0);
});
