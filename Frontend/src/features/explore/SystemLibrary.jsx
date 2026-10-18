import { t as tr, useLocale } from "../../i18n/index.js";
import {useState} from 'react';
import {request,useResource} from '../../lib/core.js';
import {Btn,Loading,Status,Link} from '../../components/ui/ui.jsx';
export default function SystemLibrary({lang, label = "Wortify system library"}){
  useLocale();
 const resource=useResource(`/api/${lang}/system-library/`);const [busy,setBusy]=useState(''),[error,setError]=useState('');
 async function copy(id){setBusy(id);setError('');try{await request(`/api/${lang}/system-library/${id}/copy/`,'POST',{});window.location.reload();}catch(e){setError(e.message);}finally{setBusy('');}}
 return <details className="mb-5"><summary>{tr(label)}</summary><p>{tr("Official Practice Hub and Reading packages. Add once to keep your own learning progress.")}</p><Loading resource={resource}>{data=><div>{data.packages.length===0&&<p>{tr("No packages yet.")}</p>}{data.packages.map(item=><section key={item.id}><h3>{item.title}</h3><p>Wortify · {item.counts.exercise||0}{tr(" exercises · ")}{item.counts.reading||0}{tr(" readings")}</p><Btn isDisabled={!!busy||item.imported} onClick={()=>copy(item.id)}>{item.imported?tr("Added to your library"):busy===item.id?tr("Adding..."):tr("Add package")}</Btn></section>)}</div>}</Loading><Status error={error}/><Link to={`/${lang}/practice/all`}>{tr("Practice Hub")}</Link> · <Link to={`/${lang}/reading`}>{tr("Reading")}</Link></details>;
}
