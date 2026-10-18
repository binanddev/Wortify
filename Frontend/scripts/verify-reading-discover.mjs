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
const entry = path.join(dir, "reading-discover-check.jsx");
await fs.writeFile(
  entry,
  `import React from 'react';import {createRoot} from 'react-dom/client';import Discover from '../src/features/reading/ReadingDiscover.jsx';import {setLanguage} from '../src/i18n/index.js';import {WindowContext} from '../src/lib/core.js';
const urls=[],destinations=[];let saves=0;window.fetch=async(url)=>{urls.push(String(url));return new Response(JSON.stringify(String(url).includes('/save/')?(saves++,{id:77,saved:true}):String(url).includes('/open/')?{title:'Bus reading',payload:{title:'Bus reading',kind:'choice',context:'We travel by bus.',presentation:{interaction:'reading',style:'split_reading'},questions:[{id:'1',prompt:'How?',kind:'choice',options:['Bus','Car'],accepted_answers:['Bus'],presentation:{}}]}}:{lessons:[{key:'community:1',title:'Bus reading',level:'A2',topic:'Travel',source:'community'}],topics:['Travel'],total:1,page:1}),{headers:{'Content-Type':'application/json'}});};
const root=createRoot(document.getElementById('root'));const wait=()=>new Promise(r=>setTimeout(r,350));const assert=(v,m)=>{if(!v)throw Error(m)};
(async()=>{setLanguage('en');root.render(<WindowContext.Provider value={{navigate:path=>destinations.push(path)}}><Discover lang='en' userId={1}/></WindowContext.Provider>);await wait();await wait();assert(document.getElementById('root').textContent.includes('Bus reading'),'Catalogue missing');const selects=[...document.querySelectorAll('select')];assert(selects.length===3,'Filters missing');selects[0].value='A2';selects[0].dispatchEvent(new Event('change',{bubbles:true}));await wait();assert(urls.some(u=>u.includes('level=A2')),'Level filter failed');document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await wait();const save=[...document.querySelectorAll('button')].find(b=>b.textContent==='Save to My readings');save.click();await wait();assert(saves===1,'Save API not called');const study=[...document.querySelectorAll('button')].find(b=>b.textContent==='Continue learning');study.click();await wait();assert(destinations[0]==='/en/reading/77','Study did not open saved reading');assert(saves===1,'Duplicate save request');const open=document.querySelector('button[aria-label="Preview reading"]');open.click();await wait();await wait();assert(document.querySelector('[role=dialog]').textContent.includes('We travel by bus.'),'Reading preview missing');assert(document.querySelector('[role=dialog]').textContent.includes('personal copy and your progress'),'Preview scope missing');setLanguage('vi');await wait();assert(document.getElementById('root').textContent.includes('Tất cả chủ đề'),'Vietnamese labels missing');document.getElementById('result').textContent='PASS: catalogue filters, save once, continue on private reading, preview and Vietnamese labels';})().catch(e=>document.getElementById('result').textContent='FAIL: '+e.message);`,
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
      fileName: () => "reading-discover-check.js",
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
  path.join(dir, "reading-discover-check.js"),
  "utf8",
);
const file = path.join(dir, "reading-discover.html");
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
    "--user-data-dir=" + path.join(dir, "chrome-reading-discover-check"),
    "--virtual-time-budget=12000",
    "--dump-dom",
    "--screenshot=" +
      path.join(
        dir,
        mobile ? "reading-discover-mobile.png" : "reading-discover.png",
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
