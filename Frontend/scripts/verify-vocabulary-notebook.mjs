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
const entry = path.join(dir, "vocabulary-notebook-check.jsx");
await fs.writeFile(
  entry,
  `import React from 'react';import {createRoot} from 'react-dom/client';import Notebook from '../src/features/flashcards/vocabulary-notebook.jsx';import LanguageSettings from '../src/i18n/LanguageSettings.jsx';import {setLanguage} from '../src/i18n/index.js';
const card={id:1,german_text:'sich erholen',vietnamese_meaning:'nghỉ ngơi',example_german:'Ich muss mich erholen.',example_vietnamese:'Tôi cần nghỉ ngơi.',article:'',plural_form:'',usage:'sich erholen',notes:''};
let state={revision:0,records:{},session:null},posts=[];
window.fetch=async(path,options={})=>{if(path==='/api/me/language/')return new Response(options.body,{status:200,headers:{'Content-Type':'application/json'}});if(options.method==='PATCH'){Object.assign(card,JSON.parse(options.body));return new Response(JSON.stringify({id:card.id}),{status:200});}if(options.method==='POST'){const data=JSON.parse(options.body);posts.push(data);if(data.action==='start')state.session={id:'fixture',cards:[1],phase:'prepare',index:0,answers:{},done:false};if(data.action==='step'){const s=state.session;s.answers[1]||={};s.answers[1][s.phase]=data;const phases=['prepare','recall','sentence','variation','check'];const index=phases.indexOf(s.phase);if(index<4)s.phase=phases[index+1];else{s.done=true;state.records[1]={needs_practice:true,next_date:'2026-10-18'};}}state.revision++;}return new Response(JSON.stringify({notebook:state,cards:[card],total:1,due:0,new:1}),{status:200,headers:{'Content-Type':'application/json'}});};
const root=createRoot(document.getElementById('root'));let instance=0;
function render(){root.render(<main style={{padding:24}}><LanguageSettings/><Notebook key={instance} lang="de" id="1" userId="fixture-user"/></main>);}
const wait=()=>new Promise(r=>setTimeout(r,150));
const click=async(label)=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===label);if(!button||button.disabled)throw Error('Unavailable button: '+label);button.click();await wait();};
function type(value,index=0){const el=document.querySelectorAll('textarea')[index];if(!el)throw Error('Missing textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));}
async function language(value){const el=document.querySelector('select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('change',{bubbles:true}));await wait();await wait();}
function assert(value,message){if(!value)throw Error(message);}
(async()=>{localStorage.clear();setLanguage("en");render();await wait();await click('Start set');assert(document.getElementById('root').textContent.includes(card.german_text),'Preparation missing');await click('Edit card');assert(document.querySelector('[role=dialog]'),'Editor missing');const field=document.querySelector('[role=dialog] input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,'sich entspannen');field.dispatchEvent(new Event('input',{bubbles:true}));await wait();await click('Save changes');assert(card.german_text==='sich entspannen','Edit was not saved');assert(state.session.phase==='prepare','Edit advanced session');await click('Ready · Next');assert(!document.getElementById('root').textContent.includes(card.german_text),'Recall answer leaked');type('draft recall');await wait();instance++;render();await wait();assert(document.querySelector('textarea').value==='draft recall','Draft not restored');await language('vi');assert(document.documentElement.lang==='vi','HTML language not changed');assert([...document.querySelectorAll('button')].some(b=>b.textContent==='Kiểm tra đáp án'),'Vietnamese missing');assert(document.querySelector('textarea').value==='draft recall','Draft lost on language change');await language('de');assert([...document.querySelectorAll('button')].some(b=>b.textContent==='Antwort prüfen'),'German missing');assert(document.getElementById('root').textContent.includes(card.vietnamese_meaning),'Learning content changed');await language('en');await click('Check answer');assert(document.getElementById('root').textContent.includes('Not correct yet'),'Wrong answer not detected');assert([...document.querySelectorAll('button')].find(b=>b.textContent.includes('Review sooner')).disabled,'Wrong answer accepted');await click('Hide and try again');assert(!document.getElementById('root').textContent.includes(card.german_text),'Retry did not hide answer');type('sich entspannen');await wait();await click('Check answer');await click('Retried · Review sooner');assert(posts.at(-1).remembered===false,'Struggle lost');assert(!document.getElementById('root').textContent.includes(card.example_german),'Translation answer leaked');type('Am Wochenende erhole ich mich.');await wait();await click('Compare and correct');assert(document.getElementById('root').textContent.includes('Other sentences can also be correct.'),'Self-assessment guidance missing');type('Am Wochenende erhole ich mich zu Hause.',1);await wait();await click('Self-check: I can use it');assert(posts.at(-1).answer==='Am Wochenende erhole ich mich.','Original sentence lost');assert(posts.at(-1).correction.includes('zu Hause'),'Correction lost');type('Nach der Arbeit erhole ich mich.');await wait();await click('Compare and correct');await click('Self-check: I can use it');assert(!document.getElementById('root').textContent.includes(card.german_text),'Final check answer leaked');type('sich entspannen');await wait();await click('Check answer');await click('Recalled unaided');assert(document.getElementById('root').textContent.includes('Completed 1 word'),'Summary missing');assert(document.getElementById('root').textContent.includes('2026-10-18'),'Review date missing');assert(!Object.keys(localStorage).some(k=>k.startsWith('wortify:notebook:fixture-user:')),'Completed drafts retained');assert(document.getElementById('root').scrollWidth<=document.getElementById('root').clientWidth,'Horizontal overflow');document.getElementById('result').textContent='PASS: EN/VI/DE switching preserves draft and content; card editing, recall, correction and completion';})().catch(e=>document.getElementById('result').textContent='FAIL: '+e.message);`,
);
await build({
  configFile: false,
  plugins: [react()],
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    lib: {
      entry,
      name: "VocabularyNotebookCheck",
      formats: ["iife"],
      fileName: () => "vocabulary-notebook-check.js",
    },
    outDir: dir,
    emptyOutDir: false,
  },
});
const assets = await fs.readdir("dist/assets");
let css = await fs.readFile(
  "dist/assets/" + assets.find((x) => /^index-.*\.css$/.test(x)),
  "utf8",
);
css = css.replaceAll(
  "/assets/",
  pathToFileURL(path.resolve("dist/assets")).href + "/",
);
const js = await fs.readFile(
  path.join(dir, "vocabulary-notebook-check.js"),
  "utf8",
);
const file = path.join(dir, "vocabulary-notebook.html");
await fs.writeFile(
  file,
  `<!doctype html><html data-interface="studio"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style><body><div id="root" style="width:${mobile ? 390 : 1440}px;max-width:100%"></div><pre id="result" hidden></pre><script>${js.replaceAll("</script", "<\/script")}</script></body></html>`,
);
const result = spawnSync(
  process.env.CHROME_PATH ||
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  [
    "--headless",
    "--disable-gpu",
    "--no-first-run",
    mobile ? "--window-size=390,844" : "--window-size=1440,1000",
    "--user-data-dir=" + path.join(dir, "chrome-vocabulary-notebook-check"),
    "--virtual-time-budget=12000",
    "--dump-dom",
    "--screenshot=" +
      path.join(
        dir,
        mobile ? "vocabulary-notebook-mobile.png" : "vocabulary-notebook.png",
      ),
    pathToFileURL(file).href,
  ],
  {
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000,
    maxBuffer: 8 * 1024 * 1024,
  },
);
const match = result.stdout?.match(/<pre id="result" hidden="">([^<]+)<\/pre>/);
if (!match?.[1].startsWith("PASS")) throw Error(match?.[1] || result.stderr);
console.log(match[1]);
