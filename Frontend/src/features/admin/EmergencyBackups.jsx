import {useState,useEffect} from 'react';
import {request,useResource} from '../../lib/core.js';
import {Btn,Field,Select,Loading,Status} from '../../components/ui/ui.jsx';
import {Pagination,roleName} from './shared.jsx';

export default function EmergencyBackups(){
 const [q,setQ]=useState(''),[role,setRole]=useState(''),[status,setStatus]=useState(''),[page,setPage]=useState(1),[ids,setIds]=useState([]),[scope,setScope]=useState('selected');
 const [media,setMedia]=useState(true),[audit,setAudit]=useState(true),[credentials,setCredentials]=useState(false),[preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const resource=useResource(`/api/manage/users/?q=${encodeURIComponent(q)}&role=${role}&status=${status}&page=${page}`);
 useEffect(()=>{setPreview(null);},[q,role,status,ids,scope,media,audit,credentials]);
 const options={scope,ids,q,role,status,include_media:media,include_audit:audit,include_credentials:credentials};
 const run=async(fn)=>{setBusy(true);setError('');try{await fn();}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <section>
  <p className="mb-4">Export account identities, roles, learning records and content from both languages. This is sensitive administrator data.</p>
  <fieldset disabled={busy} className="admin-backup-options">
   <Select label="Export scope" value={scope} onChange={setScope}><option value="selected">Selected accounts ({ids.length})</option><option value="filtered">All matching filters</option><option value="all">All accounts</option></Select>
   <Field label="Username or email" value={q} onChange={v=>{setQ(v);setPage(1);}}/>
   <Select label="Role" value={role} onChange={v=>{setRole(v);setPage(1);}}><option value="">All roles</option><option value="user">User</option><option value="staff">Staff</option><option value="superuser">Admin</option></Select>
   <Select label="Status" value={status} onChange={v=>{setStatus(v);setPage(1);}}><option value="">Any status</option><option value="active">Active</option><option value="inactive">Inactive</option></Select>
  </fieldset>
  <Loading resource={resource}>{data=><>
   <div className="admin-selection-bar"><span>{ids.length} selected · {data.total} matching accounts</span><Btn isDisabled={busy} onClick={()=>{setIds([...new Set([...ids,...data.users.map(u=>u.id)])]);setScope('selected');}}>Select this page</Btn><Btn isDisabled={busy} onClick={()=>setIds([])}>Clear selection</Btn></div>
   <div className="overflow-x-auto"><table><thead><tr><th>Select</th><th>Account</th><th>Email</th><th>Role</th><th>Status</th></tr></thead><tbody>{data.users.map(u=><tr key={u.id}><td><input type="checkbox" aria-label={`Select ${u.username}`} disabled={busy} checked={ids.includes(u.id)} onChange={()=>{setIds(old=>old.includes(u.id)?old.filter(id=>id!==u.id):[...old,u.id]);setScope('selected');}}/></td><td>{u.username}</td><td>{u.email||'—'}</td><td>{roleName(u)}</td><td>{u.is_active?'Active':'Inactive'}</td></tr>)}</tbody></table></div>
   {!data.users.length&&<p>No matching accounts.</p>}<Pagination page={page} total={data.total} size={50} onChange={setPage}/>
  </>}</Loading>
  <fieldset disabled={busy} className="admin-backup-detail"><legend>Archive contents</legend>
   <label><input type="checkbox" checked={media} onChange={e=>setMedia(e.target.checked)}/> Uploaded media and portable per-user ZIPs</label>
   <label><input type="checkbox" checked={audit} onChange={e=>setAudit(e.target.checked)}/> Related administrator audit history</label>
   <label><input type="checkbox" checked={credentials} onChange={e=>setCredentials(e.target.checked)}/> Include password hashes for emergency account recovery</label>
   {credentials&&<p>Anyone with this file can obtain password hashes. Store it encrypted and restrict access.</p>}
   <p>Sessions and server secrets are excluded. Maximum 2 GB per export; split large exports using filters. This does not replace a full database and server backup.</p>
  </fieldset>
  <Status error={error}/>
  <Btn isDisabled={busy||(scope==='selected'&&!ids.length)} onClick={()=>run(async()=>setPreview(await request('/api/manage/backups/','POST',{...options,preview:true})))}>Review export</Btn>
  {preview&&<div className="admin-export-review"><strong>{preview.count} accounts will be exported</strong><p>{scope==='all'?'All accounts, regardless of filters.':scope==='filtered'?'All matching accounts across every page.':'Only the selected accounts, including selections on other pages.'} Existing data will not be changed.</p><Btn primary isDisabled={busy} onClick={()=>run(async()=>{
   const csrf=decodeURIComponent(document.cookie.split('; ').find(c=>c.startsWith('csrftoken='))?.slice(10)||'');
   const response=await fetch('/api/manage/backups/',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRFToken':csrf},body:JSON.stringify({...options,confirm:'EXPORT'})});
   if(!response.ok){const data=await response.json();throw new Error(data.error||'Export failed.');}
   const url=URL.createObjectURL(await response.blob());const link=document.createElement('a');link.href=url;link.download=`wortify-emergency-${new Date().toISOString().slice(0,10)}.zip`;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
  })}>Download emergency ZIP</Btn></div>}
  {busy&&<p role="status">Preparing export. Keep this page open…</p>}
 </section>;
}
