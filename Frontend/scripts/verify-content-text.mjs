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
const entry = path.join(dir, "content-text-check.jsx");
await fs.writeFile(
  entry,
  `import React from 'react';import {createRoot} from 'react-dom/client';import Import from '../src/features/admin/ContentPackageImport.jsx';import {setLanguage} from '../src/i18n/index.js';
const calls=[];window.fetch=async(url,opts)=>{calls.push(opts.body);const publish=opts.body.get('confirm')==='IMPORT';return new Response(JSON.stringify(publish?{id:'fixture',publisher:'Wortify',counts:{reading:1}}:{title:'Mixed',language:'en',counts:{reading:1,exercise:1},preview_token:'fixture-token'}),{status:publish?201:200,headers:{'Content-Type':'application/json'}});};
const root=createRoot(document.getElementById('root'));const wait=()=>new Promise(r=>setTimeout(r,300));const assert=(v,m)=>{if(!v)throw Error(m)};const click=async(text)=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);assert(b&&!b.disabled,'Missing button '+text);b.click();await wait();};
(async()=>{setLanguage('en');root.render(<Import/>);await wait();const input=document.querySelector('textarea:not([readonly])');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'WORTIFY: 1');input.dispatchEvent(new Event('input',{bubbles:true}));await wait();await click('Preview file');assert(document.getElementById('root').textContent.includes('Mixed'),'Preview missing');await click('Import and publish as Wortify');assert(calls[1].get('preview_token')==='fixture-token','Preview token missing');assert(await calls[1].get('file').text()==='WORTIFY: 1','Content changed');assert(document.getElementById('root').textContent.includes('Imported successfully.'),'Success missing');setLanguage('vi');await wait();assert(document.getElementById('root').textContent.includes('Hoặc dán nội dung'),'Translation missing');document.getElementById('result').textContent='PASS: paste, preview, publish token, unchanged file and Vietnamese labels';})().catch(e=>document.getElementById('result').textContent='FAIL: '+e.message);`,
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
      fileName: () => "content-text-check.js",
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
  path.join(dir, "content-text-check.js"),
  "utf8",
);
const file = path.join(dir, "content-text.html");
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
    "--user-data-dir=" + path.join(dir, "chrome-content-text-check"),
    "--virtual-time-budget=12000",
    "--dump-dom",
    "--screenshot=" +
      path.join(
        dir,
        mobile ? "content-text-mobile.png" : "content-text.png",
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
