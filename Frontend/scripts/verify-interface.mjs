// Render a local fixture with production CSS. No application server; the fixture has no remote resources.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { THEME_ICONS } from "../src/theme-icons.js";
import { ICON_PATHS } from "../src/icon-paths.js";
const browser =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
await fs.access(browser);
const dist = path.resolve(import.meta.dirname, "../dist/assets");
const cssFile = (await fs.readdir(dist)).find((name) =>
  /^index-.*\.css$/.test(name),
);
if (!cssFile)
  throw new Error("Build the frontend before rendering the interface fixture.");
const liveOrigin = process.env.INTERFACE_ORIGIN;
let css;
if (liveOrigin) {
  const origin = new URL(liveOrigin);
  if (!['127.0.0.1', 'localhost'].includes(origin.hostname)) throw new Error('Only a local existing dev server is supported.');
  const response = await fetch(new URL('/src/design-system/index.css?direct', origin));
  if (!response.ok) throw new Error(`Dev CSS request failed: ${response.status}`);
  css = await response.text();
  if (!css.includes('--auto-ink')) throw new Error('The running dev server is serving stale CSS: automatic contrast rules are missing.');
} else css = await fs.readFile(path.join(dist, cssFile), "utf8");
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "wortify-interface-"));
const icon = (name) =>
  `<svg class="app-icon" data-icon="${name}" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path class="icon-family icon-default" d="${ICON_PATHS[name]}"/>${Object.entries(THEME_ICONS).map(([theme,paths])=>`<g class="icon-family icon-${theme}"><path d="${paths[name] || ICON_PATHS[name]}"/></g>`).join("")}</svg>`;
