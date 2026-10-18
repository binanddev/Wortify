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
const entry = path.join(dir, "users-cards-check.jsx");
await fs.writeFile(
  entry,
  `import React from 'react';import {createRoot} from 'react-dom/client';import Users from '../src/features/admin/Users.jsx';import QuickCardEditor from '../src/features/flashcards/quick-card-editor.jsx';import {setLanguage} from '../src/i18n/index.js';
window.fetch=async()=>new Response(JSON.stringify({users:[{id:2,username:'fixture_staff',email:'test@example.com',is_active:true,is_staff:true,date_joined:'2026-01-01',last_login:null}],total:1}),{headers:{'Content-Type':'application/json'}});
const root=createRoot(document.getElementById('root'));const wait=()=>new Promise(r=>setTimeout(r,300));const assert=(v,m)=>{if(!v)throw Error(m)};
(async()=>{setLanguage('en');root.render(<Users user={{id:1,superuser:true}}/>);await wait();await wait();assert(document.getElementById('root').textContent.includes('fixture_staff'),'Users failed to render');document.querySelector('.admin-action-trigger').click();await wait();assert(document.querySelector('[role=menu]').textContent.includes('Edit details'),'Account menu missing');root.render(<QuickCardEditor card={{id:1,german_text:'Bus',vietnamese_meaning:'bus'}} lang='de' deckId={1} onClose={()=>{}} onSaved={()=>{document.getElementById('result').textContent='PASS: Users list and actions open; simplified card saves without removed fields';}}/>);await wait();assert(!document.querySelector('[role=dialog]').textContent.includes('Additional details'),'Fields still collapsed');const save=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Save changes');assert(save,'Save missing');save.click();await wait();})().catch(e=>document.getElementById('result').textContent='FAIL: '+e.message);`,
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
      fileName: () => "users-cards-check.js",
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
  path.join(dir, "users-cards-check.js"),
  "utf8",
);
const file = path.join(dir, "users-cards.html");
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
    "--user-data-dir=" + path.join(dir, "chrome-users-cards-check"),
    "--virtual-time-budget=12000",
    "--dump-dom",
    "--screenshot=" +
      path.join(
        dir,
        mobile ? "users-cards-mobile.png" : "users-cards.png",
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
