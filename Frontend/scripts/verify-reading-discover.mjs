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
const entry = path.join(dir, "reading-discover-check.jsx");
await fs.writeFile(entry,"import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {HeroUIProvider} from '@heroui/react';import Workspace from '../src/features/reading/ReadingWorkspace.jsx';import {setLanguage,t as tr} from '../src/i18n/index.js';import {WindowContext} from '../src/lib/core.js';\nconst calls=[],destinations=[],account=[];let reset,failSave=false;const all=Array.from({length:25},(_,i)=>({key:i===2?'system:3':'community:'+(i+1),title:i===0?'Bus reading':i===1?'Saved reading':'Reading '+(i+1),level:i===3?'':'A2',topic:i===3?'':'Travel',source:i===2?'system':'community',saved_id:i===1?88:null}));\nconst payload={title:'Bus reading',kind:'choice',context:'We travel by bus.',presentation:{interaction:'reading',style:'split_reading'},questions:[{id:'1',prompt:'How?',kind:'choice',options:['Bus','Car'],accepted_answers:['Bus'],presentation:{}}]};\nwindow.fetch=async(url,options={})=>{const u=new URL(url,'https://fixture.invalid'),body=options.body?JSON.parse(options.body):null;calls.push({url:u,method:options.method||'GET',body});if(u.pathname.includes('/save/')){if(failSave){failSave=false;return Response.json({error:'Save rejected for this workspace'},{status:403});}return Response.json({id:77,saved:true});}if(u.pathname.includes('/open/'))return Response.json({title:'Bus reading',payload});const page=Number(u.searchParams.get('page')||1),rows=u.searchParams.get('q')==='nothing'?[]:all;return Response.json({lessons:rows.slice((page-1)*24,page*24),topics:['Travel','Grammar'],total:rows.length,page});};\nconst wait=()=>new Promise(r=>setTimeout(r,220)),settle=async()=>{await wait();await wait();},assert=(v,m)=>{if(!v)throw Error(m)},root=createRoot(document.getElementById('root'));const main=()=>document.getElementById('root'),dialog=()=>[...document.querySelectorAll('[role=dialog]')].at(-1);const button=(label,scope=main())=>{const el=[...scope.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===tr(label)||b.textContent.trim()===tr(label));assert(el,'Missing '+label);return el;};const card=title=>{const el=[...main().querySelectorAll('.reading-discover-card')].find(el=>el.querySelector('.reading-discover-title').textContent===title);assert(el,'Missing card '+title);return el;};const select=(index,value)=>{const el=dialog().querySelectorAll('select')[index];el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));};const close=async()=>{button('Close',dialog()).click();await settle();};const search=async value=>{const el=main().querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));await wait();main().querySelector('.reading-discover-search').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await settle();};const posts=()=>calls.filter(c=>c.url.pathname.includes('/save/')).length;const latest=()=>[...calls].reverse().find(c=>c.url.pathname.endsWith('/discover/')).url.searchParams;\nfunction Harness(){const [mode,setMode]=useState(0);reset=guest=>setMode(m=>(Math.floor(m/2)+1)*2+(guest?1:0));return <HeroUIProvider disableAnimation><WindowContext.Provider value={{route:'/de/reading/discover',navigate:path=>destinations.push(path),active:true,get toolsTarget(){return document.getElementById('workspace-tools');}}}><Workspace key={mode} lang='de' route='/de/reading/discover' userId={1} onRequireAccount={mode%2?item=>account.push(item):undefined}/></WindowContext.Provider></HeroUIProvider>;}\n(async()=>{setLanguage('en');document.documentElement.dataset.interface=location.hash.slice(1)||'studio';root.render(<Harness/>);await settle();await settle();assert(main().querySelectorAll('.reading-discover-card').length===24,'Catalogue page size changed');assert(!main().querySelector('select'),'Filters must be collapsed');assert(!main().querySelector('.reading-discover-clear'),'Inactive reset should be hidden');const active=document.querySelector('.reading-discover-links [aria-current=page]');assert(active?.textContent===tr('Explore'),'Discover nav must have a readable active label');button('Filters').click();await settle();assert(dialog().querySelectorAll('select').length===3,'Three filter fields missing');select(0,'A2');button('Cancel',dialog()).click();await settle();assert(latest().get('level')==='','Cancelled filter leaked');button('Filters').click();await settle();assert(dialog().querySelector('select').value==='','Draft not discarded');select(0,'A2');select(1,'Travel');select(2,'system');button('Apply',dialog()).click();await settle();assert(latest().get('level')==='A2'&&latest().get('topic')==='Travel'&&latest().get('source')==='system','Filter parameters lost');assert(main().querySelectorAll('.reading-discover-active button:not(.btn)').length===3,'Active filters missing');button('Remove filter: A2').click();await settle();assert(latest().get('level')===''&&latest().get('topic')==='Travel','Individual filter clear lost scope');button('Next page').click();await settle();assert(main().querySelectorAll('.reading-discover-card').length===1,'Last page is not bounded');await search('bus');assert(latest().get('page')==='1'&&latest().get('q')==='bus'&&latest().get('topic')==='Travel','Search reset/scope failed');button('Clear filters').click();await settle();assert(!main().querySelector('.reading-discover-active')&&main().querySelector('input').value===''&&main().querySelectorAll('.reading-discover-card').length===24,'Clear filters failed');\nbutton('Continue learning',card('Saved reading')).click();await settle();assert(destinations.at(-1)==='/de/reading/88'&&posts()===0,'Existing copy posted again');button('Save to My readings',card('Bus reading')).click();await settle();assert(posts()===1,'Save API not called once');assert(button('Saved to My readings',card('Bus reading')).disabled,'Saved icon remains active');button('Continue learning',card('Bus reading')).click();await settle();assert(destinations.at(-1)==='/de/reading/77'&&posts()===1,'Continue duplicated save');button('Preview reading',card('Bus reading')).click();await settle();assert(dialog().textContent.includes('We travel by bus.'),'Reading preview missing');assert(!calls.some(c=>c.url.pathname.includes('learning/sync')),'Preview saved progress');await close();failSave=true;button('Preview reading',card('Reading 4')).click();await settle();button('Save to My readings',dialog()).click();await settle();assert(dialog().querySelector('[role=alert]')?.textContent.includes('Save rejected'),'Save failure hidden behind modal');assert(!button('Save to My readings',dialog()).disabled,'Failed save marked saved');button('Save to My readings',dialog()).click();await settle();assert(button('Saved to My readings',dialog()).disabled,'Retry failed');await close();\nfor(const language of ['vi','de','en']){setLanguage(language);await wait();button('Filters').click();await settle();assert(dialog().textContent.includes(tr('All topics')),'Filter translation missing');button('Cancel',dialog()).click();await settle();}reset(true);await settle();const before=posts();button('Study now',card('Bus reading')).click();await settle();assert(dialog()&&posts()===before,'Guest study did not open public preview');button('Save to My readings',dialog()).click();await settle();assert(account.at(-1)?.key==='community:1','Guest preview save lost login callback');await close();button('Save to My readings',card('Bus reading')).click();await settle();assert(posts()===before&&account.length===2,'Guest card save bypassed login');await search('nothing');assert(!main().querySelector('.reading-discover-card')&&main().textContent.includes(tr('No readings match these filters.')),'Empty state missing');button('Clear filters').click();await settle();reset(false);await settle();setLanguage('vi');await settle();const section=main().querySelector('.reading-discover'),form=section.querySelector('form'),box=form.getBoundingClientRect();assert(section.scrollWidth<=section.clientWidth+1,'Discover content overflows');for(const el of form.querySelectorAll('input,button')){const r=el.getBoundingClientRect();assert(r.left>=box.left-1&&r.right<=box.right+1,'Search control escaped');}for(const c of section.querySelectorAll('.reading-discover-card'))assert(c.scrollWidth<=c.clientWidth+1,'Card overflows');assert(section.querySelector('.reading-discover-card-actions').getBoundingClientRect().height-parseFloat(getComputedStyle(section.querySelector('.reading-discover-card-actions')).paddingTop)<=48,'Card actions wrapped');assert(!document.querySelector('.reading-discover-links .guide-icon-link'),'Stretched icon nav remains');window.scrollTo(0,0);if(location.search.includes('filters')){button('Filters').click();await settle();}document.getElementById('result').textContent='PASS: compact Reading filters/nav/cards, apply/cancel/chips/24+1 pages, save-once/continue, preview errors/retry, guest login, translations and no overflow';})().catch(e=>document.getElementById('result').textContent='FAIL: '+e.message+' '+e.stack);\n");

