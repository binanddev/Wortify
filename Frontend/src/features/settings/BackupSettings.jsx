import {useState} from 'react';
import {Btn, Glass, Status} from '../../components/ui/ui.jsx';
import {request, readPreference, savePreference} from '../../lib/core.js';
import {flushLearning, pendingLearning} from '../learning/learning-sync.js';

const labels = {theme:'Backgrounds',profile:'Profile',studysettings:'Study settings',folder:'Flashcard folders',deck:'Decks',card:'Flashcards',practicemedia:'Exercise files',practicenode:'Practice folders and activities',classroom:'Classes',classroomassignment:'Assignments',studyprogress:'Card progress',decklearningstate:'Deck learning state',practiceprogress:'Practice progress',studyattempt:'Study attempts',practiceattempt:'Practice attempts',studysession:'Study sessions',learningevent:'Learning history',importbatch:'Import history',matchround:'Matching rounds'};

export default function BackupSettings({userId}) {
 const [file,setFile]=useState(null), [preview,setPreview]=useState(null), [busy,setBusy]=useState(''), [error,setError]=useState(''), [result,setResult]=useState(null), [settings,setSettings]=useState(false);
 const run=async(label,action)=>{setBusy(label);setError('');try {await action();} catch(e){setError(e.message);} finally {setBusy('');}};
 const sync=async()=>{
  for(const lang of ['de','en']) {
   let previous=Infinity;
   while(pendingLearning(userId,lang).length) {
    const count=pendingLearning(userId,lang).length;
    if(count>=previous) throw new Error('Some learning changes could not sync. Connect to the server and try again.');
    previous=count;await flushLearning(userId,lang);
   }
  }
 };
 const exportBackup=()=>run('Preparing backup…',async()=>{
  await sync();
  const workspace=Object.fromEntries(['de','en'].map(lang=>[lang,readPreference(`wortify:practice-workspace:${userId}:${lang}`,[])]));
  const token=decodeURIComponent(document.cookie.split('; ').find(c=>c.startsWith('csrftoken='))?.slice(10)||'');
  const response=await fetch('/api/me/backup/',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRFToken':token},body:JSON.stringify({workspace})});
  if(!response.ok) {const data=await response.json();throw new Error(data.error||'Backup failed.');}
  const url=URL.createObjectURL(await response.blob());
  const link=document.createElement('a');link.href=url;link.download=`wortify-backup-${new Date().toISOString().slice(0,10)}.zip`;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
 });
 const send=async(previewOnly)=>{
  const data=new FormData();data.append('file',file);data.append(previewOnly?'preview':'confirm','true');data.append('settings',String(settings));
  return request('/api/me/backup/restore/','POST',data);
 };
 return <Glass><h2>Backup & restore</h2>
  <p>Keep a portable copy of your data from both German and English workspaces: flashcards, exercises, learning history, settings and uploaded media.</p>
  <p>ZIP format · Up to 512 MB. Keep your backup somewhere private.</p>
  <Btn isDisabled={!!busy} onClick={exportBackup}>Export all my data</Btn>
  <hr className="my-6"/>
  <h3>Restore a backup</h3>
  <p>Content is added as private copies. Existing content stays in place. Importing the same backup again creates more copies.</p>
  <p>Passwords and account roles are excluded. Classes restore without members, with new invitation links. Memberships are included as reference only. History linked to content outside the backup may be skipped. Generated speech is recreated when needed.</p>
  <label className="field"><span>Wortify ZIP backup</span><input type="file" accept=".zip,application/zip" disabled={!!busy} onChange={e=>{setFile(e.target.files[0]||null);setPreview(null);setResult(null);setError('');}}/></label>
  <Btn isDisabled={!file||!!busy} onClick={()=>run('Checking backup…',async()=>setPreview(await send(true)))}>Check backup</Btn>
  {preview&&!result&&<section className="mt-4" aria-label="Backup preview"><h3>Ready to restore</h3><ul>{Object.entries(preview.counts).filter(([,count])=>count>0).map(([name,count])=><li key={name}>{labels[name.split('.').at(-1)] || 'Records'}: {count}</li>)}</ul>
   <label className="check-line"><input type="checkbox" checked={settings} onChange={e=>setSettings(e.target.checked)}/>Also replace my profile and study settings</label>
   <Btn isDisabled={!!busy} onClick={()=>run('Restoring backup…',async()=>{await sync();const restored=await send(false);for(const [lang,ids] of Object.entries(restored.workspace||{}))savePreference(`wortify:practice-workspace:${userId}:${lang}`,[...new Set([...readPreference(`wortify:practice-workspace:${userId}:${lang}`,[]),...ids])]);if(settings){for(const key of Object.keys(localStorage))if(key===`wortify:${userId}:appearance`||(key.startsWith(`wortify:${userId}:`)&&key.endsWith(':live-display')))localStorage.removeItem(key);}setResult(restored);})}>Restore as copies</Btn>
  </section>}
  {busy&&<p role="status">{busy}</p>}
  <Status error={error}/>
  {result&&<div role="status"><p>Restored {result.restored} records. {result.skipped>0?`${result.skipped} records linked to unavailable content were skipped.`:''}</p><Btn onClick={()=>window.location.reload()}>Reload to view restored data</Btn></div>}
 </Glass>;
}
