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
const entry = path.join(dir, "practice-navigation-check.jsx");
await fs.writeFile(
  entry,
  String.raw`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {HeroUIProvider} from '@heroui/react';import PracticeArea from '../src/features/practice/PracticeArea.jsx';import {PracticeHub} from '../src/features/practice/practice-hub.jsx';import {ExerciseStudio} from '../src/features/practice/exercise-studio.jsx';import {WindowContext} from '../src/lib/core.js';import {setLanguage,t as tr} from '../src/i18n/index.js';
let nodes=[{id:1,parent:null,kind:'folder',title:'Travel'},{id:2,parent:1,kind:'theory',title:'Bus lesson',payload:{format:'markdown',content:'Unique bus lesson'}},{id:3,parent:1,kind:'folder',title:'Unit'},{id:4,parent:3,kind:'theory',title:'Nested lesson',payload:{format:'markdown',content:'Unique nested lesson'}},{id:5,parent:null,kind:'folder',title:'Other'},{id:6,parent:5,kind:'theory',title:'Other lesson',payload:{format:'markdown',content:'Other lesson content'}},{id:9,parent:null,kind:'theory',title:'Standalone',payload:{format:'markdown',content:'Standalone content'}}].map(n=>({...n,can_edit:true,position:n.id,updated_at:'1',links:[],visibility:'private'}));
nodes.push({id:99,parent:null,kind:'folder',title:'Public only',can_edit:false,position:99,updated_at:'1',links:[],visibility:'public'});
const calls=[],posts=[];let next=20;const wait=()=>new Promise(r=>setTimeout(r,180)),settle=async()=>{await wait();await wait();},assert=(v,m)=>{if(!v)throw Error(m)};
window.fetch=async(url,init={})=>{calls.push(url);const method=init.method||'GET',body=init.body?JSON.parse(init.body):{},path=new URL(url,'https://fixture.invalid').pathname;const match=path.match(/\/nodes\/(\d+)\//),id=Number(match?.[1]);if(method!=='GET')posts.push({path,method,body});
if(path.endsWith('/import/')){const created=body.nodes.map(item=>{const node={...item,id:next++,parent:body.parent,can_edit:true,position:next,updated_at:'1',links:[],visibility:'private'};nodes.push(node);return node.id;});return Response.json({created});}
if(path.endsWith('/organize/')){if(body.action==='delete'){const removed=new Set(body.ids);let changed=true;while(changed){changed=false;for(const n of nodes)if(removed.has(n.parent)&&!removed.has(n.id)){removed.add(n.id);changed=true;}}nodes=nodes.filter(n=>!removed.has(n.id));}else nodes=nodes.map(n=>body.ids.includes(n.id)?{...n,parent:body.parent}:n);return Response.json({ok:true});}
if(match){if(method==='PATCH')nodes=nodes.map(n=>n.id===id?{...n,...body}:n);return Response.json({node:nodes.find(n=>n.id===id)});}
if(method==='POST'&&path.endsWith('/nodes/')){const node={...body,id:next++,can_edit:true,position:next,updated_at:'1',links:[]};nodes.push(node);return Response.json({node});}
return Response.json({nodes:nodes.map(n=>url.includes('full=1')?n:({...Object.fromEntries(Object.entries(n).filter(([key])=>key!=='payload')),interaction:n.payload?.presentation?.interaction||n.interaction}))});};
let navigate,studio;function Harness(){const [route,setRoute]=useState('/de/practice/all');const section=route.split('/')[2]||'practice',mode=section==='create';navigate=setRoute;studio=()=>setRoute('/de/create/1');const id=route.match(/\/(?:practice|create)\/(\d+)/)?.[1]||'all';return <HeroUIProvider disableAnimation><WindowContext.Provider value={{route,active:true,navigate:setRoute,get toolsTarget(){return document.getElementById('workspace-tools');}}}><PracticeArea lang='de' section={section}>{mode?<ExerciseStudio lang='de' id={id==='all'?undefined:id}/>:<PracticeHub lang='de' id={id} userId={1} sound={false}/>}</PracticeArea></WindowContext.Provider></HeroUIProvider>}
const button=(label,scope=studioScope())=>{const el=[...scope.querySelectorAll('button')].find(el=>el.getAttribute('aria-label')===tr(label)||el.textContent.trim()===tr(label));assert(el,'Missing button: '+label);return el;};
const studioScope=()=>document.querySelector('[data-practice-studio]')||document;
const folder=name=>{const el=[...studioScope().querySelectorAll('.flash-tree-folder')].find(el=>el.textContent.trim()===name);assert(el,'Missing folder: '+name);return el;};
const dialog=()=>[...document.querySelectorAll('[role=dialog].app-modal')].at(-1);const close=async()=>{const openMenu=document.querySelector('[role=menu]');if(openMenu){openMenu.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await settle();}button('Close',dialog()).click();await settle();};
const value=(el,text)=>{Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,text);el.dispatchEvent(new Event('input',{bubbles:true}));};
const field=label=>[...(dialog()||studioScope()).querySelectorAll('label')].find(el=>el.querySelector(':scope > span')?.textContent.trim().replace(/\s*\*$/,'')===tr(label))?.querySelector('input,textarea');
const hit=el=>{assert(el,'Click target missing');el.scrollIntoView({block:'center'});const rect=el.getBoundingClientRect(),target=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);assert(target&&(target===el||el.contains(target)),'Click blocked: '+el.textContent.trim()+' by '+target?.outerHTML?.slice(0,350));assert(!el.closest('[inert]'),'Click target is inert');el.click();};
const menu=async(label,action)=>{button(label).click();await settle();const item=[...document.querySelectorAll('[role^=menuitem]')].find(el=>el.textContent.trim()===tr(action));assert(item,'Missing menu action '+action);hit(item);await settle();};
(async()=>{localStorage.clear();localStorage.setItem('wortify:practice-workspace:1:de',JSON.stringify([]));setLanguage('en');document.documentElement.dataset.interface=location.hash.slice(1)||'studio';createRoot(document.getElementById('root')).render(<Harness/>);await settle();await settle();
const card=title=>{const el=[...document.querySelectorAll('#root .library-card')].find(el=>el.querySelector('.library-card-title')?.textContent.trim()===title);assert(el,'Missing card '+title);return el;};
assert(!calls.some(url=>url.includes('full=1')),'My practice eagerly loaded full library');assert(!document.querySelector('#root').textContent.includes('Public only'),'Public-only content leaked into personal library');assert(!document.querySelector('[data-practice-studio]'),'Management workspace should not be required');assert(folder('Travel')&&folder('Other'),'Unpinned personal roots missing from tree');assert(card('Travel')&&card('Other'),'Personal roots missing from /practice/all');document.querySelector('.flash-root-folder').click();await settle();assert(card('Travel')&&card('Other'),'My practice does not return to complete root catalogue');
await menu('Library actions','New folder');value(field('Folder name'),'Created root');await wait();button('Create folder',dialog()).click();await settle();assert(posts.some(p=>p.body.title==='Created root'&&p.body.parent===null),'Root folder not saved');assert(document.querySelector('#root h1').textContent==='Created root','New folder did not open');
folder('Travel').click();await settle();assert(card('Bus lesson')&&card('Unit'),'Immediate contents missing');assert(!document.querySelector('.practice-folder-nav').textContent.includes('Bus lesson'),'Lesson leaked into navigation');
await menu('Folder actions: Travel','Rename');value(field('Folder name'),'Trips');await wait();button('Save changes',dialog()).click();await settle();assert(folder('Trips'),'Inline navigation rename failed');
await menu('Folder actions: Trips','New subfolder');value(field('Folder name'),'New unit');await wait();button('Create folder',dialog()).click();await settle();assert(nodes.some(n=>n.title==='New unit'&&n.parent===1),'Subfolder parent wrong');folder('Trips').click();await settle();
button('Import exercises',document.querySelector('#root')).click();await settle();await settle();assert(document.querySelector('[data-practice-import]'),'Import modal missing');assert(!dialog().querySelector('nav,details,.practice-studio-tools,.practice-folder-nav'),'Import contains navigation or tools sidebar');assert(dialog().querySelectorAll('h1').length===0,'Import repeats a large page heading');assert(dialog().querySelector('.practice-import-destination').textContent==='Trips','Destination changed inside import');
button('Authoring guide',dialog()).click();await settle();const guideText=dialog().querySelector('textarea');assert(guideText?.value.includes('COMPLETE EXERCISE RULES AND ALL TEMPLATES'),'Full guide missing');assert(decodeURIComponent(dialog().querySelector('a[download]').href.split(',').slice(1).join(','))===guideText.value,'Guide download differs');await close();
const sample=title=>['EXERCISE: '+title,'TYPE: short_answer','STYLE: sentence_rewrite','QUESTION: Rewrite: I go to school.','ANSWER: I go to school.'].join(String.fromCharCode(10));
const data=new DataTransfer();data.items.add(new File([sample('Imported one')],'one.txt',{type:'text/plain'}));data.items.add(new File([sample('Imported two')],'two.txt',{type:'text/plain'}));const input=dialog().querySelector('input[type=file]');assert(input.multiple,'Multiple file import disabled');Object.defineProperty(input,'files',{configurable:true,value:data.files});input.dispatchEvent(new Event('change',{bubbles:true}));await settle();await settle();assert(field('Text draft').value.includes('Imported one')&&field('Text draft').value.includes('Imported two'),'Multiple files were not combined');
button('Check and preview',dialog()).click();await settle();assert(dialog().textContent.includes('Imported one'),'Preview missing');await close();button('Import 2 exercises',dialog()).click();await settle();await settle();assert(!document.querySelector('[data-practice-import]'),'Successful import did not close');assert(posts.some(p=>p.path.endsWith('/import/')&&p.body.parent===1&&p.body.nodes.length===2),'Batch was not saved into selected folder');assert(card('Imported one')&&card('Imported two'),'Imported exercises missing from My practice');
button('Edit Imported one',card('Imported one')).click();await settle();await settle();assert(document.querySelector('[data-practice-import] textarea'),'Edit did not open focused editor');value(field('Text draft'),sample('Edited import'));await settle();await close();assert(dialog().textContent.includes(tr('Discard unsaved changes?')),'Dirty draft close not guarded');button('Keep editing',dialog()).click();await settle();button('Check and preview',dialog()).click();await settle();await close();button('Save changes',dialog()).click();await settle();assert(posts.some(p=>p.method==='PATCH'&&p.body.title==='Edited import'),'Edit was not saved');assert(card('Edited import'),'Updated card not refreshed');
card('Edited import').querySelector('input[type=checkbox]').click();card('Imported two').querySelector('input[type=checkbox]').click();await settle();assert(document.querySelector('#root [role=toolbar]'),'Selection tools are not inline');const drag=new DataTransfer();card('Edited import').dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:drag}));const target=folder('Other').closest('.flash-tree-row');target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:drag}));await wait();assert(target.dataset.dropActive==='true','Drop highlight missing');target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:drag}));await settle();assert(posts.filter(p=>p.path.endsWith('/organize/')).at(-1).body.ids.length===2,'Selected group was not moved');assert(![...document.querySelectorAll('.library-card-title')].some(el=>el.textContent==='Edited import'),'Moved content remained in source folder');
await menu('Folder actions: New unit','Move');button('Other',dialog()).click();await settle();assert(nodes.find(n=>n.title==='New unit').parent===5,'Folder move from navigation failed');
const deletes=posts.filter(p=>p.body.action==='delete').length;await menu('Folder actions: Unit','Delete permanently');button('Cancel',dialog()).click();await settle();assert(posts.filter(p=>p.body.action==='delete').length===deletes,'Cancel deleted a folder');await menu('Folder actions: Unit','Delete permanently');button('Delete permanently',dialog()).click();await settle();assert(!nodes.some(n=>n.id===3||n.id===4),'Folder subtree was not deleted');
for(const language of ['vi','de','en']){setLanguage(language);await settle();assert(button('Import exercises',document.querySelector('#root')),'Import translation missing');}assert(document.documentElement.scrollWidth<=Math.max(innerWidth,390)+1,'Horizontal overflow');
setLanguage('vi');await settle();button('Import exercises',document.querySelector('#root')).click();await settle();assert(!dialog().querySelector('.practice-studio-tools,nav'),'Import UI regressed to navigation workspace');document.getElementById('result').textContent='PASS: direct My practice folder/card management, selected drag, guarded deletion, focused import without navigation, two-file batch import, preview, edit, dirty guard, full guide and translations';})().catch(error=>document.getElementById('result').textContent='FAIL: '+error.message+' '+error.stack);`,
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
      fileName: () => "practice-navigation-check.js",
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
  path.join(dir, "practice-navigation-check.js"),
  "utf8",
);
const file = path.join(dir, "practice-navigation.html");
await fs.writeFile(
  file,
  `<!doctype html><html data-interface="studio"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}
${mobile ? ".app-modal-wrapper{width:390px!important;max-width:100vw;}" : ""}
.fixture-review #workspace-tools,.fixture-review .page > :not(.work-paper){display:none!important}.fixture-review #fixture-layout{display:block!important}.fixture-review .page,.fixture-review .work-paper{margin:0!important;padding:16px!important}
</style><body style="width:${mobile ? 390 : 1440}px;max-width:100%;margin:0"><div id="fixture-layout" style="display:grid;grid-template-columns:${mobile ? "minmax(0,1fr)" : "300px minmax(0,1fr)"};gap:24px;padding:20px"><div class="nav-flip" style="position:relative;inset:auto;width:100%;height:auto;max-height:none;z-index:auto;perspective:none"><div class="nav-face nav-back is-active" style="position:relative;inset:auto;transform:none;width:auto;height:auto;min-width:0;border-radius:20px"><aside class="workspace-context context-panel open" style="position:static;width:auto;height:auto;min-width:0;padding:20px"><h2>Practice Hub</h2><div id="workspace-tools"></div></aside></div></div><div id="root" style="min-width:0"></div></div><pre id="result" hidden></pre><script>window.onerror=(m)=>document.getElementById("result").textContent="FAIL: "+m;</script><script>${js.replaceAll("</script", "<\/script")}</script></body></html>`,
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
    "--user-data-dir=" + path.join(dir, "chrome-practice-navigation-check"),
    "--virtual-time-budget=45000",
    "--dump-dom",
    "--screenshot=" +
      path.join(
        dir,
        theme ? `practice-navigation-preview-${theme}${mobile?"-mobile":""}.png` : mobile ? "practice-navigation-mobile.png" : "practice-navigation.png",
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
