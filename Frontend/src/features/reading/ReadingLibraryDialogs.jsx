import {useEffect,useState} from "react";
import {t as tr,useLocale} from "../../i18n/index.js";
import {useResource} from "../../lib/core.js";
import {Btn,Field,Icon,Select,Status} from "../../components/ui/ui.jsx";
import VisibilitySelect from "../../components/ui/VisibilitySelect.jsx";
import {PracticeModal} from "../practice/practice-workspace.jsx";
import {folderAncestors} from "../flashcards/flashcard-navigation.jsx";

export default function ReadingLibraryDialogs({operation,folders,lang,pending,error,onClose,onApply}) {
  useLocale();const op=operation,node=op.node;
  const [name,setName]=useState(op.action==="create"?"":node?.title||"");
  const detail=useResource(op.action==="share"?`/api/${lang}/reading/${node.id}/`:null);
  const [sharing,setSharing]=useState({visibility:"private",level:"",topic:""});
  useEffect(()=>{if(detail.data)setSharing({visibility:detail.data.visibility,level:detail.data.level,topic:detail.data.topic});},[detail.data]);
  const mapped=folders.map(folder=>({...folder,name:folder.title}));
  const destination=folders.find(folder=>folder.id===node?.parent_id);
  const title=op.action==="create"?"New folder":op.action==="rename"?"Rename":op.action==="share"?"Sharing & categories":op.action==="delete"?"Delete permanently":op.action==="copy"?"Copy":"Move";
  const apply=async value=>{if(await onApply(value))onClose();};
  return <PracticeModal title={tr(title)} size="lg" className="reading-library-dialog" pending={pending} onClose={onClose}>
    <Status error={error||detail.error}/>
    {["create","rename"].includes(op.action)&&<form onSubmit={e=>{e.preventDefault();if(name.trim())apply({title:name.trim()});}} className="reading-library-form">
      <Field label={tr(op.action==="create"||node.kind==="folder"?"Folder name":"New name")} value={name} onChange={setName} maxLength={200} autoFocus isDisabled={pending}/>
      <div className="reading-library-dialog-actions"><Btn isDisabled={pending} onClick={onClose}>{tr("Cancel")}</Btn><Btn primary type="submit" isDisabled={pending||!name.trim()}>{tr(op.action==="create"?"Create folder":"Save changes")}</Btn></div>
    </form>}
    {["move","copy"].includes(op.action)&&<div className="reading-destination-list" aria-label={tr("Choose a folder")}>
      <button type="button" disabled={pending} onClick={()=>apply({folder_id:null})}><Icon name="home" size={18}/><span>{tr("My readings")}</span></button>
      {mapped.filter(folder=>!(node?.kind==="folder"&&folderAncestors(mapped,folder).some(parent=>parent.id===node.id))).map(folder=><button key={folder.id} type="button" disabled={pending} onClick={()=>apply({folder_id:folder.id})}><Icon name="folder" size={18}/><span>{folderAncestors(mapped,folder).map(parent=>parent.name).join(" / ")}</span></button>)}
    </div>}
    {op.action==="delete"&&<>
      <p>{node?.title||tr("{v0} readings",{v0:op.ids.length})}</p>
      <p className="reading-editor-hint">{tr(node?.kind==="folder"?"The folder and its subfolders will be removed. Readings will be kept in {folder}.":op.ids?.length>1?"Selected readings and their learning progress will be permanently deleted.":"This reading and its learning progress will be permanently deleted.",{folder:destination?.title||tr("My readings")})}</p>
      <div className="reading-library-dialog-actions"><Btn isDisabled={pending} onClick={onClose}>{tr("Cancel")}</Btn><Btn primary color="danger" isDisabled={pending} onClick={()=>apply({})}>{tr("Delete permanently")}</Btn></div>
    </>}
    {op.action==="share"&&(detail.loading?<Status>{tr("Loading…")}</Status>:detail.data&&<form className="reading-library-form" onSubmit={e=>{e.preventDefault();apply(sharing);}}>
      <VisibilitySelect value={sharing.visibility} disabled={pending} onChange={value=>setSharing(old=>({...old,visibility:value}))}/>
      <Select label={tr("Level")} value={sharing.level} disabled={pending} onChange={value=>setSharing(old=>({...old,level:value}))}><option value="">{tr("Level not specified")}</option>{["A1","A2","B1","B2","C1","C2"].map(level=><option key={level}>{level}</option>)}</Select>
      <Field label={tr("Topic")} value={sharing.topic} maxLength={80} isDisabled={pending} onChange={value=>setSharing(old=>({...old,topic:value}))}/>
      <div className="reading-library-dialog-actions"><Btn isDisabled={pending} onClick={onClose}>{tr("Cancel")}</Btn><Btn primary type="submit" isDisabled={pending}>{tr("Save changes")}</Btn></div>
    </form>)}
  </PracticeModal>;
}
