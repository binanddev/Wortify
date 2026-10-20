import { build } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
process.chdir(path.resolve(import.meta.dirname, ".."));
const dir = path.resolve(".interface-preview");
await fs.mkdir(dir, { recursive: true });
const entry = path.join(dir, "defense-check.jsx");
const flight = process.argv.includes("--flight");
const setup = process.argv.includes("--setup"),
  mobile = process.argv.includes("--mobile");
await fs.writeFile(
  entry,
  `
import React from 'react';import {createRoot} from 'react-dom/client';
import Defense from '../src/features/flashcards/defense/FlashcardDefense.jsx';
import {setLanguage} from '../src/i18n/index.js';
setLanguage('vi');
const cards=[['Bahnhof','nhà ga'],['Abenteuer','cuộc phiêu lưu'],['Sonne','mặt trời'],['Wasser','nước'],['Freundschaft','tình bạn'],['Wald','khu rừng']].map(([german_text,vietnamese_meaning],i)=>({id:i+1,german_text,vietnamese_meaning}));
const data={deck:{id:1,title:'Deutsch · Alltag A2',language:'de'},cards,learning:{progress:{2:{misses:4}}},difficult_cards:[2]};
localStorage.setItem('wortify:defense:1:de',JSON.stringify({game:'defense',targeting:'guided',mode:'zen',difficulty:'hard',direction:'term',sound:true}));
let writes=0;window.fetch=async(url,opts)=>{if(opts?.method && opts.method!=='GET')writes++;return new Response(JSON.stringify({decks:[{...data.deck,count:6}]}),{headers:{'Content-Type':'application/json'}});};
window.addEventListener('error',e=>document.getElementById('result').textContent='FAIL: '+e.message);
window.addEventListener('unhandledrejection',e=>document.getElementById('result').textContent='FAIL: '+e.reason);
const reactRoot=createRoot(document.getElementById('root'));reactRoot.render(<Defense lang="de" userId={1} initialDeck={data} onClose={()=>{}}/>);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const assert=(v,m)=>{if(!v)throw new Error(m);};
(async()=>{
 await wait(1000);const shadow=document.querySelector('[data-game-root]');assert(shadow,'Game root not mounted');window.tapEvents=[];for(const name of ['pointerdown','pointerup','touchstart','touchend','click'])shadow.addEventListener(name,e=>window.tapEvents.push(name+':'+e.target.tagName+':'+e.target.textContent.slice(0,30)),true);
 ${flight ? "const picker=shadow.querySelector('select');picker.value='flight';picker.dispatchEvent(new Event('change',{bubbles:true}));await wait(100);" : ""}
 assert(shadow.textContent.includes('${flight ? "Bắt đầu bay" : "Bắt đầu phòng thủ"}'),'Vietnamese labels missing');
 assert(shadow.querySelectorAll('select').length===${flight ? 4 : 5},'Game settings missing');
 const click=async text=>{const el=[...shadow.querySelectorAll('button')].find(el=>el.textContent.includes(text));assert(el,'Button missing '+text);el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();window.pendingClick={x:r.x+r.width/2,y:r.y+r.height/2};while(window.pendingClick)await wait(30);};
 ${setup ? "document.getElementById('result').textContent='PASS: isolated setup, deck selection, game options and Vietnamese UI';" : `await click('${flight ? "Bắt đầu bay" : "Bắt đầu phòng thủ"}');await wait(4500);assert(shadow.querySelector('canvas'),'Phaser canvas not mounted');assert(!shadow.querySelector('.fd-error'),'Game initialization failed');assert(shadow.querySelector('input[autocomplete=off]'),'Keyboard input missing');await click('Tạm dừng');await wait(100);assert(shadow.querySelector('.fd-cover'),'Pause failed');await click('Tiếp tục');await wait(100);assert(!shadow.querySelector('.fd-cover'),'Resume failed');assert(document.activeElement===shadow.querySelector('input[autocomplete=off]'),'Direct typing is not focused');assert(getComputedStyle(document.activeElement).opacity==='0','Typing form should not be visible');const prompt=shadow.querySelector('.fd-target-copy')?.textContent;const word=cards.find(c=>c.vietnamese_meaning===prompt)?.german_text;assert(word,'Current target missing');window.pendingText=word.slice(0,2);while(window.pendingText)await wait(30);await wait(150);assert(shadow.querySelector('.fd-live-answer').textContent===word.slice(0,2),'Typed letters are not displayed');${flight ? "window.pendingText=word.slice(2);while(window.pendingText)await wait(30);await wait(150);assert(shadow.textContent.includes('Vỗ cánh'),'Flight did not resume after correct answer');await click('Vỗ cánh');" : "await click('Đổi mục tiêu');await wait(100);assert(shadow.querySelector('.fd-live-answer').textContent==='＿','Changing target kept stale input');"}assert(writes===0,'Unexpected learning writes');document.getElementById('result').textContent='PASS: ${flight ? "flight" : "defense"} starts, pauses, resumes and displays native typing without progress writes';`}
})().catch(e=>document.getElementById('result').textContent='FAIL: '+e.message);
`,
);
if (process.argv.includes("--scene")) {
  await fs.writeFile(
    entry,
    `
import {launchDefense} from '../src/features/flashcards/defense/defense-scene.js';
import {createDefense} from '../src/features/flashcards/defense/defense-engine.js';
const words=[['Bahnhof','nhà ga'],['Abenteuer','cuộc phiêu lưu'],['Freundschaft','tình bạn'],['Sonne','mặt trời']];
setTimeout(()=>{},6000);
const game=createDefense(words.map(([answer,prompt],i)=>({id:String(i),answer,prompt,language:'de-DE'})),{difficulty:'hard',mode:'zen'});
game.state.rocks=words.map(([answer,prompt],i)=>({id:i+1,card:{answer,prompt,language:'de-DE'},lane:i,kind:['freeze','boss','health','nuke'][i],y:[.24,.44,.13,.64][i],typed:i===1?'A':'',armor:i===1?2:1,hints:i===3?2:0}));
game.state.target=2;game.pause(true);
const parent=document.createElement('div');parent.style.cssText='position:fixed;inset:0;background:#081127';document.body.append(parent);
launchDefense(parent,game,{audio:{tone(){},speak(){},stop(){}},labels:{freeze:'ĐÓNG BĂNG',boss:'BOSS',health:'HỒI MÁU',nuke:'BOM',listen:'Chạm để nghe'},onFrame(){},onFocus(){},onEnd(){},onReady(){document.getElementById('result').textContent='PASS: four meteor types rendered with Vietnamese labels';}});
`,
  );
}
await build({
  configFile: false,
  plugins: [react()],
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    lib: {
      entry,
      name: "DefenseCheck",
      formats: ["iife"],
      fileName: () => "defense-check.js",
    },
    outDir: dir,
    emptyOutDir: false,
    minify: true,
  },
});
const js = await fs.readFile(path.join(dir, "defense-check.js"), "utf8");
const html = path.join(dir, "defense-check.html");
await fs.writeFile(
  html,
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><pre id="result" style="position:fixed;bottom:0;z-index:20000;font:9px monospace;color:white"></pre><script>${js.replaceAll("</script", "<\\/script")}</script></body></html>`,
);
// The parent deliberately swallows keyboard events. The game must still type
// because it runs in a separate browsing context, without an application server.
const childHtml = await fs.readFile(html, "utf8");
await fs.writeFile(
  html,
  `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><iframe id="game" title="Game test" style="position:fixed;inset:0;width:100%;height:100%;border:0" allow="autoplay"></iframe><pre id="result" hidden></pre><script>
window.parentKeys=0;window.addEventListener('keydown',e=>{window.parentKeys++;e.preventDefault();e.stopImmediatePropagation();},true);
const frame=document.getElementById('game');frame.srcdoc=${JSON.stringify(childHtml).replaceAll("</script", "<\\/script")};
for(const key of ['pendingText','pendingClick','tapEvents'])Object.defineProperty(window,key,{get:()=>frame.contentWindow[key],set:v=>{frame.contentWindow[key]=v;}});
setInterval(()=>{document.getElementById('result').textContent=frame.contentDocument?.getElementById('result')?.textContent||'';},50);
</script></body></html>`,
);
const browser =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

// Drive a headless browser against file:// only. No application server.
const child = spawn(
  browser,
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-background-networking",
    "--disable-extensions",
    "--no-first-run",
    "--remote-debugging-port=0",
    "--autoplay-policy=no-user-gesture-required",
    "--user-data-dir=" + path.join(dir, "chrome-defense-" + Date.now()),
    "about:blank",
  ],
  { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] },
);
let ws,
  id = 0;
const pending = new Map(),
  errors = [];
const timer = setTimeout(() => {
  console.error("Browser check timed out");
  child.kill();
  process.exit(1);
}, 45000);
try {
  const url = await new Promise((resolve, reject) => {
    let text = "";
    child.stderr.on("data", (b) => {
      text += b;
      const m = text.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (m) resolve(m[1]);
    });
    child.on("error", reject);
  });
  ws = new WebSocket(url);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  ws.addEventListener("message", ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p?.reject(msg.error);
      else p?.resolve(msg.result);
    } else if (msg.method === "Runtime.exceptionThrown")
      errors.push(
        msg.params.exceptionDetails.exception?.description ||
          msg.params.exceptionDetails.text,
      );
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, { resolve, reject });
      ws.send(
        JSON.stringify({
          id: n,
          method,
          params,
          ...(sessionId ? { sessionId } : {}),
        }),
      );
    });
  const { targetId } = await send("Target.createTarget", {
    url: "about:blank",
  });
  const { sessionId } = await send("Target.attachToTarget", {
    targetId,
    flatten: true,
  });
  await send("Runtime.enable", {}, sessionId);
  await send("Page.enable", {}, sessionId);
  await send(
    "Emulation.setDeviceMetricsOverride",
    {
      width: mobile ? 390 : 1440,
      height: mobile ? 844 : 1000,
      deviceScaleFactor: 1,
      mobile,
    },
    sessionId,
  );
  if (mobile)
    await send(
      "Emulation.setTouchEmulationEnabled",
      { enabled: true, maxTouchPoints: 1 },
      sessionId,
    );
  await send("Page.navigate", { url: pathToFileURL(html).href }, sessionId);
  let status = "";
  for (let n = 0; n < 100; n++) {
    await new Promise((r) => setTimeout(r, 150));
    const v = await send(
      "Runtime.evaluate",
      {
        expression: 'document.getElementById("result")?.textContent',
        returnByValue: true,
      },
      sessionId,
    );
    status = v.result.value || "";
    const click = await send(
      "Runtime.evaluate",
      { expression: "window.pendingClick", returnByValue: true },
      sessionId,
    );
    if (click.result.value) {
      const { x, y } = click.result.value;
      if (mobile) {
        await send(
          "Input.dispatchTouchEvent",
          { type: "touchStart", touchPoints: [{ x, y }] },
          sessionId,
        );
        await new Promise((r) => setTimeout(r, 80));
        await send(
          "Input.dispatchTouchEvent",
          { type: "touchEnd", touchPoints: [] },
          sessionId,
        );
      } else {
        await send(
          "Input.dispatchMouseEvent",
          { type: "mousePressed", x, y, button: "left", clickCount: 1 },
          sessionId,
        );
        await send(
          "Input.dispatchMouseEvent",
          { type: "mouseReleased", x, y, button: "left", clickCount: 1 },
          sessionId,
        );
      }
      await send(
        "Runtime.evaluate",
        { expression: "window.pendingClick=null" },
        sessionId,
      );
    }
    const typing = await send(
      "Runtime.evaluate",
      { expression: "window.pendingText", returnByValue: true },
      sessionId,
    );
    if (typing.result.value) {
      if (mobile)
        await send(
          "Input.insertText",
          { text: typing.result.value },
          sessionId,
        );
      else
        for (const key of typing.result.value) {
          await send(
            "Input.dispatchKeyEvent",
            { type: "keyDown", key, text: key },
            sessionId,
          );
          await send(
            "Input.dispatchKeyEvent",
            { type: "keyUp", key },
            sessionId,
          );
        }
      await send(
        "Runtime.evaluate",
        { expression: "window.pendingText=null" },
        sessionId,
      );
    }
    if (status || errors.length) break;
  }
  await new Promise((r) => setTimeout(r, 700));
  const shot = await send(
    "Page.captureScreenshot",
    { format: "png" },
    sessionId,
  );
  await fs.writeFile(
    path.join(
      dir,
      `defense-${process.argv.includes("--scene") ? "scene" : setup ? "setup" : flight ? "flight" : "play"}-${mobile ? "mobile" : "desktop"}.png`,
    ),
    Buffer.from(shot.data, "base64"),
  );
  console.log(status);
  if (!status.startsWith("PASS:"))
    console.log(
      (
        await send(
          "Runtime.evaluate",
          {
            expression: "JSON.stringify(window.tapEvents)",
            returnByValue: true,
          },
          sessionId,
        )
      ).result.value,
    );
  if (errors.length) console.error(errors.join("\n"));
  if (!status.startsWith("PASS:") || errors.length) process.exitCode = 1;
  await send("Browser.close");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
  child.kill();
} finally {
  clearTimeout(timer);
  ws?.close();
}
