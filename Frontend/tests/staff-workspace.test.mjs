import test from "node:test";
import assert from "node:assert/strict";
import {configureStaffWorkspace,staffWorkspace,selectStaffWorkspace} from "../src/lib/staff-workspace.js";
import {request,clearContentCache} from "../src/lib/request.js";
const store=new Map();
globalThis.sessionStorage={getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value)};
globalThis.document={cookie:"csrftoken=test"};

test("staff defaults to shared; sandbox is isolated by account and cannot grant user rights",()=>{
 configureStaffWorkspace({id:101,staff:true});assert.equal(staffWorkspace(),"shared");
 selectStaffWorkspace("personal");assert.equal(staffWorkspace(),"personal");
 configureStaffWorkspace({id:102,staff:true});assert.equal(staffWorkspace(),"shared");
 configureStaffWorkspace({id:101,staff:true});assert.equal(staffWorkspace(),"personal");
 configureStaffWorkspace({id:101,staff:false});assert.equal(staffWorkspace(),null);
});

test("content headers retain the loaded deck revision when a background request sees newer content",async()=>{
 configureStaffWorkspace({id:103,staff:true});clearContentCache();
 const calls=[];
 globalThis.fetch=async(path,options)=>{calls.push({path,...options});return new Response(JSON.stringify({ok:true}),{headers:{"Content-Type":"application/json","X-Wortify-Revision":path.includes("/1/")?"old":"new"}});};
 await request("/api/de/decks/1/");
 await request("/api/de/decks/2/");
 await request("/api/de/decks/1/cards/4/","PATCH",{german_text:"Bus"});
 assert.equal(calls.at(-1).headers["X-Wortify-Revision"],"old");
 assert.equal(calls.at(-1).headers["X-Wortify-Workspace"],"shared");
 assert.equal(calls.at(-1).headers["X-CSRFToken"],"test");
 selectStaffWorkspace("personal");
 await request("/api/de/decks/1/cards/4/","PATCH",{german_text:"Test"});
 assert.equal(calls.at(-1).headers["X-Wortify-Workspace"],"personal");
 assert.equal(calls.at(-1).headers["X-Wortify-Revision"],undefined);
 configureStaffWorkspace(null);
});
