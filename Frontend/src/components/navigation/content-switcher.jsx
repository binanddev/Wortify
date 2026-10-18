import {useState} from 'react';
import {useResource} from '../../lib/core.js';
import {Btn,Field,Link,Loading} from '../ui/ui.jsx';
import {PracticeModal} from '../../features/practice/practice-workspace.jsx';
import {t as tr,useLocale} from '../../i18n/index.js';
export default function ContentSwitcher({lang,kind,currentId}) {
 useLocale();const [open,setOpen]=useState(false);
 const label=kind==='decks'?'Switch deck':'Switch reading';
 return <><Btn icon="folder" onClick={()=>setOpen(true)}>{tr(label)}</Btn>{open&&<PracticeModal title={tr(label)} onClose={()=>setOpen(false)}><Choices {...{lang,kind,currentId}} onClose={()=>setOpen(false)}/></PracticeModal>}</>;
}
function Choices({lang,kind,currentId,onClose}) {
 useLocale();const [query,setQuery]=useState('');
 const resource=useResource(`/api/${lang}/${kind==='decks'?'decks':'reading'}/`);
 return <><Field label={tr('Search')} value={query} onChange={setQuery}/><Loading resource={resource}>{data=>{
 const items=(data[kind==='decks'?'decks':'lessons']||[]).filter(item=>item.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 return <div className="grid gap-2">{items.map(item=><Link key={item.id} className="btn justify-start" to={`/${lang}/${kind==='decks'?'flashcard/deck':'reading'}/${item.id}`} aria-current={String(item.id)===String(currentId)?'page':undefined} onClick={onClose}>{item.title}{String(item.id)===String(currentId)?' ✓':''}</Link>)}{!items.length&&<p>{tr('No matching records.')}</p>}</div>;
 }}</Loading></>;
}
