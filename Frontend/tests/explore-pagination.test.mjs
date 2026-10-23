import test from "node:test";
import assert from "node:assert/strict";
import {explorePage,exploreScope,explorePageUrl,explorePageNumbers,EXPLORE_PAGE_SIZE} from "../src/features/explore/explore-pagination.js";
test("discovery matches the 12-result API and rejects invalid page values",()=>{
 assert.equal(EXPLORE_PAGE_SIZE,12);
 for(const value of [null,"",0,-1,"bad","2x",1.5,Infinity,Number.MAX_SAFE_INTEGER+1]) assert.equal(explorePage(value),1);
 assert.equal(explorePage("3"),3);
});
test("paging keeps the same discovery scope and ranking seed without losing search or folder filters",()=>{
 const params = new URLSearchParams("q=travel&mode=short_answer&sort=newest&folder=42");
 const first = explorePageUrl("/de/explore",params,1,"fixed");
 const third = explorePageUrl("/de/explore",params,3,"fixed");
 assert.equal(exploreScope(first),exploreScope(third));
 assert.equal(new URLSearchParams(third.split("?")[1]).get("page"),"3");
 assert.equal(new URLSearchParams(third.split("?")[1]).get("seed"),"fixed");
 assert.equal(new URLSearchParams(third.split("?")[1]).get("folder"),"42");
 assert.notEqual(exploreScope(first),exploreScope("/de/explore?q=other"));
 assert.equal(params.has("page"),false);
});
test("numbered pages stay bounded and include the current page at either edge",()=>{
 for(const pages of [1,2,5,6,100]) for(let page=1;page<=pages;page++) {
  const numbers=explorePageNumbers(page,pages);
  assert.ok(numbers.includes(page));assert.ok(numbers.length<=5);
  assert.ok(numbers.every(n=>n>=1&&n<=pages));assert.equal(new Set(numbers).size,numbers.length);
 }
 assert.deepEqual(explorePageNumbers(1,7),[1,2,3,4,5]);
 assert.deepEqual(explorePageNumbers(7,7),[3,4,5,6,7]);
});
