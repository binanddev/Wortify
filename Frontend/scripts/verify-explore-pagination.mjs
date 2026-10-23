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
const entry = path.join(dir, "explore-pagination-check.jsx");
await fs.writeFile(entry, "import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {HeroUIProvider} from '@heroui/react';import {Explore} from '../src/features/explore/explore.jsx';import {WindowContext,clearContentCache} from '../src/lib/core.js';import {setLanguage,t as tr} from '../src/i18n/index.js';\nconst calls=[];let navigate,goBack;let failed=false;const visits=[];const wait=()=>new Promise(r=>setTimeout(r,240)),settle=async()=>{await wait();await wait();},assert=(v,m)=>{if(!v)throw Error(m)};\nwindow.fetch=async(url)=>{const p=new URL(url,'https://fixture.invalid').searchParams;calls.push(p);if(failed&&p.get('page')==='2'){failed=false;return Response.json({error:'Temporary error'},{status:503});}const folder=p.get('folder');const total=p.get('q')==='nothing'?0:folder?14:p.get('q')?15:37;const page=Number(p.get('page')||1);const results=Array.from({length:Math.max(0,Math.min(12,total-(page-1)*12))},(_,i)=>{const id=(page-1)*12+i+1;return {id:folder?100+id:id,kind:folder?'theory':'folder',title:folder?'Lesson '+id:'Folder '+id,parent:folder?1:null,root_id:1,child_count:14,can_edit:false,author:'Wortify'};});return Response.json({results,total,page,has_more:page*12<total,ancestors:folder?[{id:1,title:'Folder 1'}]:[],current:folder?{id:1,title:'Folder 1',can_edit:false}:null});};\nfunction Harness(){const [route,setRoute]=useState('/de/explore');navigate=path=>{visits.push(route);setRoute(path);};goBack=()=>setRoute(visits.pop());return <HeroUIProvider disableAnimation><WindowContext.Provider value={{route,active:true,navigate,get toolsTarget(){return document.getElementById('workspace-tools');}}}><Explore lang='de' userId={1}/></WindowContext.Provider></HeroUIProvider>;}\nconst button=label=>{const el=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===tr(label)||b.textContent.trim()===tr(label));assert(el,'Missing '+label);return el;};const page=n=>button('Page {page}'.replace('{page}',n));const pageButton=n=>{const el=[...document.querySelectorAll('.explore-page-numbers button')].find(b=>b.textContent.trim()===String(n));assert(el,'Missing page '+n);return el;};const titles=()=>[...document.querySelectorAll('.library-card-title')].map(n=>n.textContent);const search=async text=>{const input=document.querySelector('.explore-search input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,text);input.dispatchEvent(new Event('input',{bubbles:true}));await wait();document.querySelector('.explore-search form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await settle();};\n(async()=>{localStorage.clear();setLanguage('en');createRoot(document.getElementById('root')).render(<Harness/>);await settle();await settle();assert(titles().length===12&&titles()[0]==='Folder 1','Root must contain exactly 12 folders');assert(button('Previous page').disabled,'Previous enabled on first page');assert(![...document.querySelectorAll('button')].some(b=>b.textContent.includes('Show more results')),'Load-more action remains');button('List view').click();await settle();assert(document.querySelector('.library-card').getBoundingClientRect().height<180,'List rows are not compact');button('Grid view').click();await settle();const seed=calls.at(-1).get('seed');pageButton(2).click();await settle();assert(titles().length===12&&titles()[0]==='Folder 13'&&!titles().includes('Folder 1'),'Page two appended instead of replacing');assert(calls.at(-1).get('seed')===seed,'Paging changed ranking seed');assert(document.querySelector('[aria-current=page]')?.textContent==='2','Current page not marked');assert(document.activeElement.classList.contains('explore-result-heading'),'New page heading not focused');pageButton(4).click();await settle();assert(titles().length===1&&titles()[0]==='Folder 37','Last page wrong');assert(button('Next page').disabled,'Next enabled on last page');goBack();await settle();assert(titles()[0]==='Folder 13','Back did not restore page');failed=true;clearContentCache();pageButton(1).click();await settle();pageButton(2).click();await settle();assert(document.getElementById('root').textContent.includes('Temporary error'),'Request error missing');button('Retry').click();await settle();assert(titles()[0]==='Folder 13','Retry lost target page');await search('travel');assert(calls.at(-1).get('page')==='1'&&titles().length===12,'Search did not reset page');pageButton(2).click();await settle();assert(calls.at(-1).get('q')==='travel'&&titles().length===3,'Paging lost search');await search('nothing');assert(!document.querySelector('.explore-pagination'),'Empty results have pager');navigate('/de/explore?page=999&seed=fixed');await settle();await settle();assert(titles()[0]==='Folder 37'&&calls.at(-1).get('page')==='4','Out-of-range page not recovered');assert(!visits.at(-1)?.includes('browse=1'),'API-only query leaked into route');navigate('/de/explore');await settle();button('Folder 1').click();await settle();assert(titles().length===12&&titles()[0]==='Lesson 1','Folder did not reset to first child page');pageButton(2).click();await settle();assert(calls.at(-1).get('folder')==='1'&&titles().length===2,'Folder pagination lost parent');for(const language of ['vi','de','en']){setLanguage(language);await wait();assert(button('Previous page')&&button('Next page'),'Paging translation missing');}navigate('/de/explore');await settle();setLanguage('vi');await settle();const nav=document.querySelector('.explore-page-controls').getBoundingClientRect();assert(nav.width<=390,'Pager too wide for mobile');document.getElementById('result').textContent='PASS: 12-folder pages, replace/back/seed, last/empty/out-of-range pages, retry, search/folder scope, focus and EN/VI/DE';})().catch(e=>document.getElementById('result').textContent='FAIL: '+e.message+' '+e.stack);\n");

await build({
  configFile: false,
  plugins: [react()],
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    lib: {
      entry,
      name: "ImportApiCheck",
      formats: ["iife"],
      fileName: () => "explore-pagination-check.js",
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
  path.join(dir, "explore-pagination-check.js"),
  "utf8",
);
const file = path.join(dir, "explore-pagination.html");
await fs.writeFile(
  file,
  `<!doctype html><html data-interface="studio"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}.hub-tile{opacity:1!important;transform:none!important}.page{padding:24px!important;margin:0!important;max-width:100%}</style><body><div id="workspace-tools" hidden></div><div id="root" style="width:${mobile ? 390 : 1440}px;max-width:100%"></div><pre id="result" hidden></pre><script>window.onerror=(m)=>document.getElementById("result").textContent="FAIL: "+m;</script><script>${js.replaceAll("</script", "<\/script")}</script></body></html>`,
);
const result = spawnSync(
  process.env.CHROME_PATH ||
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  [
    "--headless",
    "--disable-gpu",
    "--no-first-run",
    mobile ? "--window-size=500,1100" : "--window-size=1440,1200",
    "--user-data-dir=" + path.join(dir, "chrome-explore-pagination-check"),
    "--virtual-time-budget=45000",
    "--dump-dom",
    "--screenshot=" +
      path.join(
        dir,
        mobile ? "explore-pagination-mobile.png" : "explore-pagination.png",
      ),
    pathToFileURL(file).href,
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
