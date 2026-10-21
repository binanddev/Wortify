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
const entry = path.join(dir, "auto-card-images-check.jsx");
await fs.writeFile(entry,"import React from 'react';import {createRoot} from 'react-dom/client';import AutoCardImages from '../src/features/flashcards/auto-card-images.jsx';import {setLanguage} from '../src/i18n/index.js';\nconst wait=()=>new Promise(r=>setTimeout(r,100));const assert=(ok,m)=>{if(!ok)throw Error(m)};\ndocument.addEventListener('error',e=>{if(e.target.tagName==='IMG')e.stopImmediatePropagation();},true);const cards=Array.from({length:51},(_,i)=>({id:i+1,german_text:'Term '+i,vietnamese_meaning:'Meaning'}));cards.push({id:999,german_text:'Existing',image_url:'https://example.com/existing.jpg'});\nconst image={title:'File:Bus.jpg',imageinfo:[{mime:'image/jpeg',thumburl:'https://upload.wikimedia.org/test.jpg',descriptionurl:'https://commons.wikimedia.org/wiki/File:Bus.jpg',extmetadata:{LicenseShortName:{value:'CC0'}}}]};let batches=[],saved=[],closed=false,fail=true;\nwindow.fetch=async(url,options={})=>{if(options.method==='POST'){const items=JSON.parse(options.body).items;batches.push(items);if(batches.length===2&&fail){fail=false;return new Response(JSON.stringify({error:'Temporary error'}),{status:500});}return Response.json({cards:items,skipped:0});}return Response.json({query:{pages:{one:String(url).includes('wikipedia.org')?{pageimage:'Bus.jpg'}:image}}});};\n(async()=>{localStorage.clear();setLanguage('en');createRoot(document.getElementById('root')).render(<AutoCardImages cards={cards} lang='de' deckId={1} onSaved={rows=>saved.push(...rows)} onClose={()=>{closed=true}}/>);await wait();await wait();\nconst button=prefix=>[...document.querySelectorAll('button')].find(b=>b.textContent.startsWith(prefix)&&!b.disabled);\nassert(document.body.textContent.includes('51'),'All missing cards not counted');button('Find suggestions').click();\nfor(let i=0;i<700&&!button('Apply selected images');i++)await wait();\nassert(button('Apply selected images')?.textContent.includes('(51)'),'Not all cards searched');assert(document.querySelectorAll('.card-image-results > section').length===24,'Preview not paginated');\nbutton('Apply selected images').click();for(let i=0;i<20&&!button('Apply selected images');i++)await wait();await wait();\nassert(saved.length===50&&!closed,'Partial saves not retained');assert(button('Apply selected images')?.textContent.includes('(1)'),'Retry includes saved cards');button('Apply selected images').click();await wait();await wait();\nassert(closed&&saved.length===51,'Retry failed');assert(batches.map(b=>b.length).join(',')==='50,1,1','Batch size incorrect');assert(!saved.some(c=>c.id===999),'Existing image overwritten');document.getElementById('result').textContent='PASS: all 51 cards, pagination, 50-item batches, partial failure retry and preserved existing images';})().catch(e=>document.getElementById('result').textContent='FAIL: '+e.message);\n");
await build({
  configFile: false,
  plugins: [react()],
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    lib: {
      entry,
      name: "AutoCardImagesCheck",
      formats: ["iife"],
      fileName: () => "auto-card-images-check.js",
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
  path.join(dir, "auto-card-images-check.js"),
  "utf8",
);
const file = path.join(dir, "auto-card-images.html");
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
    "--user-data-dir=" + path.join(dir, "chrome-auto-card-images-check"),
    "--virtual-time-budget=100000",
    "--dump-dom",
    "--screenshot=" +
      path.join(
        dir,
        mobile ? "auto-card-images-mobile.png" : "auto-card-images.png",
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
  path.join(dir, "auto-card-images-dom.html"),
  result.stdout || "",
);
const match = result.stdout?.match(/<pre id="result"[^>]*>([^<]+)<\/pre>/);
if (!match?.[1].startsWith("PASS")) throw Error(match?.[1] || result.stderr);
console.log(match[1]);

