import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const dist=path.resolve(import.meta.dirname,'../dist/assets');
const file=(await fs.readdir(dist)).find(n=>/^index-.*\.css$/.test(n));
const css=await fs.readFile(path.join(dist,file),'utf8');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'wortify-admin-grid-'));
const html=`<!doctype html><html data-interface="admin" data-admin-mode="light" data-background="mist" data-has-background="true" style="--site-bg-image:linear-gradient(red,blue)"><meta charset="utf-8"><style>${css}</style><body><div class="default-background"><svg></svg></div><main class="admin-main"><section class="admin-grid"><div class="admin-grid-scroll" style="width:400px;height:180px"><table><thead><tr><th class="frozen">Username</th><th>Email</th></tr></thead><tbody>${Array.from({length:30},(_,i)=>`<tr><td class="frozen">User ${i}</td><td style="min-width:600px">name@example.com</td></tr>`).join('')}</tbody></table></div></section></main><pre id="result"></pre><script>
const errors=[],root=document.documentElement,scroll=document.querySelector('.admin-grid-scroll'),th=document.querySelector('th'),cell=document.querySelector('td');
for(const mode of ['light','dark']) {root.dataset.adminMode=mode; if(getComputedStyle(document.querySelector('.default-background')).display!=='none')errors.push('decorative layer visible'); if(getComputedStyle(document.body).backgroundImage!=='none')errors.push('background image'); if(getComputedStyle(th).position!=='sticky'||getComputedStyle(cell).position!=='sticky')errors.push('not sticky');const before=th.getBoundingClientRect();scroll.scrollTop=80;scroll.scrollLeft=100;const after=th.getBoundingClientRect();if(Math.abs(before.left-after.left)>1||Math.abs(before.top-after.top)>1)errors.push('freeze failed');scroll.scrollTop=0;scroll.scrollLeft=0;}
const sizes=['compact','cozy','comfortable'].map(d=>{root.dataset.adminDensity=d;return parseFloat(getComputedStyle(cell).paddingTop);});if(!(sizes[0]<sizes[1]&&sizes[1]<sizes[2]))errors.push('density');document.querySelector('#result').textContent=errors.length?'FAIL '+errors.join(','):'PASS admin grid';
</script></html>`;
await fs.writeFile(path.join(temp,'index.html'),html);
const browser=process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const result=spawnSync(browser,['--headless','--disable-gpu','--no-sandbox',`--user-data-dir=${path.join(temp,'profile')}`,'--dump-dom',pathToFileURL(path.join(temp,'index.html')).href],{encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});
if(!result.stdout?.includes('>PASS admin grid</pre>'))throw new Error(result.stdout?.match(/<pre id="result">(.*?)<\/pre>/)?.[1]||result.error?.message||'Browser check failed');
console.log('PASS: solid backgrounds, frozen header/identity column, three density levels in Light and Dark.');
