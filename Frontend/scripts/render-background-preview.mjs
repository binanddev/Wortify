import { build } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import React from 'react';
import {ServerStyleSheet} from 'styled-components';
import {renderToStaticMarkup} from 'react-dom/server';
process.chdir(path.resolve(import.meta.dirname,'..'));
const theme=process.env.INTERFACE_THEME || 'retro';
const out=path.resolve('.interface-preview');
await build({configFile:false,plugins:[react()],build:{ssr:'src/themes/DefaultBackground.jsx',outDir:out,emptyOutDir:false,minify:false}});
const {default:Scene}=await import(pathToFileURL(path.join(out,'DefaultBackground.js')).href);
let taskbar='', taskbarStyles='';
if(theme==='xp') {
 await build({configFile:false,plugins:[react()],build:{ssr:'src/themes/windows-xp/WindowsTaskbar.jsx',outDir:out,emptyOutDir:false,minify:false}});
 const {default:Taskbar}=await import(pathToFileURL(path.join(out,'WindowsTaskbar.js')).href);
 const sheet=new ServerStyleSheet();
 try { taskbar=renderToStaticMarkup(sheet.collectStyles(React.createElement(Taskbar,{lang:'de',title:'Bài tập'}))); taskbarStyles=sheet.getStyleTags(); } finally { sheet.seal(); }
}
const assets=await fs.readdir('dist/assets');
let css=await fs.readFile(path.join('dist/assets',assets.find(f=>/^index-.*\.css$/.test(f))),'utf8');
css=css.replaceAll('/assets/',pathToFileURL(path.resolve('dist/assets')).href+'/');
const html=`<!doctype html><html data-interface="${theme}" data-background-paused="true"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style>${taskbarStyles}<body>${renderToStaticMarkup(React.createElement(Scene))}<main style="padding:6vh 6vw;position:relative"><section class="work-paper" style="max-width:560px;margin:auto;padding:28px"><span class="eyebrow">DEUTSCH · A1</span><h1 style="font-size:28px;margin:12px 0">Một chặng học nhỏ.</h1><p>Ich lerne jeden Tag etwas Neues.</p><div style="display:flex;gap:12px;margin-top:24px"><button class="btn">Thẻ ghi nhớ</button><button class="btn primary">Tiếp tục →</button></div></section></main>${taskbar}</body></html>`;
const file=path.join(out,theme+'-background.html');await fs.writeFile(file,html);
const browser=process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
for(const [name,size] of [['desktop','1440,1000'],['mobile','500,900']]){
 const result=spawnSync(browser,['--headless','--disable-gpu','--no-first-run',`--user-data-dir=${path.join(out,'chrome-background-'+name)}`,`--window-size=${size}`,`--screenshot=${path.join(out,theme+'-background-'+name+'.png')}`,'--virtual-time-budget=1000',pathToFileURL(file).href],{windowsHide:true,encoding:'utf8',timeout:30000});
 if(result.status!==0)throw new Error(result.stderr);
 console.log(path.join(out,theme+'-background-'+name+'.png'));
}
