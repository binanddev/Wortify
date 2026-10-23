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
const entry = path.join(dir, "staff-workspace-check.jsx");
await fs.writeFile(entry, "import React from 'react';import {createRoot} from 'react-dom/client';import {Workspace} from '../src/app/App.jsx';import StaffTools from '../src/features/staff/StaffTools.jsx';import {WindowContext} from '../src/lib/core.js';import {Settings} from '../src/features/settings/learning.jsx';import {configureStaffWorkspace} from '../src/lib/staff-workspace.js';import {setLanguage} from '../src/i18n/index.js';\nlocalStorage.clear();sessionStorage.clear();setLanguage('en');\nconst user={id:777,username:'editor',staff:true,superuser:false,appearance_session:'fixture',preferences:{interface:'xp',uiLanguage:'en',navScale:70,navPinned:true}};\nconfigureStaffWorkspace(user);\nlet imported=false,seen=[];\nwindow.fetch=async(url,options={})=>{seen.push({url,...options});let body={};\nif(String(url).includes('content-packages'))body=options.method==='POST'?(options.body.get('confirm')?(imported=true,{already_imported:false}):{title:'Batch',language:'de',mode:'append',preview_token:'fixture',changes:[{action:'create',path:['Imported deck']}]}):{items:[],batches:[],revision:'v1'};\nelse if(String(url).includes('/learning/sync/'))body={accepted:[],errors:[]};\nelse if(String(url).includes('/decks/'))body={folders:[],decks:[{id:1,title:'Shared vocabulary',count:1,mastered:0,visibility:'public'}]};\nelse if(String(url).includes('/practice-hub/'))body={nodes:[]};\nelse if(String(url).includes('/settings/'))body={language:'de'};\nelse if(String(url).includes('content-policy'))body={mode:'choice'};\nreturn Response.json(body,{headers:{'X-Wortify-Revision':'v1'}});};\nconst root=createRoot(document.getElementById('root'));const route='/de/flashcard';\nroot.render(<WindowContext.Provider value={{route,navigate:()=>{},active:true,get toolsTarget(){return document.getElementById('workspace-tools')}}}><Workspace user={user} setUser={()=>{}} lang='de' parts={['de','flashcard']} route={route} appearance={{data:{}}}/></WindowContext.Provider>);\nlet stage='workspace';const wait=()=>new Promise(r=>setTimeout(r,200));const check=(ok,msg)=>{if(!ok)throw Error(msg)};\nasync function until(fn){for(let i=0;i<60;i++){if(fn())return;await wait();}throw Error('Timed out at '+stage);}\nasync function click(label){stage=label;await until(()=>[...document.querySelectorAll('button')].find(b=>(b.textContent.trim()===label||b.getAttribute('aria-label')===label)&&!b.disabled));[...document.querySelectorAll('button')].find(b=>(b.textContent.trim()===label||b.getAttribute('aria-label')===label)&&!b.disabled).click();await wait();await wait();}\n(async()=>{\nawait until(()=>document.querySelector('[aria-label=\"Staff tools\"]'));await wait();await wait();\ncheck(document.documentElement.dataset.interface==='studio','Saved XP escaped Studio restriction');\ncheck(!document.querySelector('.windows-taskbar'),'Staff rendered Windows');\ncheck(document.querySelector('[aria-label=\"Staff tools\"]'),'Staff tools missing');\ncheck(seen.find(call=>String(call.url).endsWith('/decks/'))?.headers['X-Wortify-Workspace']==='shared','Library scope missing');\nif(innerWidth<=1024)document.querySelector('.mobile-nav-bar button:nth-child(2)').click();else document.querySelector('.nav-front .nav-rotate').click();await wait();await wait();\ncheck(document.querySelector('#workspace-tools [aria-label=\\\"Staff tools\\\"]'),'Staff tools do not reuse the page tools area');\ncheck(!document.querySelector('main > [aria-label=\\\"Staff tools\\\"]'),'Extra staff toolbar in ordinary learning view');\nawait click('Bulk import');await until(()=>document.body.textContent.includes('Wortify content'));\nawait click('Import');await until(()=>document.querySelector('textarea:not([readonly])'));\nconst text=document.querySelector('textarea:not([readonly])');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(text,'Fixture package');text.dispatchEvent(new Event('input',{bubbles:true}));await wait();\nawait click('Preview file');await until(()=>document.body.textContent.includes('Imported deck'));\nawait click('Import and publish as Wortify');check(imported,'Import did not publish');\nstage='close import';document.querySelector('[role=dialog] button[aria-label=Close]').click();await until(()=>!document.querySelector('[role=dialog]'));await click('Wortify library');await until(()=>document.body.textContent.includes('Switch to Personal sandbox?'));\ncheck(document.querySelector('[role=\"dialog\"]').textContent.includes('Unsaved edits'),'Workspace switch lost discard confirmation');\ncheck(document.querySelector('[role=\"dialog\"]').textContent.includes('Switch workspace'),'Wrong destructive confirmation label');\nroot.render(<div id='staff-settings-test'><Settings lang='de' prefs={{interface:'studio'}} setPrefs={()=>{}} staff={true} superuser={false} userId={777} appearance={{}}/></div>);\nawait until(()=>document.querySelector('#staff-settings-test'));await wait();await wait();\ncheck(document.querySelectorAll('.interface-option').length===0,'Other themes still offered to staff');\ncheck(document.documentElement.dataset.interface==='studio','Studio missing');\nroot.render(<WindowContext.Provider value={{route,navigate:()=>{},active:true,get toolsTarget(){return document.getElementById('workspace-tools')}}}><Workspace user={user} setUser={()=>{}} lang='de' parts={['de','flashcard']} route={route} appearance={{data:{}}}/></WindowContext.Provider>);\nawait until(()=>document.querySelector('[aria-label=\\\"Staff tools\\\"]'));await wait();await wait();\ncheck(document.documentElement.scrollWidth<=innerWidth+2,'Staff page overflows viewport');\ndocument.querySelectorAll('.brand-logo').forEach(img=>img.src=new URL('../public/brand/wortify-logo.png',location.href).href);\ndocument.getElementById('result').textContent='PASS: actual staff workspace forces Studio, shared library header, shared page-tools bulk import preview/publication, protected scope switch and Studio-only settings';\n})().catch(error=>document.getElementById('result').textContent='FAIL: '+error.message);\n");
await build({
  configFile: false,
  plugins: [react()],
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    lib: {
      entry,
      name: "StaffWorkspaceCheck",
      formats: ["iife"],
      fileName: () => "staff-workspace-check.js",
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
  path.join(dir, "staff-workspace-check.js"),
  "utf8",
);
const file = path.join(dir, "staff-workspace.html");
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
    "--user-data-dir=" + path.join(dir, "chrome-staff-workspace-check"),
    "--virtual-time-budget=20000",
    "--dump-dom",
    "--screenshot=" +
      path.join(
        dir,
        mobile ? "staff-workspace-mobile.png" : "staff-workspace.png",
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
  path.join(dir, "staff-workspace-dom.html"),
  result.stdout || "",
);
const match = result.stdout?.match(/<pre id="result"[^>]*>([^<]+)<\/pre>/);
if (!match?.[1].startsWith("PASS")) throw Error(match?.[1] || result.stderr);
console.log(match[1]);
