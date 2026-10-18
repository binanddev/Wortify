import { useState, useRef } from "react";
import { t as tr, useLocale } from "../../i18n/index.js";
import { request, useResource, useNavigate } from "../../lib/core.js";
import { Btn, Field, Select, Loading, Status, Glass } from "../../components/ui/ui.jsx";
import { PracticeModal } from "../practice/practice-workspace.jsx";
import { PracticeActivity } from "../practice/practice-activity.jsx";
import { previewData } from "../practice/exercise-types.js";

export default function ReadingDiscover({lang, userId}) {
  useLocale();
  const navigate=useNavigate(), flight=useRef(false);
  const [saved,setSaved]=useState({}),[notice,setNotice]=useState("");
  async function saveReading(item, start=false) {
    if(flight.current)return;
    const known=saved[item.key]||item.saved_id;
    if(known){if(start)navigate(`/${lang}/reading/${known}`);return;}
    flight.current=true;setBusy(true);setError('');setNotice('');
    try {
      const result=await request(`/api/${lang}/reading/discover/save/`,'POST',{key:item.key,saved_id:item.saved_id});
      setSaved(s=>({...s,[item.key]:result.id}));
      if(start)navigate(`/${lang}/reading/${result.id}`);
      else setNotice('Saved to My readings. You can continue there anytime.');
    }catch(e){setError(e.message);}finally{flight.current=false;setBusy(false);}
  }
  function actions(item) {
    const exists=!!(saved[item.key]||item.saved_id);
    return <div className="flex flex-wrap gap-2 mt-3">
      <Btn primary isDisabled={busy} onClick={()=>saveReading(item,true)}>{tr(exists?'Continue learning':'Study now')}</Btn>
      <Btn isDisabled={busy||exists} onClick={()=>saveReading(item)}>{tr(exists?'Saved to My readings':'Save to My readings')}</Btn>
    </div>;
  }
  const [search,setSearch]=useState("");
  const [filters,setFilters]=useState({q:"",level:"",topic:"",source:"",page:1});
  const [opened,setOpened]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const resource=useResource(`/api/${lang}/reading/discover/?${new URLSearchParams(filters)}`);
  const change=(key,value)=>setFilters(f=>({...f,[key]:value,page:1}));
  return <section className="space-y-4">
    <form className="flex items-end gap-2" onSubmit={e=>{e.preventDefault();change('q',search);}}>
      <div className="flex-1"><Field label={tr("Search readings")} value={search} onChange={setSearch}/></div>
      <Btn icon="search" type="submit">{tr("Search")}</Btn>
    </form>
    <Loading resource={resource}>{data=><>
      <div className="grid gap-3 sm:grid-cols-3">
        <Select label={tr("Level")} value={filters.level} onChange={v=>change('level',v)}><option value="">{tr("All levels")}</option>{['A1','A2','B1','B2','C1','C2'].map(v=><option key={v} value={v}>{v}</option>)}</Select>
        <Select label={tr("Topic")} value={filters.topic} onChange={v=>change('topic',v)}><option value="">{tr("All topics")}</option>{data.topics.map(v=><option key={v} value={v}>{v}</option>)}</Select>
        <Select label={tr("Source")} value={filters.source} onChange={v=>change('source',v)}><option value="">{tr("All sources")}</option><option value="system">Wortify</option><option value="community">{tr("Community")}</option></Select>
      </div>
      <div className="flex items-center justify-between"><span role="status">{tr("{v0} readings",{v0:data.total})}</span><Btn onClick={()=>{setSearch('');setFilters({q:'',level:'',topic:'',source:'',page:1});}}>{tr("Clear filters")}</Btn></div>
      {!data.lessons.length && <p>{tr("No readings match these filters.")}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.lessons.map(item=><Glass key={item.key}>
        <p className="text-sm text-(--muted)">{item.source==='system'?'Wortify':tr('Community')}</p>
        <h2 className="text-lg font-semibold">{item.title}</h2>
        <p className="text-sm">{[item.level||tr('Level not specified'),item.topic].filter(Boolean).join(' · ')}</p>
        {actions(item)}
        <Btn icon="eye" isDisabled={busy} onClick={async()=>{setBusy(true);setError('');try{setOpened({...await request(`/api/${lang}/reading/discover/open/?key=${encodeURIComponent(item.key)}`),key:item.key,saved_id:item.saved_id});}catch(e){setError(e.message);}finally{setBusy(false);}}}>{tr("Preview reading")}</Btn>
      </Glass>)}</div>
      {data.total>24 && <div className="flex items-center gap-3"><Btn isDisabled={filters.page===1} onClick={()=>setFilters(f=>({...f,page:f.page-1}))}>{tr("Previous")}</Btn><span>{filters.page} / {Math.ceil(data.total/24)}</span><Btn isDisabled={filters.page*24>=data.total} onClick={()=>setFilters(f=>({...f,page:f.page+1}))}>{tr("Next")}</Btn></div>}
    </>}</Loading><Status error={error}/>{notice&&<p role="status">{tr(notice)}</p>}
    {opened && <PracticeModal title={opened.title} onClose={()=>setOpened(null)} size="5xl">
      {actions(opened)}
      <p className="text-sm text-(--muted)">{tr("This is a preview. Study now saves a personal copy and your progress.")}</p>
      <PracticeActivity key={opened.key} preview data={previewData(opened.payload)} id={`discover-${opened.key}`} userId={userId} lang={lang}/>
    </PracticeModal>}
  </section>;
}
