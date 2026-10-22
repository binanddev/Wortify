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
const entry = path.join(dir, "flashcard-dictation-check.jsx");
await fs.writeFile(
  entry,
  `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import Studio from '../src/features/flashcards/flashcard-studio.jsx';import {WindowContext} from '../src/lib/core.js';import {setLanguage,t as tr} from '../src/i18n/index.js';
const [scenario='dictation',theme='studio']=location.hash.slice(1).split('/');document.documentElement.dataset.interface=theme;const spoken=[],events=[];let current=null,cancels=0;
window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
Object.defineProperty(window,'speechSynthesis',{configurable:true,value:scenario==='unsupported'?undefined:{cancel(){cancels++;if(current){const old=current;current=null;queueMicrotask(()=>old.onerror?.({error:'canceled'}));}},resume(){},speak(u){spoken.push({text:u.text,lang:u.lang});current=u;},get speaking(){return !!current;}}});
const card={id:1,german_text:'der Bahnhof',vietnamese_meaning:'nhà ga xe lửa',accepted_answers:['Bahnhof'],example_german:'Wir treffen uns am Bahnhof.',example_vietnamese:'Chúng ta gặp nhau ở nhà ga.'};
const options={mode:scenario==='test'?'test':'learn',types:['written','silent'].includes(scenario)?['written']:scenario==='settings'?['written','dictation']:['dictation'],gradingMode:scenario==='settings'?'exact':'flexible',listenBeforeAnswer:scenario!=='silent',showExampleAfterAnswer:true,speakAfterCorrect:scenario==='feedbackaudio',goal:'comprehensive',frontVoice:'de-DE'};
window.fetch=async(url,request={})=>{if(String(url).includes('learning/sync')){const batch=JSON.parse(request.body).events;events.push(...batch);return Response.json({accepted:batch.map(e=>({token:e.token,result:{saved:true}})),errors:[]});}return Response.json({deck:{id:1,title:'Hören & Schreiben'},cards:[card,{...card,id:2}],learning:{options},study_defaults:{}});};
const root=createRoot(document.getElementById('root')),wait=()=>new Promise(r=>setTimeout(r,160)),assert=(v,m)=>{if(!v)throw Error(m)};
const button=label=>{const b=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===tr(label)||b.textContent.trim()===tr(label));assert(b,'Missing button: '+label);return b;};
const enter=(el,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));};
let setActive;
function Harness(){const [active,update]=useState(true);setActive=update;return <WindowContext.Provider value={{active,route:'/de/flashcard/deck/1?mode='+options.mode}}><Studio lang='de' id={1} userId={9908} sound={false}/></WindowContext.Provider>}
(async()=>{
localStorage.clear();setLanguage('en');root.render(<Harness/>);await wait();await wait();await wait();
if(scenario==='settings'){
button('Study options').click();await wait();await wait();
assert(document.querySelector('[role=dialog]'),'Study modal missing');
for(const language of ['vi','de','en']){setLanguage(language);await wait();assert(document.querySelector('[role=dialog]').textContent.includes(tr('Listen and write')),'Dictation label missing in '+language);assert(document.querySelector('[role=dialog]').textContent.includes(tr('Answer checking')),'Checking translation missing');}
const select=[...document.querySelectorAll('[role=dialog] label')].find(el=>el.textContent.includes('Answer checking')).querySelector('select');select.value='flexible';select.dispatchEvent(new Event('change',{bubbles:true}));await wait();
assert(document.querySelector('[role=dialog]').textContent.includes('70%'),'70 percent option missing');
assert(document.querySelector('[role=dialog]').textContent.includes('Both dictation answers must pass'),'Grading note missing');setLanguage('vi');await wait();document.getElementById('result').textContent='PASS: translated study options, dictation, audio checkbox, grading selection';return;
}
button('Start learning').click();await wait();await wait();
const questions=()=>[...document.querySelectorAll('.flash-question')],inputs=q=>[...q.querySelectorAll('input')];
if(scenario==='test'){
assert(questions().length===2,'Test did not include dictation');assert(spoken.length===0,'All test questions started audio automatically');
const first=inputs(questions()[0]);first[0].focus();await wait();assert(spoken.length===1,'Focused test question did not play');enter(first[0],'der Bahnhof');enter(first[1],'wrong');await wait();questions()[0].querySelector('.dictation-fields button').click();await wait();assert(first.every(el=>el.disabled),'Test permits multiple scored attempts');
const second=inputs(questions()[1]);second[0].focus();await wait();assert(spoken.length===2,'Second test audio missing');enter(second[0],'der Banhof');enter(second[1],'nhà ga lửa');await wait();questions()[1].querySelector('.dictation-fields button').click();await wait();assert(questions()[1].querySelectorAll('.is-accepted').length===2,'Flexible test result incorrect');document.getElementById('result').textContent='PASS: test audio on focus, single-attempt scores and independently graded dictation fields';return;
}
if(scenario==='silent'){assert(spoken.length===0&&!document.querySelector('.question-audio'),'Unchecked written audio still plays');document.getElementById('result').textContent='PASS: written audio stays off when the option is unchecked';return;}
if(scenario==='written'){
assert(spoken.length===1&&spoken[0].text===card.german_text,'Optional written audio did not play');const input=inputs(questions()[0])[0];enter(input,'der Banhof');await wait();button('Check answer').click();await wait();assert(!button('Next question').disabled,'Flexible written answer not accepted');assert(document.querySelector('.word-diff-replace ins'),'Typo correction missing');document.getElementById('result').textContent='PASS: optional term audio before written response and highlighted accepted typo';return;
}
let q=questions()[0],fields=inputs(q);assert(fields.length===2,'Dictation needs two fields');
assert(!q.textContent.includes(card.german_text)&&!q.textContent.includes(card.vietnamese_meaning),'Dictation exposes answers before submission');
if(scenario==='unsupported'){
assert(document.getElementById('root').textContent.includes('does not support speech synthesis'),'Missing unsupported speech message');assert(fields.every(el=>!el.disabled),'Unsupported audio blocks response');document.getElementById('result').textContent='PASS: unsupported speech shows feedback and keeps answers editable';return;
}
assert(spoken.length===1&&spoken[0].lang==='de-DE'&&spoken[0].text===card.german_text,'Dictation autoplay text or voice incorrect');
setActive(false);await wait();assert(cancels>0&&!current,'Inactive window did not stop speech');setActive(true);await wait();
button('Play term').click();await wait();assert(spoken.length===2,'Replay starts more than once or fails');
enter(fields[0],'der Banhof');enter(fields[1],'nhà ga');await wait();button('Check answer').click();await wait();
assert(q.querySelectorAll('.is-accepted').length===1&&q.querySelectorAll('.needs-retry').length===1,'Each field must be graded separately');assert(button('Next question').disabled,'Averaging fields allowed progression');assert(!document.querySelector('.flash-example-feedback'),'Incorrect dictation exposes example');assert(q.querySelector('ins'),'Missing words not inserted');
enter(fields[1],'nhà ga lửa');await wait();button('Check answer').click();await wait();assert(!button('Next question').disabled,'Two 70-percent answers not accepted');assert(document.querySelector('.flash-example-feedback'),'Accepted dictation missing example');
if(scenario==='feedbackaudio'){assert(current?.text===card.german_text,'Question cleanup canceled pronunciation after a correct answer');document.getElementById('result').textContent='PASS: pronunciation after a correct answer survives question audio cleanup';return;}
button('Next question').click();await wait();q=questions()[0];fields=inputs(q);assert(fields.every(el=>!el.value&&!el.disabled),'Next question retained input or lock');assert(!q.querySelector('.written-feedback'),'Next retains old feedback');assert(spoken.length===3,'Next dictation did not play');
button('Show answer').click();await wait();assert(fields.every(el=>!el.disabled)&&button('Next question').disabled,'Reveal prevents retry or enables Next');
enter(fields[0],'der Banhof');enter(fields[1],'nhà ga lửa');await wait();button('Check answer').click();await wait();assert(!button('Next question').disabled,'Retry after reveal failed');assert(q.querySelectorAll('.is-accepted').length===2,'Accepted feedback missing');
const luminance=color=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,1,1);const rgb=[...ctx.getImageData(0,0,1,1).data].slice(0,3).map(v=>{v/=255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);});return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;};
for(const element of q.querySelectorAll('.word-diff-correct,ins,del,.is-accepted')){const style=getComputedStyle(element),a=luminance(style.color),b=luminance(style.backgroundColor);assert((Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)>=4.5,'Feedback contrast below 4.5: '+theme+' '+element.className);}
document.documentElement.classList.add('fixture-review');document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,0);document.getElementById('result').textContent='PASS: dictation autoplay, replay, focus cleanup, two-field threshold, colored corrections and retry after reveal';
})().catch(e=>document.getElementById('result').textContent='FAIL: '+e.message);`,
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
      fileName: () => "flashcard-dictation-check.js",
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
  path.join(dir, "flashcard-dictation-check.js"),
  "utf8",
);
const file = path.join(dir, "flashcard-dictation.html");
await fs.writeFile(
  file,
  `<!doctype html><html data-interface="studio"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}
.fixture-review #workspace-tools,.fixture-review .page > :not(.work-paper){display:none!important}.fixture-review #fixture-layout{display:block!important}.fixture-review .page,.fixture-review .work-paper{margin:0!important;padding:16px!important}
</style><body style="width:${mobile ? 390 : 1440}px;max-width:100%;margin:0"><div id="fixture-layout" style="display:grid;grid-template-columns:${mobile ? "minmax(0,1fr)" : "260px minmax(0,1fr)"};gap:24px;padding:20px"><aside id="workspace-tools" style="background:var(--surface);padding:16px;border-radius:16px;min-width:0"></aside><div id="root" style="min-width:0"></div></div><pre id="result" hidden></pre><script>window.onerror=(m)=>document.getElementById("result").textContent="FAIL: "+m;</script><script>${js.replaceAll("</script", "<\/script")}</script></body></html>`,
);
for (const scenario of ["dictation/studio", "dictation/glass", "dictation/xp", "dictation/retro", "dictation/notebook", "dictation/rpg", "written/studio", "silent/studio", "feedbackaudio/studio", "test/studio", "unsupported/studio", "settings/studio"]) {
const result = spawnSync(
  process.env.CHROME_PATH ||
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  [
    "--headless",
    "--disable-gpu",
    "--no-first-run",
    mobile ? "--window-size=390,844" : "--window-size=1440,1000",
    "--user-data-dir=" + path.join(dir, "chrome-flashcard-dictation-check"),
    "--virtual-time-budget=18000",
    "--dump-dom",
    "--screenshot=" +
      path.join(
        dir,
        `flashcard-${scenario.replace("/", "-")}${mobile ? "-mobile" : ""}.png`,
      ),
    pathToFileURL(file).href + "#" + scenario,
  ],
  {
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000,
    maxBuffer: 8 * 1024 * 1024,
  },
);
const match = result.stdout?.match(/<pre id="result"[^>]*>([^<]+)<\/pre>/);
if (!match?.[1].startsWith("PASS")) throw Error(scenario + ": " + (match?.[1] || result.stderr));
console.log(scenario + ": " + match[1]);

}
