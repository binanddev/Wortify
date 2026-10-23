import {usePagination} from '../../lib/pagination.js';
import Pagination from '../../components/ui/pagination.jsx';
import CardImagePicker from "./card-image-picker.jsx";
import CardImage from "./card-image.jsx";
import AutoCardImages from "./auto-card-images.jsx";
import {useState, useMemo} from "react";
import {t as tr, useLocale} from "../../i18n/index.js";
import {Btn, Field, Editor, Confirm} from "../../components/ui/ui.jsx";
import {PracticeModal} from "../practice/practice-workspace.jsx";
import {endpoint, request} from "../../lib/core.js";
import {cardFields} from "./card-fields.js";
import QuickCardEditor from "./quick-card-editor.jsx";
import {ImportCards} from "./library.jsx";

export default function CardManager({lang,deckId,cards,onClose,onUpdated,onCardsChanged}) {
  useLocale();
  const [imagesOpen,setImagesOpen]=useState(false);
  const [query,setQuery]=useState("");
  const [editing,setEditing]=useState(null);
  const [adding,setAdding]=useState(false);
  const [removing,setRemoving]=useState(null);
  const [importing,setImporting]=useState(false);
  const api=(path,method,data,signal)=>request(endpoint(lang,path),method,data,signal);
  const reload=async()=>{const data=await api(`decks/${deckId}/`);onCardsChanged(data.cards);};
  const visible=useMemo(()=>cards.filter(c=>`${c.german_text} ${c.vietnamese_meaning}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())),[cards,query]);
  const pagination=usePagination(visible.length,query);
  const pageCards=visible.slice(pagination.start,pagination.end);
  if(imagesOpen)return <AutoCardImages cards={cards} lang={lang} deckId={deckId} onClose={()=>setImagesOpen(false)} onSaved={updated=>onCardsChanged(cards.map(card=>updated.find(item=>item.id===card.id)||card))}/>;
  if(adding) return <Editor title={tr("Add card")} fields={cardFields} onClose={()=>setAdding(false)} onSave={async(values,signal)=>{
    const result=await api(`decks/${deckId}/cards/`,"POST",values,signal);
    onCardsChanged([...cards,{...values,id:result.id}]);
  }}>{(values,set)=><CardImagePicker values={values} set={set} lang={lang}/>}</Editor>;
  if(editing) return <QuickCardEditor card={editing} lang={lang} deckId={deckId} onClose={()=>setEditing(null)} onSaved={onUpdated}/>;
  if(importing) return <ImportCards api={api} id={deckId} lang={lang} reload={reload} onClose={()=>setImporting(false)}/>;
  if(removing) return <Confirm title={tr("Delete card?")} description={removing.german_text} onClose={()=>setRemoving(null)} onConfirm={async()=>{
    await api(`decks/${deckId}/cards/${removing.id}/`,"DELETE");
    onCardsChanged(cards.filter(c=>c.id!==removing.id));setRemoving(null);
  }}/>;
  return <PracticeModal title={tr("Manage cards")} onClose={onClose}>
    <div className="toolbar"><Btn primary icon="plus" onClick={()=>setAdding(true)}>{tr("Add card")}</Btn><Btn onClick={()=>setImporting(true)}>{tr("Import")}</Btn><Btn isDisabled={!cards.some(card=>!card.image_url)} onClick={()=>setImagesOpen(true)}>{tr("Suggest images")}</Btn></div>
    <Field label={tr("Search cards")} value={query} onChange={setQuery}/>
    <div className="grid gap-3">{pageCards.map(card=><div key={card.id} className="flex items-center gap-3 border-b pb-3">
      <CardImage card={card} compact/><div className="min-w-0 flex-1 break-words"><strong>{card.german_text}</strong><p>{card.vietnamese_meaning}</p></div>
      <Btn icon="edit" aria-label={`${tr("Edit card")}: ${card.german_text}`} onClick={()=>setEditing(card)}>{tr("Edit")}</Btn>
      <Btn icon="trash" aria-label={`${tr("Delete")}: ${card.german_text}`} onClick={()=>setRemoving(card)}>{tr("Delete")}</Btn>
    </div>)}{!visible.length&&<p>{tr("No matching cards.")}</p>}</div>
    <Pagination pagination={pagination} count={visible.length}/>
  </PracticeModal>;
}
