import { t as tr, useLocale } from "../../i18n/index.js";
import {useState, useRef} from 'react';
import ContentImportGuide from './ContentImportGuide.jsx';
import {request} from '../../lib/core.js';
import {Btn,Status} from '../../components/ui/ui.jsx';
export default function ContentPackageImport(){
  useLocale();
 const flight=useRef(false);
 const [text,setText]=useState('');
 const [file,setFile]=useState(null),[preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(null);
 async function send(confirm=false){
  if(flight.current)return;flight.current=true;
  setBusy(true);setError('');setResult(null);
  try{const data=new FormData();data.append('file',file||new File([text],'content-package.txt',{type:'text/plain'}));if(confirm&&preview?.preview_token)data.append('preview_token',preview.preview_token);data.append(confirm?'confirm':'preview',confirm?'IMPORT':'true');const response=await request('/api/manage/content-packages/','POST',data);if(confirm){setResult(response);setPreview(null);}else setPreview(response);}catch(e){setError(e.message);}finally{flight.current=false;setBusy(false);}
 }
 return <section>
  <h2>{tr("Import system content")}</h2>
  <p>{tr("One text file for Practice Hub and Reading, published publicly as Wortify. Legacy JSON is also supported.")}</p>
  <p>{tr("Up to 50 MB, 5,000 nodes and 10 folder levels. Validation is atomic; retry the same package ID without duplicates.")}</p>
  <ContentImportGuide/>
  <fieldset disabled={busy}><label>{tr("Content package ")}<input type="file" accept=".txt,.json,text/plain,application/json" onChange={e=>{setFile(e.target.files?.[0]||null);setText('');setPreview(null);setResult(null);setError('');}}/></label>
  {!file&&<label className="block">{tr("Or paste content")}<textarea rows={10} className="w-full" value={text} onChange={e=>{setText(e.target.value);setPreview(null);setResult(null);setError('');}}/></label>}
  <Btn isDisabled={busy||(!file&&!text.trim())} onClick={()=>send()}>{tr("Preview file")}</Btn>
  {preview&&<div><h3>{preview.title} ({preview.language})</h3><ul>{Object.entries(preview.counts).map(([name,count])=><li key={name}>{tr(name)}: {count}</li>)}</ul><p>{preview.already_published?tr("This package is already in the system library."):tr("This package will be available in the system library to all learners.")}</p><Btn primary isDisabled={busy} onClick={()=>send(true)}>{tr("Import and publish as Wortify")}</Btn></div>}
  </fieldset><Status error={error}/>
  {busy&&<p role="status">{tr("Validating and importing. Keep this page open...")}</p>}
  {result&&<p role="status">{result.already_imported?tr("Already imported; no duplicate content created."):tr("Imported successfully.")}{tr(" Open Practice Hub or Reading to see the preserved folder tree.")}</p>}
 </section>;
}
