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
const entry = path.join(dir, "library-touch-check.jsx");
await fs.writeFile(
  entry,
  `import React from 'react';import {createRoot} from 'react-dom/client';import {Library} from '../src/features/flashcards/library.jsx';import {WindowContext} from '../src/lib/core.js';import {setLanguage} from '../src/i18n/index.js';
const posts=[];let decks=[{id:1,title:'Tiếng Việt – Giao thông',description:'Đường phố',count:4,mastered:0,level:'A2',folder_id:null},{id:2,title:'Ẩm thực',count:3,mastered:0,level:'A1',folder_id:3}];
let folders=[{id:3,name:'Sách GK 8',parent_id:null,archived:false},{id:4,name:'Child must not appear',parent_id:3,archived:false},{id:5,name:'Writing',parent_id:null,archived:true}];
window.fetch=async(url,opts={})=>{if(opts.method==='PATCH'){const values=JSON.parse(opts.body);if(url.includes('/folders/'))folders=folders.map(f=>String(f.id)===url.split('/').filter(Boolean).at(-1)?{...f,...values}:f);else{posts.push(values);decks=decks.map(d=>String(d.id)===url.split('/').filter(Boolean).at(-1)?{...d,folder_id:3}:d);}}return new Response(JSON.stringify({decks,folders:url.includes('include_archived')?folders:folders.filter(f=>!f.archived)}),{headers:{'Content-Type':'application/json'}});};
const root=createRoot(document.getElementById('root'));const wait=()=>new Promise(r=>setTimeout(r,250));const assert=(v,m)=>{if(!v)throw Error(m)};const click=t=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===t||b.getAttribute('aria-label')===t);assert(b,'Missing '+t);b.click();};
(async()=>{localStorage.clear();setLanguage('en');root.render(<WindowContext.Provider value={{route:'/en/flashcard',active:true,navigate:()=>{}}}><Library lang='en' interfaceName='studio'/></WindowContext.Provider>);await wait();await wait();for(const theme of ['studio','notebook','rpg']){document.documentElement.dataset.interface=theme;await wait();assert(document.documentElement.scrollWidth<=innerWidth+1,'Card overflow '+theme);}document.documentElement.dataset.interface='studio';click('Select decks');await wait();assert(document.querySelectorAll('.deck-link[role=checkbox]').length===2,'Nested deck missing in selection');document.querySelector('.deck-link[role=checkbox]').click();await wait();assert(document.querySelector('.deck-link[role=checkbox]').getAttribute('aria-checked')==='true','Whole tile selection failed');document.querySelector('.flash-nav-selection input').click();await wait();assert(document.querySelectorAll('.deck-link[aria-checked=true]').length===2,'Select all failed');click('Delete selected');await wait();assert(document.querySelector('[role=dialog]'),'Delete confirmation missing');click('Keep');await wait();assert(posts.length===0,'Cancel must not modify decks');click('Move to folder');await wait();const select=document.querySelector('[role=dialog] select');assert(select,'Move folder selector missing');select.value='3';select.dispatchEvent(new Event('change',{bubbles:true}));await wait();click('Move');await wait();await wait();assert(posts.length===2&&posts.every(p=>p.folder==='3'),'Bulk move failed');assert(!document.querySelector('[role=dialog]'),'Move did not close');
for(const theme of ['studio','notebook','rpg']){document.documentElement.dataset.interface=theme;await wait();assert(document.documentElement.scrollWidth<=innerWidth+1,'Horizontal overflow '+theme);const font=getComputedStyle(document.querySelector('h1')).fontFamily;assert(!/Kalam|Cormorant/.test(font),'Unsafe heading font '+font);}
document.documentElement.dataset.interface='studio';click('Workspace options');await wait();assert(document.querySelector('[role=dialog]'),'Workspace options missing');assert(!document.querySelector('.flash-folder-list details'),'Inline menus still present');await wait();const boxes=[...document.querySelectorAll('[role=dialog] input[type=checkbox]')];assert(boxes.length===2,'Only one active root folder should appear');boxes[1].click();await wait();click('Remove from workspace');await wait();await wait();assert(folders[0].archived===true&&decks.length===2,'Removal must archive, not delete');assert(document.querySelector('[role=dialog]'),'Modal closed after removal');const view=document.querySelector('[role=dialog] select');view.value='all';view.dispatchEvent(new Event('change',{bubbles:true}));await wait();document.querySelectorAll('[role=dialog] input[type=checkbox]')[1].click();await wait();click('Restore to workspace');await wait();await wait();assert(folders[0].archived===false,'Restore failed');assert(document.querySelector('[role=dialog] select').value==='all','Filter reset after refresh');assert(document.querySelectorAll('[role=dialog] input[type=checkbox]').length===3,'All must show two root folders only');document.getElementById('result').textContent='PASS: root folders only, active/all filters, remove/restore branch, preserved modal and card selection';})().catch(e=>document.getElementById('result').textContent='FAIL: '+e.message);`,
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
      fileName: () => "library-touch-check.js",
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
  path.join(dir, "library-touch-check.js"),
  "utf8",
);
const file = path.join(dir, "library-touch.html");
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
    "--user-data-dir=" + path.join(dir, "chrome-library-touch-check"),
    "--virtual-time-budget=12000",
    "--dump-dom",
    "--screenshot=" +
      path.join(
        dir,
        mobile ? "library-touch-mobile.png" : "library-touch.png",
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
