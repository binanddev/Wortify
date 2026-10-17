import {useState} from 'react';
import {request} from '../../lib/core.js';
import {Btn,Status} from '../../components/ui/ui.jsx';
export default function ContentPackageImport(){
 const [file,setFile]=useState(null),[preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(null);
 async function send(confirm=false){
  setBusy(true);setError('');setResult(null);
  try{const data=new FormData();data.append('file',file);data.append(confirm?'confirm':'preview',confirm?'IMPORT':'true');const response=await request('/api/manage/content-packages/','POST',data);if(confirm){setResult(response);setPreview(null);}else setPreview(response);}catch(e){setError(e.message);}finally{setBusy(false);}
 }
 return <section>
  <h2>Import system content</h2>
  <p>One JSON file for flashcard folders and decks, Practice Hub and Reading. Published as Wortify; the uploader name is not shown to learners.</p>
  <p>Up to 50 MB, 5,000 nodes, 100,000 cards and 10 folder levels. The whole file is validated before anything is saved. Upload the same package ID again safely without creating duplicates.</p>
  <a className="btn" href="/templates/content-package.json" download>Download complete example</a>
  <fieldset disabled={busy}><label>Content package <input type="file" accept=".json,application/json" onChange={e=>{setFile(e.target.files?.[0]||null);setPreview(null);setResult(null);setError('');}}/></label>
  <Btn isDisabled={busy||!file} onClick={()=>send()}>Preview file</Btn>
  {preview&&<div><h3>{preview.title} ({preview.language})</h3><ul>{Object.entries(preview.counts).map(([name,count])=><li key={name}>{name}: {count}</li>)}</ul><p>{preview.already_published?'This package is already in the system library.':'This package will be available in the system library to all learners.'}</p><Btn primary isDisabled={busy} onClick={()=>send(true)}>Import and publish as Wortify</Btn></div>}
  </fieldset><Status error={error}/>
  {busy&&<p role="status">Validating and importing. Keep this page open...</p>}
  {result&&<p role="status">{result.already_imported?'Already imported; no duplicate content created.':'Imported successfully.'} Open Flashcards, Practice Hub or Reading to see the preserved folder tree.</p>}
 </section>;
}
