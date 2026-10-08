import { build } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
process.chdir(path.resolve(import.meta.dirname, ".."));
const dir = path.resolve(".interface-preview");
await fs.mkdir(dir, { recursive: true });
const entry = path.join(dir, "windows-check.jsx");
await fs.writeFile(
  entry,
  `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import Desktop from '../src/themes/windows-xp/WindowsDesktop.jsx';import Background from '../src/themes/DefaultBackground.jsx';import {Modal} from '../src/components/modal/modal.jsx';import {ModalContent,ModalHeader,ModalBody} from '@heroui/react';import {SidebarTools} from '../src/components/ui/ui.jsx';import {useRoute,useNavigate,useWindowActive} from '../src/lib/core.js';
// file:// cannot push HTTP paths; exercise scoped React routes without a server.
history.replaceState=()=>{};
for(const key of Object.keys(localStorage)){if(key.startsWith("wortify:windows-shortcut:"))localStorage.removeItem(key);}
function Probe(){const [text,setText]=useState('');const [dialog,setDialog]=useState(false);const route=useRoute(),go=useNavigate(),active=useWindowActive();return <><h1>{route}</h1><input aria-label="Answer" value={text} onChange={e=>setText(e.target.value)}/><span className="activity">{String(active)}</span><button className="inner-navigation" onClick={()=>go(route+'?draft=yes')}>Navigate</button><button className="open-child" onClick={()=>setDialog(true)}>Child window</button><Modal isOpen={dialog} onClose={()=>setDialog(false)}><ModalContent><ModalHeader>Child dialog</ModalHeader><ModalBody><button className="close-child" onClick={()=>setDialog(false)}>Close</button></ModalBody></ModalContent></Modal><SidebarTools><span className="tool-route">{route}</span></SidebarTools></>}
const root=createRoot(document.getElementById('root'));root.render(<><Background/><Desktop lang="de" route="/de/flashcard/deck/4" renderContent={()=> <Probe/>}/></>);
const tick=()=>new Promise(r=>setTimeout(r,100));const check=(ok,msg)=>{if(!ok)throw Error(msg)};
(async()=>{await tick();await tick();const first=document.querySelector('[data-window-id="flashcard"]');const input=first.querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'saved answer');input.dispatchEvent(new Event('input',{bubbles:true}));await tick();
const launch=name=>[...document.querySelectorAll('.xp-desktop-launchers button')].find(b=>b.textContent.endsWith(name)).click();launch('Practice Hub');await tick();launch('Settings');await tick();check(document.querySelectorAll('.xp-app-window').length===3,'Apps did not coexist');check(first.querySelector('input')===input && input.value==='saved answer','Opening app lost state');check(first.querySelector('h1').textContent==='/de/flashcard/deck/4','Inactive route changed');
launch('Flashcard');await tick();check(document.querySelectorAll('.xp-app-window').length===3,'Relaunch duplicated app');check(first.querySelector('.activity').textContent==='true','Focus ownership failed');check(first.querySelector('.xp-app-sidebar .tool-route').textContent==='/de/flashcard/deck/4','Wrong app sidebar');check(document.querySelector('[data-window-id="practice"] .xp-app-sidebar .tool-route').textContent==='/de/practice','Sibling sidebar changed');
first.querySelector('[title="Minimize"]').click();await tick();check(getComputedStyle(first).display==='none','Minimize failed');launch('Flashcard');await tick();check(input.value==='saved answer' && getComputedStyle(first).display!=='none','Restore lost answer');
first.querySelector('.inner-navigation').click();await tick();check(first.querySelector('h1').textContent.includes('draft=yes'),'Scoped navigation failed');check(document.querySelector('[data-window-id="practice"] h1').textContent==='/de/practice','Navigation changed other app');
first.style.width='320px';const viewport=first.querySelector('.xp-window-viewport');check(viewport.scrollWidth>viewport.clientWidth,'Narrow window did not clip/scroll');first.querySelector('[title="Maximize / Restore"]').click();await tick();check(first.getBoundingClientRect().left<5,'Maximize failed');first.querySelector('[title="Maximize / Restore"]').click();await tick();
const title=first.querySelector('header');title.setPointerCapture=()=>{};title.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:200,clientY:40}));title.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:230,clientY:60}));title.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));await tick();check(parseFloat(first.style.left)===180,'Drag failed');
const grip=first.querySelector('.xp-window-resize');grip.setPointerCapture=()=>{};grip.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:400,clientY:500}));grip.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:440,clientY:520}));grip.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));await tick();check(parseFloat(first.style.width)===900,'Resize failed');
first.querySelector('.open-child').click();await tick();await tick();const dialog=document.querySelector('[role="dialog"]');check(dialog && getComputedStyle(dialog).position!=='static','Child dialog missing');const bar=dialog.querySelector('header');bar.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:500,clientY:100}));window.dispatchEvent(new PointerEvent('pointermove',{clientX:530,clientY:120}));window.dispatchEvent(new PointerEvent('pointerup'));check(dialog.style.translate.length>0,'Child drag failed');dialog.querySelector('.close-child').click();await tick();await tick();
document.querySelector('[data-window-id="settings"] [title="Close"]').click();await tick();await tick();[...document.querySelectorAll('[role="dialog"] button')].find(b=>b.textContent==='Close window').click();await tick();await tick();check(document.querySelectorAll('.xp-app-window').length===2 && input.value==='saved answer','Close affected sibling');
const shortcut=document.querySelector('.xp-desktop-shortcut[data-app="explore"]');shortcut.setPointerCapture=()=>{};const before=shortcut.getBoundingClientRect();shortcut.dispatchEvent(new PointerEvent('pointerdown',{button:0,bubbles:true,clientX:before.x+10,clientY:before.y+10}));shortcut.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:before.x+70,clientY:before.y+30}));shortcut.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));shortcut.click();await tick();check(Math.round(shortcut.getBoundingClientRect().x-before.x)===60,'Shortcut drag failed');check(!document.querySelector('[data-window-id="explore"]'),'Drag launched app');check(localStorage.getItem('wortify:windows-shortcut:explore'),'Shortcut position not saved');
document.getElementById('result').textContent='PASS: independent app state, routes, focus/tools, minimize/restore, clipping, maximize, drag/resize, child dialogs, close';
})().catch(e=>document.getElementById('result').textContent='FAIL: '+e.message);`,
);
await build({
  configFile: false,
  plugins: [react()],
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    lib: {
      entry,
      name: "WindowsCheck",
      formats: ["iife"],
      fileName: () => "windows-check.js",
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
const js = await fs.readFile(path.join(dir, "windows-check.js"), "utf8");
const file = path.join(dir, "windows-desktop.html");
await fs.writeFile(
  file,
  `<!doctype html><html data-interface="xp"><meta charset="utf-8"><style>${css}</style><body><div id="root"></div><pre id="result" hidden></pre><script>${js.replaceAll("</script", "<\/script")}</script></body></html>`,
);
const result = spawnSync(
  process.env.CHROME_PATH ||
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  [
    "--headless",
    "--disable-gpu",
    "--no-first-run",
    "--window-size=1440,1000",
    "--user-data-dir=" + path.join(dir, "chrome-windows-check"),
    "--virtual-time-budget=4000",
    "--dump-dom",
    "--screenshot=" + path.join(dir, "windows-desktop.png"),
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
