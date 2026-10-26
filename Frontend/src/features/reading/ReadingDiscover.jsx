import { useState, useRef, useEffect } from "react";
import { t as tr, useLocale } from "../../i18n/index.js";
import { request, useResource, useNavigate } from "../../lib/core.js";
import { Btn, Field, Select, Loading, Status, Glass, Icon } from "../../components/ui/ui.jsx";
import { PracticeModal } from "../practice/practice-workspace.jsx";
import { PracticeActivity } from "../practice/practice-activity.jsx";
import { previewData } from "../practice/exercise-types.js";

export default function ReadingDiscover({lang, userId, onRequireAccount, initialReadingId}) {
  useLocale();
  const navigate=useNavigate(), flight=useRef(false);
  const [saved,setSaved]=useState({}),[notice,setNotice]=useState("");
  async function saveReading(item, start=false) {
    if(onRequireAccount){
      if(!start){onRequireAccount({kind:'reading',key:item.key});return;}
      if(flight.current)return;
      flight.current=true;setBusy(true);setError('');
      try {setOpened({...await request(`/api/${lang}/reading/discover/open/?key=${encodeURIComponent(item.key)}`),key:item.key});}
      catch(e){setError(e.message);}finally{flight.current=false;setBusy(false);}
      return;
    }
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
  function actions(item, compact=false) {
    const exists=!!(saved[item.key]||item.saved_id);
    return <div className={compact ? "reading-discover-card-actions" : "reading-discover-preview-actions"}>
      <Btn primary isDisabled={busy} onClick={()=>saveReading(item,true)}><span>{tr(exists?'Continue learning':'Study now')}</span><Icon name="arrow" size={17}/></Btn>
      {compact && <Btn icon="eye" isDisabled={busy} onClick={()=>previewReading(item)}>{tr("Preview reading")}</Btn>}
      {compact ? <Btn icon={exists?"check":"plus"} isDisabled={busy||exists} onClick={()=>saveReading(item)}>{tr(exists?'Saved to My readings':'Save to My readings')}</Btn> : <Btn isDisabled={busy||exists} onClick={()=>saveReading(item)}>{tr(exists?'Saved to My readings':'Save to My readings')}</Btn>}
    </div>;
  }
  async function previewReading(item) {
    if(flight.current)return;
    flight.current=true;setBusy(true);setError('');
    try {setOpened({...item,...await request(`/api/${lang}/reading/discover/open/?key=${encodeURIComponent(item.key)}`)});}
    catch(e){setError(e.message);}finally{flight.current=false;setBusy(false);}
  }
  const [search,setSearch]=useState("");
  const [filters,setFilters]=useState({q:"",level:"",topic:"",source:"",page:1});
  const [filterDraft,setFilterDraft]=useState(null);
  const [topics,setTopics]=useState([]);
  const [opened,setOpened]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
  useEffect(()=>{
    if(!initialReadingId)return;
    const controller=new AbortController();
    const key=`community:${initialReadingId}`;
    request(`/api/${lang}/reading/discover/open/?key=${key}`,'GET',undefined,controller.signal).then(data=>setOpened({...data,key})).catch(e=>{if(e.name!=='AbortError')setError(e.message);});
    return ()=>controller.abort();
  },[initialReadingId,lang]);
  const resource=useResource(`/api/${lang}/reading/discover/?${new URLSearchParams(filters)}`);
  useEffect(()=>{if(resource.data?.topics)setTopics(resource.data.topics);},[resource.data]);
  const change=(key,value)=>setFilters(f=>({...f,[key]:value,page:1}));
  const active = [
    ["q", filters.q], ["level", filters.level], ["topic", filters.topic],
    ["source", filters.source ? filters.source==='system' ? "Wortify" : tr("Community") : ""],
  ].filter(([,value])=>value);
  const clear=()=>{setSearch('');setFilters({q:'',level:'',topic:'',source:'',page:1});};
  return <section className="reading-discover" aria-label={tr("Explore readings")}>
    <form className="reading-discover-search" onSubmit={e=>{e.preventDefault();change('q',search.trim());}}>
      <Field aria-label={tr("Search readings")} placeholder={tr("Search readings")} value={search} onChange={setSearch} maxLength={200} autoComplete="off"/>
      <Btn icon="search" type="submit">{tr("Search")}</Btn>
      <Btn icon="filter" aria-pressed={!!(filters.level||filters.topic||filters.source)} onClick={()=>setFilterDraft({...filters})}>{tr("Filters")}</Btn>
    </form>
    <div className="reading-discover-summary">
      <span className="reading-discover-count" role="status">{resource.loading ? tr("Loading…") : resource.data ? tr("{v0} readings",{v0:resource.data.total}) : ""}</span>
      {active.length>0 && <div className="reading-discover-active" aria-label={tr("Active filters")}>
        {active.map(([key,value])=><button type="button" key={key} title={String(value)} aria-label={tr("Remove filter: {name}",{name:value})} onClick={()=>{if(key==='q')setSearch('');change(key,'');}}><span>{value}</span><Icon name="close" size={13}/></button>)}
        <Btn className="btn reading-discover-clear" onClick={clear}>{tr("Clear filters")}</Btn>
      </div>}
    </div>
    <Status error={opened ? '' : error}/>{notice&&<p className="reading-discover-notice" role="status"><Icon name="check" size={16}/>{tr(notice)}</p>}
    <Loading resource={resource}>{data=><>
      {!data.lessons.length && <div className="reading-discover-empty"><Icon name="search" size={26}/><p>{tr("No readings match these filters.")}</p>{active.length>0&&<Btn onClick={clear}>{tr("Clear filters")}</Btn>}</div>}
      <div className="reading-discover-grid">{data.lessons.map(item=><Glass as="article" className="reading-discover-card" key={item.key}>
        <div className="reading-discover-card-top"><span className="reading-discover-icon"><Icon name="book" size={21}/></span><span className="reading-discover-source">{item.source==='system'?'Wortify':tr('Community')}</span>{item.level&&<span className="reading-discover-level">{item.level}</span>}</div>
        <button type="button" className="reading-discover-title" title={item.title} aria-label={tr("Preview {name}",{name:item.title})} disabled={busy} onClick={()=>previewReading(item)}>{item.title}</button>
        <p className="reading-discover-topic">{item.topic||tr("Reading content")}</p>
        {actions(item,true)}
      </Glass>)}</div>
      {data.total>24 && <nav className="reading-discover-pagination" aria-label={tr("Reading pages")}><Btn icon="chevron_left" isDisabled={filters.page===1} onClick={()=>setFilters(f=>({...f,page:f.page-1}))}>{tr("Previous page")}</Btn><span>{filters.page} / {Math.ceil(data.total/24)}</span><Btn icon="chevron_right" isDisabled={filters.page*24>=data.total} onClick={()=>setFilters(f=>({...f,page:f.page+1}))}>{tr("Next page")}</Btn></nav>}
    </>}</Loading>
    {filterDraft && <PracticeModal title={tr("Filters")} size="lg" className="reading-discover-filters" onClose={()=>setFilterDraft(null)}>
      <form className="reading-discover-filter-form" onSubmit={e=>{e.preventDefault();setFilters(previous=>({...previous,level:filterDraft.level,topic:filterDraft.topic,source:filterDraft.source,page:1}));setFilterDraft(null);}}>
        <Select label={tr("Level")} value={filterDraft.level} onChange={value=>setFilterDraft(d=>({...d,level:value}))}><option value="">{tr("All levels")}</option>{['A1','A2','B1','B2','C1','C2'].map(value=><option key={value}>{value}</option>)}</Select>
        <Select label={tr("Topic")} value={filterDraft.topic} onChange={value=>setFilterDraft(d=>({...d,topic:value}))}><option value="">{tr("All topics")}</option>{topics.map(value=><option key={value} value={value}>{value}</option>)}</Select>
        <Select label={tr("Source")} value={filterDraft.source} onChange={value=>setFilterDraft(d=>({...d,source:value}))}><option value="">{tr("All sources")}</option><option value="system">Wortify</option><option value="community">{tr("Community")}</option></Select>
        <div className="reading-discover-filter-footer"><Btn className="btn reading-discover-reset" onClick={()=>setFilterDraft(d=>({...d,level:'',topic:'',source:''}))}>{tr("Clear filters")}</Btn><Btn onClick={()=>setFilterDraft(null)}>{tr("Cancel")}</Btn><Btn primary type="submit">{tr("Apply")}</Btn></div>
      </form>
    </PracticeModal>}
    {opened && <PracticeModal title={opened.title} onClose={()=>setOpened(null)} size="5xl" className="reading-discover-preview" pending={busy}>
      <Status error={error}/>
      {onRequireAccount?<Btn primary onClick={()=>onRequireAccount({kind:"reading",key:opened.key})}>{tr("Save to My readings")}</Btn>:actions(opened)}
      <PracticeActivity key={opened.key} preview data={previewData(opened.payload)} id={`discover-${opened.key}`} userId={userId} lang={lang}/>
    </PracticeModal>}
  </section>;
}