await build({
  configFile: false,
  plugins: [react()],
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    lib: {
      entry,
      name: "ImportApiCheck",
      formats: ["iife"],
      fileName: () => "reading-discover-check.js",
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
  path.join(dir, "reading-discover-check.js"),
  "utf8",
);
const file = path.join(dir, "reading-discover.html");
await fs.writeFile(
  file,
  `<!doctype html><html data-interface="studio"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}.fixture-shell{display:grid;grid-template-columns:280px minmax(0,1fr);gap:28px;padding:16px}.fixture-nav{min-width:0}.fixture-nav .context-panel{position:static!important;min-width:0;width:100%;padding:20px}.fixture-shell .page{margin:0!important;padding:20px!important;max-width:none!important}.fixture-shell .glass-body{opacity:1!important}.fixture-shell .nav-face{transform:none!important;position:relative!important;inset:auto!important;height:auto!important;min-height:500px}.fixture-shell .nav-flip{position:static!important;transform:none!important;perspective:none!important;width:auto!important;height:auto!important;max-height:none!important;opacity:1!important;visibility:visible!important}${mobile ? '.fixture-shell{display:block;width:390px;padding:0}.fixture-nav{display:none}' : ''}</style><body style="margin:0"><div class="fixture-shell"><div class="fixture-nav"><div class="nav-flip"><div class="nav-face nav-back is-active"><aside class="workspace-context context-panel open"><h2>Reading</h2><div id="workspace-tools"></div></aside></div></div></div><div id="root" style="min-width:0"></div></div><pre id="result" hidden></pre><script>window.onerror=m=>document.getElementById('result').textContent='FAIL: '+m;</script><script>${js.replaceAll("</script", "<\/script")}</script></body></html>`,

);
for(const theme of process.argv.includes("--themes") ? ["studio","glass","xp","retro","notebook","rpg"] : ["studio"]) {
const result = spawnSync(
  process.env.CHROME_PATH ||
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  [
    "--headless",
    "--disable-gpu",
    "--no-first-run",
    mobile ? "--window-size=500,1000" : "--window-size=1440,1000",
    "--user-data-dir=" + path.join(dir, "chrome-reading-discover-check"),
    "--virtual-time-budget=45000",
    "--dump-dom",
    "--screenshot=" +
      path.join(
        dir,
        `reading-discover-${theme}${mobile?"-mobile":""}${process.argv.includes("--filters")?"-filters":""}.png`,
      ),
    pathToFileURL(file).href+(process.argv.includes("--filters")?"?filters=1":"")+"#"+theme,
  ],
  {
    encoding: "utf8",
    windowsHide: true,
    timeout: 60000,
    maxBuffer: 8 * 1024 * 1024,
  },
);
const match = result.stdout?.match(/<pre id="result"[^>]*>([^<]+)<\/pre>/);
if (!match?.[1].startsWith("PASS")) throw Error(match?.[1] || result.stderr);
console.log(match[1]);

}
