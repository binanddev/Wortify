import { t as tr, useLocale } from "../../i18n/index.js";
import {useState} from 'react';
import {request} from '../../lib/core.js';
import {Btn,Status} from '../../components/ui/ui.jsx';
export default function BackupImport(){
  useLocale();
 const [file,setFile]=useState(null),[preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(null);
 async function run(confirm=false){
  setBusy(true);setError('');setResult(null);
  try{
   const data=new FormData();data.append('file',file);data.append(confirm?'confirm':'preview',confirm?'RESTORE':'true');
   const response=await request('/api/manage/backups/import/','POST',data);
   if(confirm){setResult(response);setPreview(null);}else setPreview(response);
  }catch(e){setError(e.message);setPreview(null);}finally{setBusy(false);}
 }
 return <section className="admin-backup-detail">
  <h2>{tr("Import ZIP")}</h2>
  <p>{tr("Restore accounts, roles, permissions and private copies of learning data from an emergency export (up to 512 MB). Existing usernames are never overwritten.")}</p>
  <p>{tr("Passwords are restored only when included in the export; otherwise an admin must set a new password. Class memberships, old audit logs and cross-account links are not restored.")}</p>
  <fieldset disabled={busy}>
   <label>{tr("Emergency ZIP ")}<input type="file" accept=".zip,application/zip" onChange={e=>{setFile(e.target.files?.[0]||null);setPreview(null);setResult(null);setError('');}}/></label>
   <Btn isDisabled={!file||busy} onClick={()=>run()}>{tr("Preview import")}</Btn>
   {preview&&<div><p>{preview.accounts.length}{tr(" accounts / ")}{preview.records}{tr(" records")}</p><ul>{preview.accounts.map(account=><li key={account.username}>{account.username} - {account.role} - {account.active?tr("Active"):tr("Inactive")} - {account.password_restored?tr("Password included"):tr("Password reset required")}</li>)}</ul>
    {preview.collisions.length>0?<p role="alert">{tr("Usernames already exist: ")}{preview.collisions.join(', ')}{tr(". Import a selection without these accounts.")}</p>:<Btn primary isDisabled={busy} onClick={()=>run(true)}>{tr("Restore accounts and permissions")}</Btn>}
   </div>}
  </fieldset>
  <Status error={error}/>
  {busy&&<p role="status">{tr("Processing ZIP...")}</p>}
  {result&&<p role="status">{tr("Restored ")}{result.accounts}{tr(" accounts and ")}{result.restored}{tr(" records. Skipped ")}{result.skipped}{tr(" unavailable references.")}</p>}
 </section>;
}
