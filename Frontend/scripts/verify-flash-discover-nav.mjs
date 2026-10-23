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
const entry = path.join(dir, "flash-discover-nav-check.jsx");
await fs.writeFile(entry,"import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {HeroUIProvider} from '@heroui/react';import FlashcardDiscover from '../src/features/flashcards/flashcard-discover.jsx';import {WindowContext,readPreference,savePreference} from '../src/lib/core.js';import {setLanguage,t as tr} from '../src/i18n/index.js';import {discoveryHistoryKey} from '../src/features/flashcards/discovery-history.js';\nconst theme=location.hash.slice(1)||'notebook';document.documentElement.dataset.interface=theme;const calls=[],key=discoveryHistoryKey(1,'en'),long='Donaudampfschifffahrtsgesellschaft '.repeat(8).trim().slice(0,200);let remount;const wait=()=>new Promise(r=>setTimeout(r,200)),settle=async()=>{await wait();await wait();},assert=(v,m)=>{if(!v)throw Error(m)};\nwindow.fetch=async url=>{calls.push(url);return Response.json({results:[],count:0,page:1,pages:1,ancestors:[]});};const seed=()=>savePreference(key,{queries:[{query:'C2',at:5},{query:'C1',at:4},{query:long,at:3},{query:'Vocabulary for everyday life',at:2},{query:'Grammar',at:1}],folders:[{id:7,at:1}]});\nfunction Harness(){const [version,setVersion]=useState(0);remount=()=>setVersion(v=>v+1);return <HeroUIProvider disableAnimation><WindowContext.Provider value={{route:'/en/flashcard/discover',active:true,navigate:()=>{},get toolsTarget(){return document.getElementById('workspace-tools');}}}><FlashcardDiscover key={version} lang='en' userId={1}/></WindowContext.Provider></HeroUIProvider>};const nav=()=>document.querySelector('.flash-discover-nav');const click=el=>{el.scrollIntoView({block:'nearest'});const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);assert(hit&&(hit===el||el.contains(hit)),'Blocked control '+el.className);el.click();};\nfunction layout(){const panel=document.querySelector('.context-panel'),r=nav().getBoundingClientRect();assert(panel.scrollWidth<=panel.clientWidth+1,'Sidebar overflow '+panel.scrollWidth+'/'+panel.clientWidth);for(const el of nav().querySelectorAll('button,input,.flash-recent-heading')){const box=el.getBoundingClientRect();assert(box.right<=r.right+1&&box.left>=r.left-1,'Control escaped nav: '+el.className);}const input=nav().querySelector('input').getBoundingClientRect(),submit=nav().querySelector('[type=submit]').getBoundingClientRect();assert(Math.abs(input.bottom-submit.bottom)<3,'Search control not aligned');assert(nav().querySelector('.flash-recent-heading > span').getBoundingClientRect().height<28,'Recent heading wrapped');assert(submit.width<=44.1,'Search button stretched');}\n(async()=>{localStorage.clear();seed();setLanguage('vi');createRoot(document.getElementById('root')).render(<Harness/>);await settle();await settle();for(const language of ['vi','de','en']){setLanguage(language);await settle();layout();assert(nav().querySelectorAll('.flash-recent-list li').length===5,'History row missing');}const row=nav().querySelectorAll('.flash-recent-query')[2];assert(row.title===long,'Long history cannot be read');click(nav().querySelector('.flash-recent-query'));await settle();assert(calls.some(url=>new URL(url,'https://fixture.invalid').searchParams.get('q')==='C2'),'Recent query not applied');const removed=nav().querySelectorAll('.flash-recent-remove')[1];click(removed);await settle();assert(readPreference(key,{}).queries.length===4,'Individual deletion not persisted');assert(readPreference(key,{}).folders[0].id===7,'Individual deletion cleared folder recommendations');remount();await settle();assert(nav().querySelectorAll('.flash-recent-list li').length===4,'Deleted query restored after remount');click(nav().querySelector('.flash-recent-clear'));await settle();assert(!nav().querySelector('.flash-recent-searches'),'Empty history heading remains');assert(!readPreference(key,{}).queries.length,'Clear not persisted');seed();remount();await settle();setLanguage('vi');await settle();layout();window.scrollTo(0,0);document.getElementById('result').textContent='PASS: '+theme+' compact search, zero overflow, aligned controls, long history, EN/VI/DE, replay/delete/persistence/clear';})().catch(e=>document.getElementById('result').textContent='FAIL: '+e.message+' '+e.stack);\n");

await build({
  configFile: false,
  plugins: [react()],
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    lib: {
      entry,
      name: "ImportApiCheck",
      formats: ["iife"],
      fileName: () => "flash-discover-nav-check.js",
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
  path.join(dir, "flash-discover-nav-check.js"),
  "utf8",
);
const file = path.join(dir, "flash-discover-nav.html");
await fs.writeFile(
  file,
  `<!doctype html><html data-interface="notebook"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}.nav-flip{transform:none!important;opacity:1!important;visibility:visible!important;perspective:none!important}</style><body style="margin:0"><div class="nav-flip" style="position:relative;inset:auto;margin:12px;width:${mobile?280:320}px;height:920px"><div class="nav-face nav-back is-active" style="position:relative;transform:none;height:100%;width:100%;"><div class="nav-static"><strong class="brand">wortify.</strong></div><aside class="workspace-context context-panel open" style="width:100%;height:calc(100% - 70px);position:absolute;inset:70px 0 0"><h2>Flashcard</h2><div id="workspace-tools"></div></aside></div></div><div id="root" hidden></div><pre id="result" hidden></pre><script>window.onerror=m=>document.getElementById('result').textContent='FAIL: '+m;</script><script>${js.replaceAll("</script", "<\/script")}</script></body></html>`,

);
for(const theme of process.argv.includes("--themes") ? ["studio","glass","xp","retro","notebook","rpg"] : ["notebook"]) {
const result = spawnSync(
  process.env.CHROME_PATH ||
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  [
    "--headless",
    "--disable-gpu",
    "--no-first-run",
    mobile ? "--window-size=500,1000" : "--window-size=1440,1000",
    "--user-data-dir=" + path.join(dir, "chrome-flash-discover-nav-check"),
    "--virtual-time-budget=18000",
    "--dump-dom",
    "--screenshot=" +
      path.join(
        dir,
        `flash-discover-nav-${theme}${mobile?"-mobile":""}.png`,
      ),
    pathToFileURL(file).href+"#"+theme,
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

}
