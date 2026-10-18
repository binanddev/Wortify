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
const entry = path.join(dir, "practice-speed-check.jsx");
await fs.writeFile(
  entry,
  `import React from 'react';import {createRoot} from 'react-dom/client';import {PracticeHub} from '../src/features/practice/practice-hub.jsx';import {WindowContext} from '../src/lib/core.js';import {setLanguage} from '../src/i18n/index.js';
const calls=[];const nodes=[{id:1,parent:null,kind:'folder',title:'Travel',updated_at:'1',links:[]},{id:2,parent:1,kind:'theory',title:'Bus lesson',updated_at:'1',links:[]}];
window.fetch=async(url,options={})=>{calls.push(url);const data=url.includes('/nodes/2/')?{node:{...nodes[1],payload:{format:'markdown',content:'Unique lesson content'}}}:url.includes('/nodes/')?{nodes}:{accepted:[],errors:[],events:[]};return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});};
const wait=()=>new Promise(r=>setTimeout(r,300));const assert=(v,m)=>{if(!v)throw Error(m)};
(async()=>{localStorage.clear();setLanguage('en');createRoot(document.getElementById('root')).render(<WindowContext.Provider value={{route:'/en/practice/all',active:true,navigate:()=>{}}}><PracticeHub lang='en' id='all' userId={1} sound={false}/></WindowContext.Provider>);await wait();await wait();assert(!calls.some(u=>u.includes('full=1')||u.includes('/nodes/2/')),'Catalog downloaded lesson content');document.querySelector('.catalog-preview').click();await wait();[...document.querySelectorAll('[role=dialog] button')].find(b=>b.textContent.includes('Bus lesson')).click();await wait();await wait();assert(calls.some(u=>u.includes('/nodes/2/')),'Detail was not loaded');assert(document.querySelector('[role=dialog]').textContent.includes('Unique lesson content'),'Detail not rendered');document.getElementById('result').textContent='PASS: metadata-only catalogue and on-demand lesson preview';})().catch(e=>document.getElementById('result').textContent='FAIL: '+e.message);`,
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
      fileName: () => "practice-speed-check.js",
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
  path.join(dir, "practice-speed-check.js"),
  "utf8",
);
const file = path.join(dir, "practice-speed.html");
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
    "--user-data-dir=" + path.join(dir, "chrome-practice-speed-check"),
    "--virtual-time-budget=12000",
    "--dump-dom",
    "--screenshot=" +
      path.join(
        dir,
        mobile ? "practice-speed-mobile.png" : "practice-speed.png",
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
