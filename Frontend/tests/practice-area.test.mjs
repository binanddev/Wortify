import test from 'node:test';
import assert from 'node:assert/strict';
import {practiceArea,practiceTabs,folderPage} from '../src/features/practice/practice-area.js';
import {windowKey,desktopReducer} from '../src/themes/windows-xp/desktop-state.js';
test('practice tabs preserve existing routes and share a Windows app',()=>{
 assert.deepEqual(practiceTabs('de').map(x=>x.path),['/de/practice/all','/de/explore','/de/create']);
 for(const section of ['practice','explore','create']){assert.ok(practiceArea(section));assert.equal(windowKey('/de/'+section),'practice');}
 assert.equal(practiceArea('flashcard'),false);
 let state={windows:[],active:null};state=desktopReducer(state,{type:'open',route:'/de/practice/733'});state=desktopReducer(state,{type:'open',route:'/de/explore'});
 assert.equal(state.windows.length,1);assert.equal(state.windows[0].route,'/de/explore');
});

test('folder pages show fifteen folders and clamp after filtering',()=>{
 const folders=Array.from({length:31},(_,id)=>({id,kind:'folder'}));
 const items=[{id:99,kind:'exercise'},...folders];
 assert.equal(folderPage(items).items.length,15);
 assert.deepEqual(folderPage(items,2).items.map(x=>x.id),folders.slice(15,30).map(x=>x.id));
 assert.equal(folderPage(items,3).items.length,1);
 assert.equal(folderPage(folders.slice(0,2),3).page,1);
 assert.deepEqual(folderPage([]).items,[]);
});
