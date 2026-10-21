import {useEffect,useRef,useState} from "react";
import {Btn,Status} from "../../components/ui/ui.jsx";
import {PracticeModal} from "../practice/practice-workspace.jsx";
import {endpoint,request} from "../../lib/core.js";
import {t as tr,useLocale} from "../../i18n/index.js";
import CardImage from "./card-image.jsx";
import {IMAGE_FIELDS,searchImages} from "./image-search.js";
export default function AutoCardImages({cards,lang,deckId,onClose,onSaved}){
  useLocale();
  const candidates=useRef(cards.filter(card=>!card.image_url)).current;
  const done=useRef(new Set()),failed=useRef(new Set());
  const [suggestions,setSuggestions]=useState([]),[selected,setSelected]=useState([]),[busy,setBusy]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(""),[checked,setChecked]=useState(0),[started,setStarted]=useState(false),[errors,setErrors]=useState(0),[page,setPage]=useState(0);
  const controller=useRef(null),flight=useRef(false);useEffect(()=>()=>controller.current?.abort(),[]);
  async function generate(){
    if(flight.current)return;flight.current=true;
    const task=new AbortController();controller.current=task;setBusy(true);setStarted(true);setError("");
    try{
      for(const card of candidates){
        if(task.signal.aborted)break;if(done.current.has(card.id))continue;
        try{
          const results=await searchImages(card.german_text,{signal:task.signal,language:lang,meaning:card.vietnamese_meaning||""});
          if(task.signal.aborted)break;
          if(results.length){setSuggestions(old=>[...old,{card,images:results,choice:0}]);setSelected(old=>[...old,card.id]);}
          done.current.add(card.id);failed.current.delete(card.id);
        }catch(e){
          if(task.signal.aborted)break;
          failed.current.add(card.id);
          if(e.rateLimited){setError("Image provider is busy. Continue later.");break;}
        }
        setChecked(done.current.size);setErrors(failed.current.size);
        await new Promise(resolve=>setTimeout(resolve,500));
      }
    }finally{setChecked(done.current.size);setErrors(failed.current.size);flight.current=false;setBusy(false);}
  }
  async function save(){
    if(flight.current)return;flight.current=true;setSaving(true);setError("");const updated=[];
    try{
      const items=suggestions.filter(s=>selected.includes(s.card.id)).map(s=>({id:s.card.id,...Object.fromEntries(IMAGE_FIELDS.map(field=>[field,s.images[s.choice][field]||""]))}));
      // Respect the API's atomic batch size; completed batches remain saved on retry.
      for(let index=0;index<items.length;index+=50){
        const batch=items.slice(index,index+50);
        const result=await request(endpoint(lang,`decks/${deckId}/images/`),"POST",{items:batch});
        updated.push(...result.cards);const ids=new Set(batch.map(item=>item.id));
        setSuggestions(old=>old.filter(row=>!ids.has(row.card.id)));setSelected(old=>old.filter(id=>!ids.has(id)));
      }
      onClose();
    }catch(e){setError(e.message);setPage(0);}
    finally{if(updated.length)onSaved(updated);flight.current=false;setSaving(false);}
  }
  const pages=Math.max(1,Math.ceil(suggestions.length/24));
  return <PracticeModal title={tr("Suggest images")} onClose={onClose} pending={saving}>
    <p>{tr("Cards without images")}: {candidates.length}</p><Status error={error&&tr(error)}/>
    {started&&<p role="status">{checked}/{candidates.length}{errors>0&&` · ${tr("Search errors")}: ${errors}`}</p>}
    {!busy&&checked<candidates.length&&<Btn primary isDisabled={saving} onClick={generate}>{tr(started?"Continue search":"Find suggestions")}</Btn>}
    {busy&&<Btn onClick={()=>controller.current?.abort()}>{tr("Stop")}</Btn>}
    {!busy&&started&&!suggestions.length&&<p>{tr("No matching images. Try another keyword or paste a link.")}</p>}
    <div className="card-image-results">{suggestions.slice(page*24,page*24+24).map(s=><section key={s.card.id}><label className="check-line"><input type="checkbox" disabled={saving} checked={selected.includes(s.card.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,s.card.id]:old.filter(id=>id!==s.card.id))}/><strong>{s.card.german_text}</strong></label><p>{s.card.vietnamese_meaning}</p><CardImage card={s.images[s.choice]} onError={()=>setSelected(old=>old.filter(id=>id!==s.card.id))}/><Btn isDisabled={saving||s.images.length<2} onClick={()=>setSuggestions(old=>old.map(row=>row.card.id===s.card.id?{...row,choice:(row.choice+1)%row.images.length}:row))}>{tr("Another image")}</Btn></section>)}</div>
    {pages>1&&<div className="toolbar"><Btn isDisabled={page===0||saving} onClick={()=>setPage(old=>old-1)}>{tr("Previous")}</Btn><span>{page+1}/{pages}</span><Btn isDisabled={page>=pages-1||saving} onClick={()=>setPage(old=>old+1)}>{tr("Next")}</Btn></div>}
    {!!suggestions.length&&<Btn primary isDisabled={busy||saving||!selected.length} onClick={save}>{tr("Apply selected images")} ({selected.length})</Btn>}
  </PracticeModal>;
}
