import SiteExport from './SiteExport.jsx';
import { t as tr, useLocale } from "../../i18n/index.js";
import BackupImport from './BackupImport.jsx';
import {useState,useEffect} from 'react';
import {request,useResource} from '../../lib/core.js';
import {Btn,Field,Select,Loading,Status} from '../../components/ui/ui.jsx';
import {Pagination,roleName} from './shared.jsx';

function LegacyEmergencyBackups(){
  useLocale();
 const [q,setQ]=useState(''),[role,setRole]=useState(''),[status,setStatus]=useState(''),[page,setPage]=useState(1),[ids,setIds]=useState([]),[scope,setScope]=useState('selected');
 const [media,setMedia]=useState(true),[audit,setAudit]=useState(true),[credentials,setCredentials]=useState(false),[preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const resource=useResource(`/api/manage/users/?q=${encodeURIComponent(q)}&role=${role}&status=${status}&page=${page}`);
 useEffect(()=>{setPreview(null);},[q,role,status,ids,scope,media,audit,credentials]);
 const options={scope,ids,q,role,status,include_media:media,include_audit:audit,include_credentials:credentials};
 const run=async(fn)=>{setBusy(true);setError('');try{await fn();}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <section>
  <BackupImport />
  <h2>{tr("Export ZIP")}</h2>
  <p className="mb-4">{tr("Export account identities, roles, learning records and content from both languages. This is sensitive administrator data.")}</p>
  <fieldset disabled={busy} className="admin-backup-options">
   <Select label={tr("Export scope")} value={scope} onChange={setScope}><option value="selected">{tr("Selected accounts (")}{ids.length})</option><option value="filtered">{tr("All matching filters")}</option><option value="all">{tr("All accounts")}</option></Select>
   <Field label={tr("Username or email")} value={q} onChange={v=>{setQ(v);setPage(1);}}/>
   <Select label={tr("Role")} value={role} onChange={v=>{setRole(v);setPage(1);}}><option value="">{tr("All roles")}</option><option value="user">{tr("User")}</option><option value="staff">{tr("Staff")}</option><option value="superuser">{tr("Admin")}</option></Select>
   <Select label={tr("Status")} value={status} onChange={v=>{setStatus(v);setPage(1);}}><option value="">{tr("Any status")}</option><option value="active">{tr("Active")}</option><option value="inactive">{tr("Inactive")}</option></Select>
  </fieldset>
  <Loading resource={resource}>{data=><>
   <div className="admin-selection-bar"><span>{ids.length}{tr(" selected · ")}{data.total}{tr(" matching accounts")}</span><Btn isDisabled={busy} onClick={()=>{setIds([...new Set([...ids,...data.users.map(u=>u.id)])]);setScope('selected');}}>{tr("Select this page")}</Btn><Btn isDisabled={busy} onClick={()=>setIds([])}>{tr("Clear selection")}</Btn></div>
   <div className="overflow-x-auto"><table><thead><tr><th>{tr("Select")}</th><th>{tr("Account")}</th><th>{tr("Email")}</th><th>{tr("Role")}</th><th>{tr("Status")}</th></tr></thead><tbody>{data.users.map(u=><tr key={u.id}><td><input type="checkbox" aria-label={tr("Select {v0}", { v0: u.username })} disabled={busy} checked={ids.includes(u.id)} onChange={()=>{setIds(old=>old.includes(u.id)?old.filter(id=>id!==u.id):[...old,u.id]);setScope('selected');}}/></td><td>{u.username}</td><td>{u.email||'—'}</td><td>{roleName(u)}</td><td>{u.is_active?tr("Active"):tr("Inactive")}</td></tr>)}</tbody></table></div>
   {!data.users.length&&<p>{tr("No matching accounts.")}</p>}<Pagination page={page} total={data.total} size={50} onChange={setPage}/>
  </>}</Loading>
  <fieldset disabled={busy} className="admin-backup-detail"><legend>{tr("Archive contents")}</legend>
   <label><input type="checkbox" checked={media} onChange={e=>setMedia(e.target.checked)}/>{tr(" Uploaded media and portable per-user ZIPs")}</label>
   <label><input type="checkbox" checked={audit} onChange={e=>setAudit(e.target.checked)}/>{tr(" Related administrator audit history")}</label>
   <label><input type="checkbox" checked={credentials} onChange={e=>setCredentials(e.target.checked)}/>{tr(" Include password hashes for emergency account recovery")}</label>
   {credentials&&<p>{tr("Anyone with this file can obtain password hashes. Store it encrypted and restrict access.")}</p>}
   <p>{tr("Sessions and server secrets are excluded. Maximum 2 GB per export; split large exports using filters. This does not replace a full database and server backup.")}</p>
  </fieldset>
  <Status error={error}/>
  <Btn isDisabled={busy||(scope==='selected'&&!ids.length)} onClick={()=>run(async()=>setPreview(await request('/api/manage/backups/','POST',{...options,preview:true})))}>{tr("Review export")}</Btn>
  {preview&&<div className="admin-export-review"><strong>{preview.count}{tr(" accounts will be exported")}</strong><p>{scope==='all'?tr("All accounts, regardless of filters."):scope==='filtered'?tr("All matching accounts across every page."):tr("Only the selected accounts, including selections on other pages.")}{tr(" Existing data will not be changed.")}</p><Btn primary isDisabled={busy} onClick={()=>run(async()=>{
   const csrf=decodeURIComponent(document.cookie.split('; ').find(c=>c.startsWith('csrftoken='))?.slice(10)||'');
   const response=await fetch('/api/manage/backups/',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRFToken':csrf},body:JSON.stringify({...options,confirm:'EXPORT'})});
   if(!response.ok){const data=await response.json();throw new Error(data.error||'Export failed.');}
   const url=URL.createObjectURL(await response.blob());const link=document.createElement('a');link.href=url;link.download=`wortify-emergency-${new Date().toISOString().slice(0,10)}.zip`;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
  })}>{tr("Download emergency ZIP")}</Btn></div>}
  {busy&&<p role="status">{tr("Preparing export. Keep this page open…")}</p>}
 </section>;
}

export default function EmergencyBackups() {
  useLocale();
  return <section>
    <SiteExport />
    <details className="admin-backup-detail">
      <summary>{tr("Emergency account backup and import")}</summary>
      <p>{tr("Use this separate format to restore new accounts through the existing ZIP importer. Site exports include their own recovery documentation.")}</p>
      <LegacyEmergencyBackups />
    </details>
  </section>;
}
