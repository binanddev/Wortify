import { t as tr, useLocale } from "../../i18n/index.js";
import {useState} from 'react';
export default function InlineSelect({label,value,options,disabled,onSave}) {
  useLocale();
 const [editing,setEditing]=useState(false),[draft,setDraft]=useState(value),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(!editing)return <button type="button" className="admin-editable-cell" disabled={disabled} title={tr("Double-click or press Enter to edit {v0}", { v0: label })} onDoubleClick={()=>{setDraft(value);setEditing(true);}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();setDraft(value);setEditing(true);}}}>{options.find(([key])=>key===value)?.[1]||value}</button>;
 return <div className="admin-inline-edit" onKeyDown={e=>{if(e.key==='Escape'&&!busy)setEditing(false);}}><select autoFocus aria-label={label} value={draft} disabled={busy} onChange={e=>setDraft(e.target.value)}>{options.map(([key,text])=><option key={key} value={key}>{tr(text)}</option>)}</select><button disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await onSave(draft);setEditing(false);}catch(e){setError(e.message);}finally{setBusy(false);}}}>{tr("Save")}</button><button disabled={busy} onClick={()=>setEditing(false)}>{tr("Cancel")}</button>{error&&<span role="alert">{error}</span>}</div>;
}
