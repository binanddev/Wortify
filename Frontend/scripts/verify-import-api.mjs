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
const entry = path.join(dir, "import-api-check.jsx");
await fs.writeFile(
  entry,
  `import React from 'react';import {createRoot} from 'react-dom/client';import ImportApi from '../src/features/admin/ContentImportApi.jsx';import {setLanguage} from '../src/i18n/index.js';
let enabled=false,mutations=[];
window.fetch=async(path,options={})=>{const method=options.method||'GET';if(method==='POST'){enabled=true;mutations.push(method);}if(method==='DELETE'){enabled=false;mutations.push(method);}return new Response(JSON.stringify({enabled,...(enabled?{prefix:'wti_fixture',...(method==='POST'?{key:'wti_fixture_secret_not_real'}:{})}:{})}),{status:200,headers:{'Content-Type':'application/json'}});};
const root=createRoot(document.getElementById('root'));const wait=()=>new Promise(r=>setTimeout(r,200));
const click=async(label)=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===label);if(!b||b.disabled)throw Error('Button unavailable: '+label);b.click();await wait();await wait();};
const assert=(ok,message)=>{if(!ok)throw Error(message);};
(async()=>{localStorage.clear();setLanguage('en');root.render(<ImportApi/>);await wait();
const endpoint=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('/api/import/content/'));endpoint.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));await wait();
const input=document.querySelector('input[aria-label="Import endpoint"]');assert(input,'Endpoint editor missing');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'https://wortify.onrender.com');input.dispatchEvent(new Event('input',{bubbles:true}));await wait();await click('Save changes');
assert([...document.querySelectorAll('#root pre')].every(p=>p.textContent.includes('https://wortify.onrender.com/api/import/content/')),'Commands not updated');assert(document.querySelector('a[href="https://wortify.onrender.com/api/import/openapi/"]'),'Schema not updated');assert(document.querySelector('textarea[aria-label="Complete instructions"]').value.includes('POST https://wortify.onrender.com/api/import/content/'),'Bot guide not updated');assert(JSON.parse(localStorage.getItem('wortify:content-import-endpoint'))==='https://wortify.onrender.com/api/import/content/','Endpoint not saved');await click('Use current site');
await click('Enable API');assert(document.querySelector('textarea[aria-label="New API key"]').value==='wti_fixture_secret_not_real','One-time key missing');assert(!JSON.stringify(localStorage).includes('fixture_secret'),'Key persisted');assert(document.getElementById('root').textContent.includes('preview=true'),'Preview instructions missing');assert(document.getElementById('root').textContent.includes('confirm=IMPORT'),'Publish instructions missing');await click('Hide key');assert(!document.querySelector('textarea[aria-label="New API key"]'),'Key not hidden');await click('Rotate API key');assert(document.querySelector('[role=dialog]'),'Rotation confirmation missing');await click('Confirm');assert(mutations.filter(v=>v==='POST').length===2,'Rotation failed');await click('Disable API');await click('Confirm');assert(!document.querySelector('textarea[aria-label="New API key"]'),'Disabled key still visible');assert(document.getElementById('root').textContent.includes('API disabled'),'Disable failed');setLanguage('vi');await wait();assert(document.getElementById('root').textContent.includes('Bật API'),'Vietnamese API UI missing');setLanguage('de');await wait();assert(document.getElementById('root').textContent.includes('API aktivieren'),'German API UI missing');document.getElementById('result').textContent='PASS: endpoint double-click, commands/schema/guide sync, persistence/reset, key lifecycle and translations';})().catch(e=>document.getElementById('result').textContent='FAIL: '+e.message);`,
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
      fileName: () => "import-api-check.js",
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
  path.join(dir, "import-api-check.js"),
  "utf8",
);
const file = path.join(dir, "import-api.html");
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
    "--user-data-dir=" + path.join(dir, "chrome-import-api-check"),
    "--virtual-time-budget=12000",
    "--dump-dom",
    "--screenshot=" +
      path.join(
        dir,
        mobile ? "import-api-mobile.png" : "import-api.png",
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
const match = result.stdout?.match(/<pre id="result" hidden="">([^<]+)<\/pre>/);
if (!match?.[1].startsWith("PASS")) throw Error(match?.[1] || result.stderr);
console.log(match[1]);
