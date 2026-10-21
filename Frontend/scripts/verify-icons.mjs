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
const entry = path.join(dir, "icons-check.jsx");
await fs.writeFile(entry,"import React from 'react';import {createRoot} from 'react-dom/client';import {Icon,Btn} from '../src/components/ui/ui.jsx';import {ICON_COMPONENTS} from '../src/components/ui/icon-catalog.js';\nconst names=Object.keys(ICON_COMPONENTS);const wait=()=>new Promise(r=>setTimeout(r,150));\nconst theme=location.hash.slice(1)||'studio';document.documentElement.dataset.interface=theme;\ncreateRoot(document.getElementById('root')).render(<main style={{padding:24}}><h1>{theme} \u00b7 Wortify icons</h1><div style={{display:'flex',gap:16,marginBottom:24}}>{['exercise','book','explore','filter','manage','learn','game','star'].map(name=><Btn key={name} icon={name}>{name}</Btn>)}</div><div style={{display:'grid',gridTemplateColumns:'repeat(10,minmax(0,1fr))',gap:12}}>{names.map(name=><div key={name} style={{display:'flex',alignItems:'center',flexDirection:'column',gap:8,padding:12,border:'1px solid currentColor',borderRadius:8}}><Icon name={name}/><span style={{fontSize:12}}>{name}</span></div>)}</div><div id='small'><Icon name='calendar' size={16}/></div></main>);\n(async()=>{await wait();await wait();const icons=[...document.querySelectorAll('svg.app-icon')];for(const icon of icons){if(icon.querySelector('svg'))throw Error('Nested SVG '+icon.dataset.icon);if(!icon.querySelector('path,rect,circle,line,polygon,foreignObject'))throw Error('Empty '+icon.dataset.icon);if(icon.getAttribute('aria-hidden')!=='true')throw Error('Decorative icon announced');}if(document.querySelector('#small svg').getBoundingClientRect().width!==16)throw Error('Inline size ignored');if(theme==='retro'&&!document.querySelector('[data-icon=star] .nes-icon.star'))throw Error('NES library missing');document.getElementById('result').textContent='PASS: '+theme+' \u00b7 '+names.length+' icons, single SVG, accessible controls and inline sizing';})().catch(e=>document.getElementById('result').textContent='FAIL: '+e.message);\n");
await build({
  configFile: false,
  plugins: [react()],
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    lib: {
      entry,
      name: "IconsCheck",
      formats: ["iife"],
      fileName: () => "icons-check.js",
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
  path.join(dir, "icons-check.js"),
  "utf8",
);
const file = path.join(dir, "icons.html");
await fs.writeFile(
  file,
  `<!doctype html><html data-interface="studio"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style><body><div id="root" style="width:${mobile ? 390 : 1440}px;max-width:100%"></div><pre id="result" hidden></pre><script>${js.replaceAll("</script", "<\/script")}</script></body></html>`,
);
for (const theme of ["studio","glass","xp","retro","notebook","rpg"]) {
const result = spawnSync(
  process.env.CHROME_PATH ||
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  [
    "--headless",
    "--disable-gpu",
    "--no-first-run",
    mobile ? "--window-size=390,844" : "--window-size=1440,1000",
    "--user-data-dir=" + path.join(dir, "chrome-icons-check-"+theme),
    "--virtual-time-budget=20000",
    "--dump-dom",
    "--screenshot=" +
      path.join(
        dir,
        "icons-"+theme+".png",
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
await fs.writeFile(
  path.join(dir, "icons-dom.html"),
  result.stdout || "",
);
const match = result.stdout?.match(/<pre id="result"[^>]*>([^<]+)<\/pre>/);
if (!match?.[1].startsWith("PASS")) throw Error(match?.[1] || result.stderr);
console.log(match[1]);

}
