import { build } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
process.chdir(path.resolve(import.meta.dirname, ".."));
const dir = path.resolve(".interface-preview");
await fs.mkdir(dir, { recursive: true });
const entry = path.join(dir, "exercise-typography-check.jsx");
await fs.writeFile(
  entry,
  String.raw`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {GapPassage} from '../src/features/practice/exercise-interactions.jsx';import {TheoryActivity} from '../src/features/practice/practice-theory.jsx';import {PracticeRichText} from '../src/features/practice/practice-rich-text.jsx';
const q={id:'q1',prompt:'Q: {{1}} wartest du? \\newline \\textit{A: Auf den Bus.}',blanks:[{answers:['Worauf'],options:['Worauf','Womit']}],presentation:{}};
const drag={id:'q2',prompt:'\\begin{tabular}{lc}ich & {{1}}\\end{tabular}',blanks:[{answers:['bin']}],presentation:{word_bank:['bin','bist']}};
function Probe(){const [answers,setAnswers]=useState({});const onAnswer=(k,v)=>setAnswers(a=>({...a,[k]:v}));return <><section id="inline" className="exercise-workspace"><button className="pair-card"><span>Pair text</span></button><GapPassage q={q} mode="inline_selection" answers={answers} onAnswer={onAnswer} uiStyle="pill_toggle"/></section><section id="drag"><GapPassage q={drag} mode="cloze_drag_drop" answers={answers} onAnswer={onAnswer} uiStyle="tap_fill"/></section><TheoryActivity payload={{content:'\\section{Theory}\\begin{tabular}{ll}A & B \\\\ C & D\\end{tabular}'}}/><div id="unsafe"><PracticeRichText>{'<script>window.bad=true</script>\\includegraphics{javascript:alert(1)}'}</PracticeRichText></div></>}
createRoot(document.getElementById('root')).render(<Probe/>);
const wait=()=>new Promise(r=>setTimeout(r,300));
(async()=>{await wait();const line=document.querySelector('#inline em'),button=document.querySelector('#inline .inline-pills button');if(line.getBoundingClientRect().top<=button.getBoundingClientRect().top)throw Error('Answer not on new line');[...document.querySelectorAll('#inline button')].find(b=>b.textContent==='Worauf').click();await wait();if(!document.querySelector('#inline button[aria-pressed="true"]'))throw Error('Inline answer failed');[...document.querySelectorAll('#drag .gap-bank-token')].find(b=>b.textContent==='bin').click();await wait();if(document.querySelector('#drag .gap-drop').textContent!=='bin')throw Error('Table gap failed');if(document.querySelectorAll('.lesson-document [role="row"]').length!==2)throw Error('Theory table failed');if(window.bad||document.querySelector('#unsafe script')||document.querySelector('#unsafe img'))throw Error('Unsafe content executed');for(const theme of ['studio','glass','notebook','rpg','retro','xp']){document.documentElement.dataset.interface=theme;document.documentElement.style.setProperty('--exercise-text-size','28px');document.documentElement.style.setProperty('--exercise-text-weight','600');for(const selector of ['#inline .fluid-passage','#inline .pair-card > span']){const style=getComputedStyle(document.querySelector(selector));if(style.fontSize!=='28px'||style.fontWeight!=='600')throw Error(theme+' typography: '+style.fontSize+'/'+style.fontWeight);}}document.getElementById('result').textContent='PASS: exercise typography across six themes;  dialogue line break, inline selection, table gap filling, theory table and escaped unsafe markup';})().catch(e=>document.getElementById('result').textContent='FAIL: '+e.message);
`,
);
await build({
  configFile: false,
  plugins: [react()],
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    lib: {
      entry,
      name: "LessonMarkupCheck",
      formats: ["iife"],
      fileName: () => "exercise-typography-check.js",
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
const js = await fs.readFile(path.join(dir, "exercise-typography-check.js"), "utf8");
const file = path.join(dir, "exercise-typography.html");
await fs.writeFile(
  file,
  `<!doctype html><html data-interface="notebook"><meta charset="utf-8"><style>${css}</style><body><div id="root"></div><pre id="result" hidden></pre><script>${js.replaceAll("</script", "<\/script")}</script></body></html>`,
);
const result = spawnSync(
  process.env.CHROME_PATH ||
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  [
    "--headless",
    "--disable-gpu",
    "--no-first-run",
    "--window-size=1440,1000",
    "--user-data-dir=" + path.join(dir, "chrome-exercise-typography-check"),
    "--virtual-time-budget=4000",
    "--dump-dom",
    "--screenshot=" + path.join(dir, "exercise-typography.png"),
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