const autoCode = (await fs.readFile(new URL("../src/auto-contrast.js", import.meta.url), "utf8")).replaceAll("export ", "");
const html = `<!doctype html><html data-interface="studio" data-background="mist"><meta charset="utf-8"><style>${css}</style>
<style>${css.replaceAll(":hover", "[data-test-hover]")}</style>
<body><div class="app-shell" style="--nav-width:320px;--nav-scale:1">
<div class="nav-flip"><div class="nav-flip-inner"><div class="nav-face is-active"><div class="nav-static"><strong class="brand">Wortify</strong>${icon("flip")}</div><aside class="sidebar open"><a class="workspace-select">DE · Deutsch ${icon("chevron_down")}</a><nav><a class="nav-link active">${icon("cards")} Flashcard</a><a class="nav-link">${icon("book")} Practice Hub</a><a class="nav-link">${icon("search")} Explore</a><a class="nav-link">${icon("edit")} Create</a></nav><nav><a class="nav-link">${icon("user")} Hành trình học</a><a class="nav-link">${icon("settings")} Cài đặt học tập</a></nav></aside></div></div></div>
<div class="main-shell"><header class="studio-masthead"><div><span class="studio-kicker">WORTIFY / KHÔNG GIAN HỌC</span><strong>Flashcard</strong></div><div class="studio-session-badge">${icon("spark")} Mỗi ngày, một bước tiến</div></header><main><div class="page"><div class="heading"><div><span class="eyebrow">TIẾNG ĐỨC · A1</span><h1>Một chút tiếng Đức,<br>mỗi ngày.</h1><p>Những từ quen thuộc cho cuộc sống hàng ngày.</p></div></div><div class="toolbar"><button class="btn primary">${icon("cards")} Thẻ ghi nhớ</button><button class="btn">${icon("exercise")} Luyện tập</button><button class="btn">${icon("check")} Kiểm tra</button></div><button class="flip-stage" aria-pressed="false" style="margin-top:28px"><span class="flip-inner"><span class="flip-face"><span class="eyebrow">TỪ VỰNG</span><strong>die Sonnenblume</strong><span class="example">Một từ mới, một khám phá mới.</span></span><span class="flip-face flip-back"><strong>hoa hướng dương</strong></span></span></button><div class="card-navigation"><button class="btn">${icon("chevron_left")}</button><span>3 / 24</span><button class="btn primary">${icon("chevron_right")}</button></div></div></main></div></div><div class="exercise-workspace"><label class="partial-rewrite"><span>Ich möchte</span><input value="lernen"></label><div class="category-bin"><button class="word-chip is-wrong">Fehler</button></div><div class="fluid-passage" style="font-size:24px"><span class="gap-token"><button class="gap-drop"><span class="movable-token">Wort</span></button></span><button class="inline-choice">Wort</button></div><button class="inline-choice">Wort</button><span class="inline-pills"><button>Wort</button></span><button class="gap-drop is-active">Wort</button><div class="sentence-target"></div><div class="pairing-work"><div class="pair-column"><button class="pair-card paired">Richtig</button></div><div class="pair-column"><button class="pair-card pair-error">Falsch</button></div></div></div><div class="exercise-workspace" data-ui-style="sentence_rewrite"><textarea aria-label="Test">Ich lerne Deutsch.</textarea></div><div class="session-controls" style="width:500px"><button class="end-session">Kết thúc</button><div class="flashcard-actions"><button class="check-action">Kiểm tra</button><button class="next-question">Tiếp tục</button></div></div><pre id="results" hidden></pre>
<script>
${autoCode}
(async () => {
const errors=[];
const root=document.documentElement, card=document.querySelector('.flip-stage'), face=document.querySelector('.flip-face'), icon=document.querySelector('.nav-link .app-icon');
for(const mode of ['studio','glass']) {
 root.dataset.interface=mode;
 for(const selector of ['.inline-choice','.gap-drop','.inline-pills button']) {
   const el=document.querySelector(selector);
   for(const hover of [false,true]) {
     el.toggleAttribute('data-test-hover',hover);
     const st=getComputedStyle(el);
     if(st.backgroundColor!=='rgba(0, 0, 0, 0)' || st.borderTopWidth!=='0px' || st.borderBottomWidth==='0px') errors.push(mode+' underline '+selector+' '+st.backgroundColor+' '+st.borderTopWidth+' '+st.borderBottomWidth);
   }
 }
 for(const el of document.querySelectorAll('.fluid-passage :is(.gap-token,.gap-drop,.movable-token,.inline-choice)')) {
   if(getComputedStyle(el).fontSize!==getComputedStyle(document.querySelector('.fluid-passage')).fontSize) errors.push(mode+' inconsistent inline font: '+el.className);
 }
 const partial=document.querySelector('.partial-rewrite'), input=partial.querySelector('input');
 input.focus();
 const ps=getComputedStyle(partial), ins=getComputedStyle(input);
 if(ins.fontSize!==ps.fontSize || ins.color!==ps.color || ins.fontFamily!==ps.fontFamily || ins.borderTopWidth!=='0px' || ins.backgroundColor!=='rgba(0, 0, 0, 0)' || ps.backgroundColor!=='rgba(0, 0, 0, 0)' || ins.outlineStyle!=='none') errors.push(mode+' partial input typography or focus');
 const gap=document.querySelector('.gap-token');gap.classList.add('is-right');
 const tokenStyle=getComputedStyle(gap.querySelector('.movable-token'));
 if(tokenStyle.opacity==='0'||tokenStyle.visibility==='hidden'||(mode==='studio' && tokenStyle.color===getComputedStyle(document.querySelector('.category-bin .is-wrong')).color)) errors.push(mode+' answer feedback');
 const rewrite=document.querySelector('[data-ui-style="sentence_rewrite"] textarea');rewrite.focus();
 const rs=getComputedStyle(rewrite);
 if(rs.borderTopWidth!=='0px'||rs.borderBottomWidth==='0px'||rs.outlineStyle!=='none'||rs.backgroundColor!=='rgba(0, 0, 0, 0)'||rs.whiteSpace!=='pre-wrap') errors.push(mode+' rewrite underline/focus');
 const targetStyle=getComputedStyle(document.querySelector('.sentence-target'));
 if(targetStyle.borderTopWidth!=='0px'||targetStyle.backgroundColor!=='rgba(0, 0, 0, 0)') errors.push(mode+' sentence dropzone');
 if(getComputedStyle(document.querySelector('.paired')).backgroundColor===getComputedStyle(document.querySelector('.pair-error')).backgroundColor) errors.push(mode+' pair feedback indistinguishable');
 if(mode==='glass') {
   const material=getComputedStyle(document.querySelector('.nav-face'));
   if(material.backdropFilter==='none'||material.boxShadow==='none') errors.push('Glass material lacks depth');
   if(getComputedStyle(document.querySelector('.nav-link .app-icon')).color!=='rgb(255, 255, 255)') errors.push('Glass icons must be white');
 }
 const heights=[];
 const shell=document.querySelector('.app-shell'), nav=document.querySelector('.nav-flip'), frame=document.querySelector('.nav-face');
 for(const scale of [.5,1,1.5]) {
   shell.style.setProperty('--nav-scale',scale); shell.style.setProperty('--nav-width',(422*scale)+'px');
   const box=nav.getBoundingClientRect(), faceBox=frame.getBoundingClientRect();heights.push(box.height);
   if(Math.abs(box.width-422*scale)>2 || Math.abs(box.width-faceBox.width)>2 || Math.abs(box.height-faceBox.height)>2) errors.push(mode+' nav frame scale '+scale+': '+JSON.stringify({width:box.width,faceWidth:faceBox.width,height:box.height,faceHeight:faceBox.height}));
 }
 if(Math.max(...heights)-Math.min(...heights)>1) errors.push(mode+' nav height changes with scale');
 shell.style.setProperty('--nav-scale','1');shell.style.setProperty('--nav-width','422px');
 const controls=document.querySelector('.session-controls'), nextButton=controls.querySelector('.next-question'), checkButton=controls.querySelector('.check-action');
 for(const width of [300,500]) {
 controls.style.width=width+'px';
 checkButton.style.display='';const before=nextButton.getBoundingClientRect().right;
 checkButton.style.display='none';const after=nextButton.getBoundingClientRect().right;
 if(Math.abs(before-after)>1 || Math.abs(after-controls.getBoundingClientRect().right)>1) errors.push(mode+' next moves after checking at '+width);
 }
 const colors=[];
 for(const alpha of ['0.04','0.75','1']) {
  root.style.setProperty('--glass-alpha',alpha);
  colors.push(getComputedStyle(icon).color);
  for(const hovered of [false,true]) for(const flipped of [false,true]) {
   card.toggleAttribute('data-test-hover',hovered);card.setAttribute('aria-pressed',String(flipped));card.firstElementChild.classList.toggle('flipped',flipped);
   for(const target of [card,card.firstElementChild,...card.querySelectorAll('.flip-face')]) {
    const s=getComputedStyle(target);
    if(s.filter!=='none'||s.backdropFilter!=='none') errors.push(mode+' '+target.className+' filter='+s.filter+' backdrop='+s.backdropFilter);
   }
  }
  if(mode==='studio' && getComputedStyle(face).backgroundColor!=='rgb(255, 253, 246)') errors.push('Studio surface is not opaque cream');
 }
 if(new Set(colors).size!==1) errors.push(mode+' icons change with glass alpha');
}
root.dataset.interface='studio';card.firstElementChild.classList.remove('flipped');card.removeAttribute('data-test-hover');card.setAttribute('aria-pressed','false');root.style.setProperty('--glass-alpha','0.75');
const themeBackgrounds=[];
for(const mode of ['xp','retro','space']) {
 root.dataset.interface=mode;
 themeBackgrounds.push(getComputedStyle(document.querySelector('.flip-face')).backgroundColor);
 if(getComputedStyle(document.querySelector('.icon-'+mode)).display==='none'||getComputedStyle(document.querySelector('.icon-default')).display!=='none') errors.push(mode+' independent icons missing');
 if(getComputedStyle(document.querySelector('.nav-face')).backdropFilter!=='none') errors.push(mode+' inherited glass blur');
}
if(new Set(themeBackgrounds).size!==3) errors.push('New theme surfaces are not distinct');
const cleanup=installAutoContrast();root.dataset.textAuto='true';
const probe=document.createElement('button');probe.textContent='Auto contrast';document.body.append(probe);
for(const color of ['#ffffff','#111111']) {
 probe.style.setProperty('background',color,'important');
 root.dataset.interface='studio';
 await new Promise(resolve=>setTimeout(resolve,100));
 const c=getComputedStyle(probe).color;
 if(c !== (color==='#ffffff'?'rgb(0, 0, 0)':'rgb(255, 255, 255)')) errors.push('auto foreground '+color+': '+c);
}
cleanup();probe.remove();
root.dataset.interface='${process.env.INTERFACE_THEME || 'studio'}';
for(const el of document.querySelectorAll('button, .nav-face, .glass, .app-icon')) {
 const st=getComputedStyle(el);if(st.filter!=='none'||(root.dataset.interface==='studio' && st.backdropFilter!=='none')) errors.push('filter remains '+el.className);
}
document.getElementById('results').textContent=JSON.stringify({errors});
})();
</script></body></html>`;
try {
  const fixture = path.join(temp, "interface.html");
  await fs.writeFile(fixture, html);
  const screenshot = process.env.INTERFACE_SCREENSHOT;
  const result = spawnSync(
    browser,
    [
      "--headless",
      "--disable-gpu",
      "--disable-background-networking",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${path.join(temp, "profile")}`,
      "--window-size=1366,960",
      "--virtual-time-budget=1200",
      ...(screenshot ? [`--screenshot=${path.resolve(screenshot)}`] : []),
      "--dump-dom",
      pathToFileURL(fixture).href,
    ],
    {
      encoding: "utf8",
      windowsHide: true,
      timeout: 30000,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  if (result.error) throw result.error;
  const match = result.stdout.match(
    /<pre id="results" hidden="">([^<]+)<\/pre>/,
  );
  if (!match)
    throw new Error(
      "Headless renderer did not return test results: " +
        result.stderr.slice(-1000),
    );
  const { errors } = JSON.parse(match[1]);
  if (errors.length) throw new Error([...new Set(errors)].join("; "));
  console.log(
    "Browser CSS checks passed: both interfaces, clear hover/icons, fixed nav height at 50-150%, automatic contrast and exercise controls.",
  );
} finally {
  if (
    !path.resolve(temp).startsWith(path.resolve(os.tmpdir()) + path.sep) ||
    !path.basename(temp).startsWith("wortify-interface-")
  )
    throw new Error("Unexpected temporary directory; refusing cleanup.");
  await fs.rm(temp, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
}
