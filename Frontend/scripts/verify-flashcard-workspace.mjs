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
const entry = path.join(dir, "flashcard-workspace-check.jsx");
await fs.writeFile(
  entry,
  `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import Studio from '../src/features/flashcards/flashcard-studio.jsx';import {Library} from '../src/features/flashcards/library.jsx';import {WindowContext} from '../src/lib/core.js';import {setLanguage} from '../src/i18n/index.js';
const card={id:1,german_text:'bus',vietnamese_meaning:'xe bus',example_german:'We take the bus to school.',example_vietnamese:'Chúng tôi đi xe buýt đến trường.'};
const folders=[{id:2,name:'Lektion 2',parent_id:null},{id:3,name:'Lektion 3',parent_id:null},{id:4,name:'Verben',parent_id:3},{id:5,name:'Unterwegs',parent_id:4}];
const decks=[{id:1,title:'Travel',description:'',folder_id:3,count:2,mastered:0},{id:2,title:'Food',description:'',folder_id:2,count:2,mastered:0},{id:6,title:'At home',description:'',folder_id:null,count:2,mastered:0}];
window.fetch=async(url,opts={})=>{let data=String(url).endsWith('/decks/')?{folders,decks}:String(url).includes('learning/sync')?{accepted:[],errors:[]}:{deck:{id:1,title:'Travel'},cards:[card,{...card,id:2,german_text:'train',vietnamese_meaning:'tàu',example_german:'We travel by train.',example_vietnamese:'Chúng tôi đi bằng tàu.'}],learning:{options:{mode:'learn',types:['written'],goal:'comprehensive',showExampleAfterAnswer:true,autoSpeak:false}},study_defaults:{}};return Response.json(data);};
const root=createRoot(document.getElementById('root')),wait=()=>new Promise(r=>setTimeout(r,180)),assert=(v,m)=>{if(!v)throw Error(m)};
const inputValue=(el,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));};
const findButton=label=>{const button=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===label||b.textContent.trim()===label);assert(button,'Missing button: '+label);return button;};
const scope={active:true,get toolsTarget(){return document.getElementById('workspace-tools')}};
function Harness(){const [route,navigate]=useState('/en/flashcard');return <WindowContext.Provider value={{...scope,route,navigate}}><Library lang='en' interfaceName='studio'/></WindowContext.Provider>}
(async()=>{
localStorage.clear();setLanguage('en');root.render(<Harness/>);await wait();await wait();await wait();
const nav=()=>document.querySelector('.flash-folder-list'),main=()=>document.getElementById('root');
assert(nav().textContent.includes('Lektion 2')&&nav().textContent.includes('Lektion 3'),'Root folders missing');
assert(!nav().textContent.includes('Verben'),'Collapsed descendants visible at root');
assert(!main().querySelector('.notebook-folder-tab'),'Duplicate folder tiles remain');
assert(main().textContent.includes('At home')&&!main().textContent.includes('Travel'),'Root does not show only direct decks');
findButton('Lektion 3').click();await wait();await wait();
assert(main().textContent.includes('Travel')&&!main().textContent.includes('Food'),'Selected folder decks incorrect');
assert(nav().textContent.includes('Verben')&&!nav().textContent.includes('Unterwegs'),'Immediate folder hierarchy incorrect');
assert(!nav().querySelector('a')&&!nav().textContent.includes('Travel'),'Decks remain in folder tree');
findButton('Verben').click();await wait();await wait();assert(nav().textContent.includes('Unterwegs'),'Selected folder children not opened');
assert(main().textContent.includes('This folder is empty.'),'Empty current folder state missing');
findButton('Lektion 3').click();await wait();assert(!nav().textContent.includes('Unterwegs'),'Deeper branch stays open outside current folder');
if(location.hash==='#library'){document.getElementById('result').textContent='PASS: folder-only navigation, direct decks, child folders, empty state';return;}
root.render(<WindowContext.Provider value={{...scope,route:'/en/flashcard/deck/1?mode=learn'}}><Studio lang='en' id={1} userId={9901} sound={false}/></WindowContext.Provider>);await wait();await wait();
findButton('Start learning').click();await wait();
let input=document.querySelector('.flash-question input');assert(input,'Written question missing');
assert(!document.querySelector('.flash-example-feedback'),'Example visible before answer');
inputValue(input,'wrong');await wait();findButton('Check answer').click();await wait();
assert(!document.querySelector('.flash-example-feedback'),'Example visible after wrong answer');assert(findButton('Next question').disabled,'Wrong answer allows next');
findButton('Show answer').click();await wait();
assert(!input.disabled&&input.value==='wrong','Reveal locks or clears input');assert(findButton('Next question').disabled,'Reveal allows next');assert(!document.querySelector('.flash-example-feedback'),'Reveal leaks example');
inputValue(input,'still wrong');await wait();findButton('Check answer').click();await wait();assert(!input.disabled&&findButton('Next question').disabled,'Wrong retry cannot be corrected');
const prompt=document.querySelector('.flash-question h2').textContent;inputValue(input,prompt==='xe bus'?'bus':'train');await wait();findButton('Check answer').click();await wait();
assert(input.disabled&&!findButton('Next question').disabled,'Correct retry does not unlock next');assert(document.querySelector('.flash-example-feedback blockquote'),'Correct answer example missing');assert(document.querySelector('.flash-example-feedback > p'),'Example translation missing');
findButton('Next question').click();await wait();assert(!document.querySelector('.flash-example-feedback'),'Previous example leaks into next question');assert(!document.querySelector('.flash-question input').disabled,'Next answer locked');assert(findButton('Next question').disabled,'Next enabled before answering');
const q=document.querySelector('.flash-question h2').textContent;inputValue(document.querySelector('.flash-question input'),q==='xe bus'?'bus':'train');await wait();findButton('Check answer').click();await wait();
document.documentElement.classList.add('fixture-review');document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,0);document.getElementById('result').textContent='PASS: folder-only navigation; reveal, wrong retry, correct retry, example gating and next-question reset';
})().catch(e=>document.getElementById('result').textContent='FAIL: '+e.message);`,
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
      fileName: () => "flashcard-workspace-check.js",
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
  path.join(dir, "flashcard-workspace-check.js"),
  "utf8",
);
const file = path.join(dir, "flashcard-workspace.html");
await fs.writeFile(
  file,
  `<!doctype html><html data-interface="studio"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}
.fixture-review #workspace-tools,.fixture-review .page > :not(.work-paper){display:none!important}.fixture-review #fixture-layout{display:block!important}.fixture-review .page,.fixture-review .work-paper{margin:0!important;padding:16px!important}
</style><body style="width:${mobile ? 390 : 1440}px;max-width:100%;margin:0"><div id="fixture-layout" style="display:grid;grid-template-columns:${mobile ? "minmax(0,1fr)" : "260px minmax(0,1fr)"};gap:24px;padding:20px"><aside id="workspace-tools" style="background:var(--surface);padding:16px;border-radius:16px;min-width:0"></aside><div id="root" style="min-width:0"></div></div><pre id="result" hidden></pre><script>window.onerror=(m)=>document.getElementById("result").textContent="FAIL: "+m;</script><script>${js.replaceAll("</script", "<\/script")}</script></body></html>`,
);
const result = spawnSync(
  process.env.CHROME_PATH ||
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  [
    "--headless",
    "--disable-gpu",
    "--no-first-run",
    mobile ? "--window-size=390,844" : "--window-size=1440,1000",
    "--user-data-dir=" + path.join(dir, "chrome-flashcard-workspace-check"),
    "--virtual-time-budget=18000",
    "--dump-dom",
    "--screenshot=" +
      path.join(
        dir,
        process.argv.includes("--library") ? "flashcard-library.png" : mobile ? "flashcard-workspace-mobile.png" : "flashcard-workspace.png",
      ),
    pathToFileURL(file).href + (process.argv.includes("--library") ? "#library" : ""),
  ],
  {
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000,
    maxBuffer: 8 * 1024 * 1024,
  },
);
const match = result.stdout?.match(/<pre id="result"[^>]*>([^<]+)<\/pre>/);
if (!match?.[1].startsWith("PASS")) throw Error(match?.[1] || result.stderr);
console.log(match[1]);
