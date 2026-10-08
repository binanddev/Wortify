import test from 'node:test';import assert from 'node:assert/strict';import {desktopReducer as reduce} from '../src/themes/windows-xp/desktop-state.js';
test('Windows apps keep independent routes through focus, minimize and relaunch',()=>{
 let s=reduce({active:null,windows:[]},{type:'open',route:'/de/flashcard/deck/4'});
 s=reduce(s,{type:'open',route:'/de/practice/597'});s=reduce(s,{type:'open',route:'/de/settings'});
 assert.equal(s.windows.length,3);
 s=reduce(s,{type:'open',route:'/de/flashcard'});assert.equal(s.windows.at(-1).route,'/de/flashcard/deck/4');
 s=reduce(s,{type:'minimize',id:'flashcard'});assert.equal(s.active,'settings');
 s=reduce(s,{type:'navigate',id:'practice',route:'/de/practice/598'});assert.equal(s.active,'settings');assert.equal(s.windows.find(w=>w.id==='practice').route,'/de/practice/598');
 s=reduce(s,{type:'focus',id:'flashcard'});assert.equal(s.windows.at(-1).minimized,false);assert.equal(s.windows.at(-1).route,'/de/flashcard/deck/4');
 s=reduce(s,{type:'close',id:'flashcard'});assert.equal(s.windows.length,2);assert.equal(s.active,'settings');
});
