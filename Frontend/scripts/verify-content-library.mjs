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
const entry = path.join(dir, "content-library-check.jsx");
await fs.writeFile(
  entry,
  "import React from 'react';import {createRoot} from 'react-dom/client';import ContentImport from '../src/features/admin/ContentPackageImport.jsx';import {setLanguage} from '../src/i18n/index.js';\nlet title='Transport',mutations=[];\nconst documentData={format:'wortify-content',version:1,id:'12345678-1234-4234-8234-123456789abc',title:'Batch',language:'de',mode:'update',flashcards:[{kind:'folder',title:'A1',children:[{kind:'deck',title:'Transport',cards:[{german_text:'Bus',vietnamese_meaning:'Xe buyt',example_german:'Der Bus kommt.',example_vietnamese:'Xe buyt den.'}]}]}]};\nwindow.fetch=async(url,options={})=>{const method=options.method||'GET';let data;\n if(method==='PATCH'){mutations.push(JSON.parse(options.body));title=mutations.at(-1).title;data={changed:1};}\n else if(method==='POST'){const confirmed=options.body.get('confirm');mutations.push({mode:options.body.get('mode'),confirm:confirmed});data=confirmed?{already_imported:false}:{title:'Batch',language:'de',mode:'update',preview_token:'fixture',counts:{decks:1},changes:[{action:'update',path:['A1','Transport'],cards:{update:1}}]};}\n else if(String(url).includes('&item=')){data={document:documentData};}\n else data={revision:'fixture',items:[{id:1,kind:'folder',path:['A1'],count:0},{id:2,kind:'deck',path:['A1',title],count:1}],batches:[{id:'fixture-batch',title:'Batch one',created_at:'2026-10-21T00:00:00Z',mode:'append',counts:{decks:1}}]};\n return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});};\nconst root=createRoot(document.getElementById('root'));const wait=()=>new Promise(r=>setTimeout(r,250));\nconst click=async(label)=>{const button=[...document.querySelectorAll('button')].find(b=>(b.textContent.trim()===label||b.getAttribute('aria-label')===label)&&!b.disabled);if(!button)throw Error('Missing button '+label);button.click();await wait();await wait();};\nconst assert=(ok,message)=>{if(!ok)throw Error(message);};\n(async()=>{localStorage.clear();setLanguage('en');root.render(<ContentImport section='flashcards'/>);await wait();await wait();\nawait click('Open');assert(document.getElementById('root').textContent.includes('Transport'),'Folder navigation missing');await click('View');assert(document.querySelector('[role=dialog]'),'Detail modal missing');assert(document.body.textContent.includes('Der Bus kommt.'),'Card preview missing');assert(document.querySelector('textarea[aria-label=\"Complete instructions\"]').value.includes('CURRENT CONTENT FOR EDITING'),'AI editing context missing');await click('Edit as import');assert(!document.querySelector('[role=dialog]'),'Detail modal not closed');await click('Preview file');assert(document.querySelector('[role=dialog]').textContent.includes('A1 / Transport'),'Change preview missing');await click('Import and publish as Wortify');assert(!document.querySelector('[role=dialog]'),'Preview not closed after publish');assert(mutations.at(-1).mode==='update'&&mutations.at(-1).confirm==='IMPORT','Publish did not preserve mode');await click('Library');document.querySelector('input[aria-label=\"A1/Transport\"]').click();await wait();await click('Rename');const input=document.querySelector('[role=dialog] input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Travel');input.dispatchEvent(new Event('input',{bubbles:true}));await wait();await click('Confirm');assert(mutations.at(-1).action==='rename'&&mutations.at(-1).title==='Travel','Rename payload incorrect');assert(document.body.textContent.includes('Travel'),'Catalog not refreshed');await click('Import history');assert(document.body.textContent.includes('Batch one'),'History missing');await click('Details');assert(document.querySelector('[role=dialog]').textContent.includes('fixture-batch'),'Batch detail missing');assert(document.documentElement.scrollWidth<=window.innerWidth+2,'Horizontal overflow');document.getElementById('result').textContent='PASS: library folders, detail modal, AI context, edit import, preview/publish, rename and history';})().catch(e=>document.getElementById('result').textContent='FAIL: '+e.message);",
);
await build({
  configFile: false,
  plugins: [react()],
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    lib: {
      entry,
      name: "ContentLibraryCheck",
      formats: ["iife"],
      fileName: () => "content-library-check.js",
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
  path.join(dir, "content-library-check.js"),
  "utf8",
);
const file = path.join(dir, "content-library.html");
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
    "--user-data-dir=" + path.join(dir, "chrome-content-library-check"),
    "--virtual-time-budget=20000",
    "--dump-dom",
    "--screenshot=" +
      path.join(
        dir,
        mobile ? "content-library-mobile.png" : "content-library.png",
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
await fs.writeFile(
  path.join(dir, "content-library-dom.html"),
  result.stdout || "",
);
const match = result.stdout?.match(/<pre id="result"[^>]*>([^<]+)<\/pre>/);
if (!match?.[1].startsWith("PASS")) throw Error(match?.[1] || result.stderr);
console.log(match[1]);
