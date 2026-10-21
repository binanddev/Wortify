import test from "node:test";
import assert from "node:assert/strict";
import {searchImages} from "../src/features/flashcards/image-search.js";
globalThis.DOMParser=class {parseFromString(value){return {body:{textContent:value.replace(/<[^>]*>/g,"")}}}};
const image={title:"File:Cat.jpg",imageinfo:[{mime:"image/jpeg",thumburl:"https://upload.wikimedia.org/cat.jpg",descriptionurl:"https://commons.wikimedia.org/wiki/File:Cat.jpg",extmetadata:{LicenseShortName:{value:"CC0"}}}]};
test("exact language concept image is preferred and cached",async()=>{
 const calls=[];globalThis.fetch=async url=>{calls.push(String(url));return Response.json({query:{pages:{one:calls.length===1?{pageimage:"Cat.jpg"}:image}}});};
 assert.equal((await searchImages("die Katze",{language:"de"})).length,1);
 assert.match(calls[0],/de.wikipedia.org/);assert.equal(new URL(calls[0]).searchParams.get("titles"),"Katze");
 assert.equal(new URL(calls[1]).searchParams.get("titles"),"File:Cat.jpg");
 await searchImages("die Katze",{language:"de"});assert.equal(calls.length,2);
});
test("disambiguation uses the saved Vietnamese meaning instead",async()=>{
 const calls=[];globalThis.fetch=async url=>{calls.push(String(url));return Response.json({query:{pages:{one:calls.length===1?{pageimage:"Wrong.jpg",pageprops:{disambiguation:""}}:calls.length===2?{pageimage:"Cat.jpg"}:image}}});};
 await searchImages("bank",{language:"en",meaning:"ngân hàng; bờ sông"});
 assert.match(calls[1],/vi.wikipedia.org/);assert.equal(new URL(calls[1]).searchParams.get("titles"),"ngân hàng");assert.equal(calls.length,3);
});
test("fallback searches file titles rather than unrelated descriptions",async()=>{
 const calls=[];globalThis.fetch=async url=>{calls.push(String(url));return Response.json({query:{pages:calls.length===1?{}:{one:image}}});};
 await searchImages("swimming",{language:"en"});assert.equal(new URL(calls[1]).searchParams.get("gsrsearch"),'intitle:"swimming" filetype:bitmap');
});
test("rate limits stop retries and failed requests are not cached",async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;return new Response("",{status:429});};
 await assert.rejects(searchImages("rate limited"),e=>e.rateLimited===true);assert.equal(calls,1);
 await assert.rejects(searchImages("rate limited"),e=>e.rateLimited===true);assert.equal(calls,2);
});
