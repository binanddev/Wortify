import { build } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
process.chdir(path.resolve(import.meta.dirname, ".."));
const dir = path.resolve(".interface-preview");
await fs.mkdir(dir, { recursive: true });
const entry = path.join(dir, "admin-menu-check.jsx");
await fs.writeFile(
  entry,
  `import React from 'react';import {createRoot} from 'react-dom/client';import DataGrid from '../src/features/admin/DataGrid.jsx';import RowActions from '../src/features/admin/RowActions.jsx';
let actions=0;
createRoot(document.getElementById('root')).render(<main className="admin-main"><DataGrid id="test-menu" rows={[{id:1,name:'Test account'}]} columns={[{key:'name',label:'Username',required:true,filter:<select aria-label="Filter account"><option>All accounts</option></select>},{key:'actions',label:'Actions',required:true,render:()=> <RowActions label="Account actions" items={[{key:'edit',label:'Edit details',run:()=>actions++},{key:'delete',label:'Delete account',disabled:true,run:()=>actions++}]}/>}]}/></main>);
const wait=()=>new Promise(r=>setTimeout(r,600));
(async()=>{await wait();const row=document.querySelector('tbody tr'),height=row.getBoundingClientRect().height;document.querySelector('.admin-action-trigger').click();await wait();const menu=document.querySelector('[role="menu"]');if(!menu)throw Error('Menu not opened');if(row.contains(menu))throw Error('Menu is inside row');if(row.getBoundingClientRect().height!==height)throw Error('Row expanded');if(height>40)throw Error('Compact row too tall: '+height);const items=[...menu.querySelectorAll('[role="menuitem"]')];if(items[1].getAttribute('aria-disabled')!=='true')throw Error('Disabled protection lost');items[0].click();await wait();if(actions!==1)throw Error('Action did not run');if(document.querySelector('[role="menu"]'))throw Error('Menu did not close');const header=document.querySelector('thead').getBoundingClientRect().height;document.querySelector('[aria-label="Filter Username"]').click();await wait();if(!document.querySelector('[aria-label="Filter account"]'))throw Error('Filter did not open');if(document.querySelector('thead').getBoundingClientRect().height!==header)throw Error('Filter expanded header');document.getElementById('result').textContent='PASS: portalled action menu, compact stable row, disabled actions, action dispatch and close';})().catch(e=>document.getElementById('result').textContent='FAIL: '+e.message);`,
);
await build({
  configFile: false,
  plugins: [react()],
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    lib: {
      entry,
      name: "AdminMenuCheck",
      formats: ["iife"],
      fileName: () => "admin-menu-check.js",
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
const js = await fs.readFile(path.join(dir, "admin-menu-check.js"), "utf8");
const file = path.join(dir, "admin-menu.html");
await fs.writeFile(
  file,
  `<!doctype html><html data-interface="admin" data-admin-density="compact"><meta charset="utf-8"><style>${css}</style><body><div id="root"></div><pre id="result" hidden></pre><script>${js.replaceAll("</script", "<\/script")}</script></body></html>`,
);
const result = spawnSync(
  process.env.CHROME_PATH ||
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  [
    "--headless",
    "--disable-gpu",
    "--no-first-run",
    "--window-size=1440,1000",
    "--user-data-dir=" + path.join(dir, "chrome-admin-menu-check"),
    "--virtual-time-budget=4000",
    "--dump-dom",
    "--screenshot=" + path.join(dir, "admin-menu.png"),
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
