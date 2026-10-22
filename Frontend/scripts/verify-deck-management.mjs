import { build } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
process.chdir(path.resolve(import.meta.dirname, ".."));
const dir = path.resolve(".interface-preview");
const mobile = process.argv.includes("--mobile");
await fs.mkdir(dir, { recursive: true });
const entry = path.join(dir, "deck-management-check.jsx");
await fs.writeFile(
  entry,
  String.raw`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {HeroUIProvider} from '@heroui/react';import {Library} from '../src/features/flashcards/library.jsx';import {WindowContext} from '../src/lib/core.js';import {setLanguage,t as tr} from '../src/i18n/index.js';
const posts=[],destinations=[],receipts=new Map(),moves=new Map();let failCopy=false,nextId=40,nextCard=200;
let folders=[{id:1,name:'Lektion 2',parent_id:null},{id:2,name:'Lektion 3',parent_id:null},{id:3,name:'Unit',parent_id:1}];
let decks=[{id:11,title:'Travel',description:'Ways to get around',folder_id:2,count:1,mastered:1,level:'A2',visibility:'private'},{id:12,title:'Food',description:'',folder_id:2,count:1,mastered:0,level:'A1',visibility:'private'},{id:13,title:'Root only',description:'',folder_id:null,count:0,mastered:0,level:'A1',visibility:'private'}];
const cardMap={11:[{id:101,german_text:'bus',vietnamese_meaning:'xe buýt'}],12:[{id:102,german_text:'eat',vietnamese_meaning:'ăn'}],13:[]};
const response=data=>Response.json(data),wait=()=>new Promise(r=>setTimeout(r,180)),settle=async()=>{await wait();await wait();},assert=(v,m)=>{if(!v)throw Error(m)};
window.fetch=async(url,init={})=>{
 const path=new URL(url,'https://fixture.invalid').pathname,method=init.method||'GET',body=init.body?JSON.parse(init.body):{};if(method!=='GET')posts.push({path,method,body});
 if(path.endsWith('/decks/manage/')){
  await wait();if(receipts.has(body.request_id))return response(receipts.get(body.request_id));
  let ids=body.ids||[],result={operation_id:body.request_id,ids,count:ids.length,action:body.action,undoable:body.action==='move'};
  if(body.action==='move'){moves.set(body.request_id,ids.map(id=>({id,folder:decks.find(deck=>deck.id===id).folder_id})));decks=decks.map(deck=>ids.includes(deck.id)?{...deck,folder_id:body.folder}:deck);}
  if(body.action==='copy'){result.ids=ids.map(id=>{const source=decks.find(deck=>deck.id===id),copyId=nextId++;decks.push({...source,id:copyId,title:body.names[id],folder_id:body.folder,mastered:0});cardMap[copyId]=cardMap[id].map(card=>({...card,id:nextCard++}));return copyId;});}
  if(body.action==='delete')decks=decks.filter(deck=>!ids.includes(deck.id));
  if(body.action==='undo'){const original=moves.get(body.operation_id);assert(original,'Mock undo missing');decks=decks.map(deck=>{const item=original.find(item=>item.id===deck.id);return item?{...deck,folder_id:item.folder}:deck;});}
  receipts.set(body.request_id,result);if(failCopy&&body.action==='copy'){failCopy=false;throw TypeError('Connection interrupted.');}return response(result);
 }
 const folder=path.match(/\/folders\/(\d+)\//);
 if(path.endsWith('/folders/')&&method==='POST'){const id=nextId++;folders.push({id,name:body.name,parent_id:body.parent?Number(body.parent):null});return response({id});}
 if(folder&&method==='PATCH'){folders=folders.map(item=>item.id===Number(folder[1])?{...item,name:body.name,parent_id:body.parent?Number(body.parent):null}:item);return response({id:Number(folder[1])});}
 if(path.endsWith('/decks/')&&method==='POST'){const id=nextId++;decks.push({...body,id,folder_id:body.folder?Number(body.folder):null,count:0,mastered:0});cardMap[id]=[];return response({id});}
 const detail=path.match(/\/decks\/(\d+)\//),id=Number(detail?.[1]);
 if(path.endsWith('/cards/')&&method==='POST'){const card={...body,id:nextCard++};cardMap[id].push(card);decks=decks.map(deck=>deck.id===id?{...deck,count:cardMap[id].length}:deck);return response({id:card.id});}
 if(detail&&method==='PATCH'){decks=decks.map(deck=>deck.id===id?{...deck,...body,folder_id:body.folder?Number(body.folder):null}:deck);return response({deck:decks.find(deck=>deck.id===id)});}
 if(detail)return response({deck:decks.find(deck=>deck.id===id),cards:cardMap[id],folders,learning:{}});
 return response({folders,decks});
};
const root=createRoot(document.getElementById('root'));let setRoute;
function Harness(){const [route,navigate]=useState('/de/flashcard?folder=2');setRoute=navigate;return <HeroUIProvider><WindowContext.Provider value={{route,active:true,navigate:value=>{destinations.push(value);navigate(value);},get toolsTarget(){return document.getElementById('workspace-tools');}}}><Library lang='de' interfaceName='studio'/></WindowContext.Provider></HeroUIProvider>}
const button=(label,scope=document)=>{const el=[...scope.querySelectorAll('button')].find(el=>el.getAttribute('aria-label')===tr(label)||el.textContent.trim()===tr(label));assert(el,'Missing button: '+label);return el;};
const input=(label,scope=document)=>{const el=[...scope.querySelectorAll('label')].find(el=>el.querySelector(':scope > span')?.textContent.trim().replace(/\s*\*$/,'')===tr(label))?.querySelector('input,textarea,select');assert(el,'Missing field: '+label);return el;};
const value=(el,text)=>{const prototype=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(el,text);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));};
const dialog=()=>document.querySelector('[role=dialog]'),tile=id=>document.querySelector('[data-deck-id="'+id+'"]'),nav=id=>document.querySelector('[data-folder-id="'+id+'"]');
const openMenu=async(label,item)=>{button(label).focus();button(label).click();await settle();const choice=[...document.querySelectorAll('[role^=menuitem]')].find(el=>el.textContent.trim()===tr(item));assert(choice,'Missing menu action: '+item);choice.click();await settle();};
const drag=async(id,target,copy=false)=>{const data=new DataTransfer();tile(id).dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:data}));await wait();const row=nav(target);row.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,altKey:copy,dataTransfer:data}));await wait();assert(row.dataset.dropActive==='true','Drop target not highlighted');row.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,altKey:copy,dataTransfer:data}));await settle();await wait();};
(async()=>{
localStorage.clear();setLanguage('en');root.render(<Harness/>);await settle();await wait();
assert(document.querySelectorAll('.flash-deck-item').length===2&&!tile(13),'Library must show direct decks only');
if(location.hash){
 const theme=location.hash.slice(1);document.documentElement.dataset.interface=theme;setLanguage('vi');await settle();button('Manage decks').click();await wait();tile(11).querySelector('.deck-link').click();await wait();tile(11).querySelector('.deck-tile-actions button').click();await settle();
 const menu=document.querySelector('[role=menu]');assert(menu,'Theme action menu missing');assert(menu.textContent.includes(tr('Copy to folder')),'Translated copy action missing');assert(document.querySelector('[role=toolbar]'),'Theme management toolbar missing');
 const target=[...menu.querySelectorAll('span')].find(el=>!el.children.length&&el.textContent.trim()===tr('Open deck'))||menu;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
 const lum=rgb=>{const c=rgb.slice(0,3).map(v=>{v/=255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);});return c[0]*0.2126+c[1]*0.7152+c[2]*0.0722;};
 ctx.fillStyle='#ffffff';ctx.fillRect(0,0,1,1);ctx.fillStyle=getComputedStyle(document.body).backgroundColor;ctx.fillRect(0,0,1,1);ctx.fillStyle=getComputedStyle(document.querySelector('.flash-actions-menu')).backgroundColor;ctx.fillRect(0,0,1,1);const bg=lum([...ctx.getImageData(0,0,1,1).data]);ctx.clearRect(0,0,1,1);ctx.fillStyle=getComputedStyle(target).color;ctx.fillRect(0,0,1,1);const fg=lum([...ctx.getImageData(0,0,1,1).data]);assert((Math.max(bg,fg)+0.05)/(Math.min(bg,fg)+0.05)>=4.5,'Menu contrast below 4.5: '+theme);
 for(const row of document.querySelectorAll('.flash-folder-list .flash-tree-row'))assert(row.querySelector('.flash-root-folder > span,.flash-tree-folder > span')?.getBoundingClientRect().width>40,'Theme folder label collapsed');
 document.getElementById('result').textContent='PASS: '+theme+' translated menu, management toolbar, folder labels and readable contrast';return;
}

await openMenu('Deck actions: Travel','Edit deck');value(input('Deck name',dialog()),'Travel updated');await wait();button('Save changes',dialog()).click();await settle();assert(posts.some(post=>post.method==='PATCH'&&post.path.endsWith('/decks/11/')),'Edit must patch the selected deck');assert(tile(11).textContent.includes('Travel updated'),'Edited title not refreshed');
await openMenu('Folder actions: Lektion 3','Rename folder');value(input('Folder name',dialog()),'Lektion 3 edited');await wait();button('Save changes',dialog()).click();await settle();assert(nav(2).textContent.includes('Lektion 3 edited'),'Folder rename failed');
await openMenu('Folder actions: Lektion 3 edited','New subfolder');value(input('Folder name',dialog()),'New child');await wait();button('Save changes',dialog()).click();await settle();assert(document.querySelector('.flash-empty'),'New folder did not open');assert(posts.find(post=>post.path.endsWith('/folders/')&&post.body.parent==='2'),'Subfolder has wrong parent');setRoute('/de/flashcard?folder=2');await settle();
await openMenu('Sort decks','Title');assert(document.querySelector('.flash-deck-item').dataset.deckId==='12','Title sort failed');await openMenu('Sort decks','Recently updated');
await openMenu('Deck actions: Travel updated','Duplicate here');assert(decks.some(deck=>deck.title==='Travel updated (copy)'&&deck.folder_id===2&&deck.mastered===0),'Quick duplicate failed');
await openMenu('Folder actions: New child','Move folder');value(input('Trong folde',dialog()),'1');await wait();button('Save changes',dialog()).click();await settle();assert(folders.find(folder=>folder.name==='New child').parent_id===1,'Folder move failed');
await openMenu('Deck actions: Travel updated','Manage cards');assert(dialog()?.textContent.includes('bus'),'Card manager not loaded');button('Add card',dialog()).click();await settle();value(input('Vocabulary',dialog()),'train');value(input('Vietnamese meaning',dialog()),'tàu');await wait();button('Save changes',dialog()).click();await settle();assert(dialog()?.textContent.includes('train'),'New card missing from manager');button('Close',dialog()).click();await settle();assert(decks.find(deck=>deck.id===11).count===2,'Library card count stale');
await openMenu('Deck actions: Travel updated','Copy to folder');value(input('Deck name',dialog()),'Travel spare');value(input('Destination folder',dialog()),'1');await wait();button('Copy',dialog()).click();await settle();assert(decks.some(deck=>deck.title==='Travel spare'&&deck.folder_id===1&&deck.mastered===0),'Copy destination or independent progress failed');assert(tile(11),'Copy removed original');
const hoverData=new DataTransfer();tile(11).dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:hoverData}));await wait();nav(1).dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:hoverData}));await settle();await settle();assert(nav(3),'Hover did not expand target folder');nav(3).dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:hoverData}));await settle();assert(decks.find(deck=>deck.id===11).folder_id===3,'Drop into expanded child failed');button('Undo move').click();await settle();
await drag(11,1);assert(!tile(11)&&decks.find(deck=>deck.id===11).folder_id===1,'Drag move did not update source folder');button('Undo move').click();await settle();assert(tile(11)&&decks.find(deck=>deck.id===11).folder_id===2,'Move undo failed');assert(decks.find(deck=>deck.id===11).mastered===1,'Moving reset progress');
button('Manage decks').click();await wait();assert(document.querySelector('[role=toolbar]'),'Management toolbar missing');tile(11).querySelector('.deck-link').click();tile(12).querySelector('.deck-link').click();await wait();await drag(11,1,true);assert(posts.filter(post=>post.body.action==='copy').at(-1).body.ids.length===2,'Dragging selected group did not copy both');assert(tile(11)&&tile(12),'Copy group removed sources');
tile(11).querySelector('.deck-link').click();tile(12).querySelector('.deck-link').click();await wait();
await drag(11,1);assert(!tile(11)&&!tile(12),'Group move left sources in current folder');button('Undo move').click();await settle();assert(tile(11)&&tile(12),'Group undo did not restore both');
tile(11).querySelector('.deck-link').click();await wait();button('Move to folder',document.querySelector('[role=toolbar]')).click();await settle();assert(button('Move',dialog()).disabled,'Same-folder move should be disabled');value(input('Destination folder',dialog()),'1');await wait();button('Move',dialog()).click();await settle();assert(!tile(11),'Move dialog failed');button('Undo move').click();await settle();assert(tile(11),'Dialog move undo failed');
tile(11).querySelector('.deck-link').click();tile(12).querySelector('.deck-link').click();await wait();button('Export',document.querySelector('[role=toolbar]')).click();await settle();assert([...dialog().querySelectorAll('a')].every(link=>link.href.includes('/decks/export/')&&link.href.includes('11,12')),'Bulk export links incorrect');button('Close',dialog()).click();await settle();
const deletions=posts.filter(post=>post.body.action==='delete').length;tile(11).querySelector('.deck-link').dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true}));await settle();assert(dialog(),'Delete shortcut bypassed confirmation');button('Keep',dialog()).click();await settle();assert(posts.filter(post=>post.body.action==='delete').length===deletions,'Cancel deleted data');button('Cancel selection').click();await wait();
const before=decks.length;failCopy=true;await openMenu('Deck actions: Food','Copy to folder');value(input('Deck name',dialog()),'Food retry');value(input('Destination folder',dialog()),'1');await wait();button('Copy',dialog()).click();await settle();assert(dialog()?.textContent.includes('Connection interrupted.'),'Network failure not shown');button('Copy',dialog()).click();await settle();assert(decks.length===before+1,'Retry created duplicate copy');const retries=posts.filter(post=>post.body.action==='copy'&&post.body.names?.['12']==='Food retry');assert(retries.length===2&&retries[0].body.request_id===retries[1].body.request_id,'Copy retry changed operation ID');
await drag(12,'root');assert(!tile(12)&&decks.find(deck=>deck.id===12).folder_id===null,'Root drop failed');button('Undo move').click();await settle();
await openMenu('Deck actions: Food','Delete deck');button('Confirm deletion',dialog()).click();await settle();assert(!tile(12)&&tile(11),'Delete targeted wrong decks');
for(const language of ['vi','de','en']){setLanguage(language);await wait();assert(button('Manage decks'),'Translated management action missing');}setLanguage('vi');await wait();
assert(document.documentElement.scrollWidth<=Math.max(innerWidth,390)+1,'Library has horizontal overflow');
for(const row of document.querySelectorAll('.flash-folder-list .flash-tree-row')){const label=row.querySelector('.flash-root-folder > span,.flash-tree-folder > span');assert(label?.getBoundingClientRect().width>40,'Folder label collapsed');const trigger=row.querySelector('.flash-item-menu-trigger');assert(trigger.getBoundingClientRect().width<=48,'Folder menu consumed the full row');assert(getComputedStyle(trigger).borderTopWidth==='0px','Folder action still has a visible frame');}
const folderTrigger=nav(2).querySelector('.flash-folder-action');folderTrigger.focus();await wait();assert(getComputedStyle(folderTrigger).opacity==='1','Focused folder action is hidden');folderTrigger.click();await settle();assert(folderTrigger.getAttribute('aria-expanded')==='true'&&getComputedStyle(folderTrigger).opacity==='1','Open folder action is hidden');assert(document.querySelector('[role=menu]'),'Folder action menu did not open');
window.scrollTo(0,0);document.getElementById('result').textContent='PASS: sorting, duplication, folder move, hover expansion, deck/folder edits, nested creation, card management, group drag move/copy, root drop, guarded undo, dialogs, export, delete confirmation, retry UUID and translations';
})().catch(error=>document.getElementById('result').textContent='FAIL: '+error.message+' '+error.stack);`,
);
await build({
  configFile: false,
  plugins: [react()],
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    lib: {
      entry,
      name: "ImportApiCheck",
      formats: ["iife"],
      fileName: () => "deck-management-check.js",
    },
    outDir: dir,
    emptyOutDir: false,
  },
});
const assets = await fs.readdir("dist/assets");
let css = await fs.readFile(
  "dist/assets/" + assets.find((x) => /^(app|index)-.*\.css$/.test(x)),
  "utf8",
);
css = css.replaceAll(
  "/assets/",
  pathToFileURL(path.resolve("dist/assets")).href + "/",
);
const js = await fs.readFile(
  path.join(dir, "deck-management-check.js"),
  "utf8",
);
const file = path.join(dir, "deck-management.html");
await fs.writeFile(
  file,
  `<!doctype html><html data-interface="studio"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}
.fixture-review #workspace-tools,.fixture-review .page > :not(.work-paper){display:none!important}.fixture-review #fixture-layout{display:block!important}.fixture-review .page,.fixture-review .work-paper{margin:0!important;padding:16px!important}
</style><body style="width:${mobile ? 390 : 1440}px;max-width:100%;margin:0"><div id="fixture-layout" style="display:grid;grid-template-columns:${mobile ? "minmax(0,1fr)" : "260px minmax(0,1fr)"};gap:24px;padding:20px"><aside id="workspace-tools" style="background:var(--surface);padding:16px;border-radius:16px;min-width:0"></aside><div id="root" style="min-width:0"></div></div><pre id="result" hidden></pre><script>window.onerror=(m)=>document.getElementById("result").textContent="FAIL: "+m;</script><script>${js.replaceAll("</script", "<\/script")}</script></body></html>`,
);
for (const theme of process.argv.includes("--themes") ? ["studio","glass","xp","retro","notebook","rpg"] : [""]) {
const result = spawnSync(
  process.env.CHROME_PATH ||
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  [
    "--headless",
    "--disable-gpu",
    "--no-first-run",
    mobile ? "--window-size=390,844" : "--window-size=1440,1000",
    "--user-data-dir=" + path.join(dir, "chrome-deck-management-check"),
    "--virtual-time-budget=45000",
    "--dump-dom",
    "--screenshot=" +
      path.join(
        dir,
        theme ? `deck-management-preview-${theme}${mobile?"-mobile":""}.png` : mobile ? "deck-management-mobile.png" : "deck-management.png",
      ),
    pathToFileURL(file).href + (theme ? "#" + theme : ""),
  ],
  {
    encoding: "utf8",
    windowsHide: true,
    timeout: 60000,
    maxBuffer: 8 * 1024 * 1024,
  },
);
const match = result.stdout?.match(/<pre id="result"[^>]*>([^<]+)<\/pre>/);
if (!match?.[1].startsWith("PASS")) throw Error(match?.[1] || result.stderr);
console.log(match[1]);

}
