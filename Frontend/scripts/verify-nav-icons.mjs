import { build } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
process.chdir(path.resolve(import.meta.dirname, ".."));
const dir = path.resolve(".interface-preview");
const mobile = process.argv.includes("--mobile");
const tablet=process.argv.includes("--tablet");
const onlyTheme=process.argv.find(arg=>arg.startsWith("--theme="))?.split("=")[1];
await fs.mkdir(dir, { recursive: true });
const entry = path.join(dir, "nav-icons-check.jsx");
await fs.writeFile(entry,"import React from 'react';import {createRoot} from 'react-dom/client';import {Workspace} from '../src/app/App.jsx';import {WindowContext} from '../src/lib/core.js';import {setLanguage} from '../src/i18n/index.js';\nconst [theme,face]=location.hash.slice(1).split('/');localStorage.clear();setLanguage('vi');history.replaceState=()=>{};\nconst route='/de/flashcard';const data={folders:[{id:1,name:'Ti\u1ebfng \u0110\u1ee9c',parent_id:null}],decks:[{id:2,title:'Giao th\u00f4ng',description:'',folder_id:1,count:20,mastered:0,visibility:'private'}]};\nwindow.fetch=async(url)=>{let body=String(url).includes('/decks/')?data:String(url).includes('snapshot')?{preferences:{},decks:[],events:[]}:{};return Response.json(body);};\nconst user={id:555,username:'minhtien',preferences:{interface:theme,uiLanguage:'vi',navPinned:true,navScale:70},appearance_session:'fixture'};\ncreateRoot(document.getElementById('root')).render(<WindowContext.Provider value={{route,navigate:()=>{},active:true,get toolsTarget(){return document.getElementById('workspace-tools')}}}><Workspace user={user} setUser={()=>{}} lang='de' parts={['de','flashcard']} route={route} appearance={{data:{}}} onRequireAccount={()=>{}}/></WindowContext.Provider>);\nconst wait=()=>new Promise(r=>setTimeout(r,200));const check=(ok,msg)=>{if(!ok)throw Error(msg)};\n(async()=>{if(theme==='xp'){for(let i=0;i<60&&!document.querySelector('.windows-taskbar');i++)await wait();await wait();if(face==='front'){document.querySelector('[aria-controls=windows-start-navigation]')?.click();await wait();}check(document.querySelector('.windows-taskbar'),'Windows missing');check(!document.querySelector('svg.app-icon svg'),'Nested Windows icon');document.getElementById('result').textContent='PASS: xp/'+face+' actual desktop and Start menu';return;}for(let i=0;i<60&&!document.querySelector('.nav-front .nav-rotate');i++)await wait();await wait();await wait();document.querySelectorAll('.brand-logo').forEach(img=>img.src=new URL('../public/brand/wortify-logo.png',location.href).href);\nif(innerWidth<=1100){const b=document.querySelector('.mobile-nav-bar button');b?.click();await wait();}\n// Exercise both actual header buttons, then leave the requested face visible for the screenshot.\nfor(const back of [true,false,...(face==='back'?[true]:[])]){const current=document.querySelector('.nav-face.is-active .nav-rotate');check(current,'Missing rotate control');current.click();await wait();await wait();await wait();const active=document.querySelector('.nav-face.is-active');check(active.classList.contains(back?'nav-back':'nav-front'),'Wrong active face');const icon=active.querySelector('.nav-rotate > svg');check(icon&&!icon.querySelector('svg'),'Rotate SVG missing/nested');const box=icon.getBoundingClientRect();check(box.width>=20&&box.height>=20,'Rotate icon collapsed');check(getComputedStyle(icon).visibility==='visible'&&getComputedStyle(icon).display!=='none','Hidden rotate icon');}\nconst active=document.querySelector('.nav-face.is-active');for(const icon of active.querySelectorAll('svg.app-icon'))check(!icon.querySelector('svg'),'Nested nav glyph');\nif(theme==='notebook')for(const icon of active.querySelectorAll('.nav-link > svg,.flash-folder-list svg'))check(getComputedStyle(icon).color===getComputedStyle(icon.parentElement).color,'Icon color differs: '+icon.dataset.icon);\ndocument.getElementById('result').textContent='PASS: '+theme+'/'+face+' actual workspace, both flip controls, no nested SVG and nav colors';})().catch(e=>document.getElementById('result').textContent='FAIL: '+e.message);\n");
await build({
  configFile: false,
  plugins: [react()],
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    lib: {
      entry,
      name: "NavIconsCheck",
      formats: ["iife"],
      fileName: () => "nav-icons-check.js",
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
  path.join(dir, "nav-icons-check.js"),
  "utf8",
);
const file = path.join(dir, "nav-icons.html");
await fs.writeFile(
  file,
  `<!doctype html><html data-interface="studio"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style><body><div id="root" style="width:${mobile ? 390 : 1440}px;max-width:100%"></div><pre id="result" hidden></pre><script>${js.replaceAll("</script", "<\/script")}</script></body></html>`,
);
for (const theme of (onlyTheme?[onlyTheme]:process.argv.includes("--remaining")?["xp","retro","notebook","rpg"]:["studio","glass","xp","retro","notebook","rpg"])) for(const face of ["front","back"]) {
const result = spawnSync(
  process.env.CHROME_PATH ||
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  [
    "--headless",
    "--disable-gpu",
    "--no-first-run",
    mobile ? "--window-size=390,844" : tablet ? "--window-size=1024,1000" : "--window-size=1440,1000",
    "--user-data-dir=" + path.join(dir, "chrome-nav-icons-check-"+theme),
    "--virtual-time-budget=20000",
    "--dump-dom",
    "--screenshot=" +
      path.join(
        dir,
        "nav-icons-"+theme+"-"+face+(tablet?"-tablet":mobile?"-mobile":"")+".png",
      ),
    pathToFileURL(file).href+"#"+theme+"/"+face,
  ],
  {
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000,
    maxBuffer: 8 * 1024 * 1024,
  },
);
await fs.writeFile(
  path.join(dir, "nav-icons-dom.html"),
  result.stdout || "",
);
const match = result.stdout?.match(/<pre id="result"[^>]*>([^<]+)<\/pre>/);
if (!match?.[1].startsWith("PASS")) throw Error(match?.[1] || result.stderr);
console.log(match[1]);

}
