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
const entry = path.join(dir, "study-flow-check.jsx");
await fs.writeFile(
  entry,
  `import React from 'react';import {createRoot} from 'react-dom/client';import Studio from '../src/features/flashcards/flashcard-studio.jsx';import {WindowContext} from '../src/lib/core.js';import {setLanguage} from '../src/i18n/index.js';
const card={id:1,german_text:'bus',vietnamese_meaning:'xe bus',example_german:'We take the bus.',example_vietnamese:'We take the bus.'};const destinations=[],posts=[];
window.fetch=async(url,opts={})=>{let data;if(url.endsWith('/cards/')&&opts.method==='POST'){posts.push(JSON.parse(opts.body));data={id:3};}else if(url.endsWith('/decks/'))data={decks:[{id:1,title:'Travel'},{id:2,title:'Food'}]};else if(url.includes('learning/sync'))data={accepted:[],errors:[]};else data={deck:{id:1,title:'Travel'},cards:[card],learning:{},study_defaults:{}};return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});};
const root=createRoot(document.getElementById('root'));const wait=()=>new Promise(r=>setTimeout(r,300));const assert=(v,m)=>{if(!v)throw Error(m)};
(async()=>{localStorage.clear();setLanguage('en');root.render(<WindowContext.Provider value={{route:'/en/flashcard/deck/1',active:true,navigate:p=>destinations.push(p)}}><Studio lang='en' id={1} userId={1} sound={false}/></WindowContext.Provider>);await wait();await wait();document.querySelector('button[aria-label="Add card"]').click();await wait();const inputs=[...document.querySelectorAll('[role=dialog] input')];for(const [i,value]of ['train','tàu'].entries()){Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(inputs[i],value);inputs[i].dispatchEvent(new Event('input',{bubbles:true}));}await wait();[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Save changes').click();await wait();assert(posts.length===1&&posts[0].german_text==='train','Card not created');assert(!document.querySelector('[role=dialog]'),'Editor stayed open');assert(document.getElementById('root').textContent.includes('bus'),'Current card lost');document.querySelector('button[aria-label="Switch deck"]').click();await wait();await wait();const other=[...document.querySelectorAll('[role=dialog] a')].find(a=>a.textContent==='Food');assert(other,'Other deck missing');other.click();await wait();assert(destinations[0]==='/en/flashcard/deck/2','Deck switch failed');document.getElementById('result').textContent='PASS: add card in study, retain current card, switch deck';})().catch(e=>document.getElementById('result').textContent='FAIL: '+e.message);`,
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
      fileName: () => "study-flow-check.js",
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
  path.join(dir, "study-flow-check.js"),
  "utf8",
);
const file = path.join(dir, "study-flow.html");
await fs.writeFile(
  file,
  `<!doctype html><html data-interface="studio"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style><body><div id="root" style="width:${mobile ? 390 : 1440}px;max-width:100%"></div><pre id="result" hidden></pre><script>window.onerror=(m)=>document.getElementById("result").textContent="FAIL: "+m;</script><script>${js.replaceAll("</script", "<\/script")}</script></body></html>`,
);
const result = spawnSync(
  process.env.CHROME_PATH ||
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  [
    "--headless",
    "--disable-gpu",
    "--no-first-run",
    mobile ? "--window-size=390,844" : "--window-size=1440,1000",
    "--user-data-dir=" + path.join(dir, "chrome-study-flow-check"),
    "--virtual-time-budget=12000",
    "--dump-dom",
    "--screenshot=" +
      path.join(
        dir,
        mobile ? "study-flow-mobile.png" : "study-flow.png",
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
const match = result.stdout?.match(/<pre id="result"[^>]*>([^<]+)<\/pre>/);
if (!match?.[1].startsWith("PASS")) throw Error(match?.[1] || result.stderr);
console.log(match[1]);
