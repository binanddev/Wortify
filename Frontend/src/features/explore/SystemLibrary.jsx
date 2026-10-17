import {useState} from 'react';
import {request,useResource} from '../../lib/core.js';
import {Btn,Loading,Status,Link} from '../../components/ui/ui.jsx';
export default function SystemLibrary({lang}){
 const resource=useResource(`/api/${lang}/system-library/`);const [busy,setBusy]=useState(''),[error,setError]=useState('');
 async function copy(id){setBusy(id);setError('');try{await request(`/api/${lang}/system-library/${id}/copy/`,'POST',{});window.location.reload();}catch(e){setError(e.message);}finally{setBusy('');}}
 return <details className="mb-5"><summary>Wortify system library</summary><p>Official content packages. Add a package once to keep your own progress in Flashcards, Practice Hub and Reading.</p><Loading resource={resource}>{data=><div>{data.packages.length===0&&<p>No packages yet.</p>}{data.packages.map(item=><section key={item.id}><h3>{item.title}</h3><p>Wortify · {item.counts.decks||0} decks · {item.counts.exercise||0} exercises · {item.counts.reading||0} readings</p><Btn isDisabled={!!busy||item.imported} onClick={()=>copy(item.id)}>{item.imported?'Added to your library':busy===item.id?'Adding...':'Add package'}</Btn></section>)}</div>}</Loading><Status error={error}/><Link to={`/${lang}/flashcard`}>Flashcards</Link> · <Link to={`/${lang}/reading`}>Reading</Link></details>;
}
