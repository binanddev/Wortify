import {useEffect,useRef,useState} from "react";
import {t as tr,useLocale} from "../../i18n/index.js";
import {request,useAction,useNavigate,useResource} from "../../lib/core.js";
import {Btn,Confirm,Field,Icon,Select,Status} from "../../components/ui/ui.jsx";
import {PracticeModal} from "../practice/practice-workspace.jsx";
import {PracticeActivity} from "../practice/practice-activity.jsx";
import {MediaEditor} from "../practice/exercise-media.jsx";
import {remapQuestionMedia} from "../practice/exercise-media-utils.js";
import {parsePracticeText,exerciseToText,textTemplate} from "../practice/practice-text.js";
import {previewData} from "../practice/exercise-types.js";
import {guide,matchReadingDrafts} from "./reading-authoring.js";

export default function ReadingEditorModal({lang,userId,folder,id,onClose,onSaved}) {
  useLocale();const navigate=useNavigate(),leaveTarget=useRef(null),action=useAction(),detail=useResource(id?`/api/${lang}/reading/${id}/`:null);
  const [dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[discard,setDiscard]=useState(false);
  const pending=action.pending||busy;
  const close=()=>{if(!pending)dirty?(leaveTarget.current=null,setDiscard(true)):onClose();};
  useEffect(()=>{if(!dirty&&!pending)return;const warn=e=>{e.preventDefault();e.returnValue="";};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[dirty,pending]);
  useEffect(()=>{
    if(!dirty&&!pending)return;
    const original=location.pathname+location.search;
    const guard=event=>{
      // Only browser Back/Forward; successful saves use the app's synthetic navigation.
      if(!event.isTrusted)return;
      const target=location.pathname+location.search;if(target===original)return;
      event.stopImmediatePropagation();history.pushState({},"",original);
      if(!pending){leaveTarget.current=target;setDiscard(true);}
    };
    window.addEventListener("popstate",guard,true);return()=>window.removeEventListener("popstate",guard,true);
  },[dirty,pending]);
  const save=nodes=>action.run(async signal=>{
    let result;
    if(id) result=await request(`/api/${lang}/reading/${id}/`,"PATCH",{...nodes[0],revision:detail.data.revision},signal);
    else result=await request(`/api/${lang}/reading/`,"POST",{folder_id:folder?.id??null,lessons:nodes},signal);
    onSaved(result);onClose();
  });
  return <>
    <PracticeModal title={tr(id?"Edit reading":"Create reading")} className="reading-editor-modal" size="4xl" pending={pending} onClose={close}>
      <div className="reading-editor-destination"><Icon name="folder" size={17}/><span>{folder?.title||tr("My readings")}</span></div>
      <Status error={action.error||detail.error}/>
      {id&&!detail.data?(!detail.error&&<Status>{tr("Loading…")}</Status>):<ReadingEditor key={id?`${id}:${detail.data.revision}`:"new"} lang={lang} userId={userId} lesson={id?detail.data:null} pending={action.pending} onBusy={setBusy} onDirty={setDirty} onSave={save}/>}
    </PracticeModal>
    {discard&&<Confirm title={tr("Discard unsaved changes?")} description={tr("Your draft has not been saved. Keep editing or discard it.")} cancelLabel="Keep editing" confirmLabel="Discard changes" onClose={()=>{leaveTarget.current=null;setDiscard(false);}} onConfirm={()=>{const target=leaveTarget.current;leaveTarget.current=null;setDiscard(false);onClose(!!target);if(target)navigate(target);}}/>}
  </>;
}

function ReadingEditor({lang,userId,lesson,pending,onBusy,onDirty,onSave}) {
  const [text,setText]=useState(()=>lesson?exerciseToText({...lesson.payload,title:lesson.title}):"");
  const [nodes,setNodes]=useState(()=>lesson?[{title:lesson.title,payload:lesson.payload}]:null);
  const [media,setMedia]=useState(()=>lesson?{existing:lesson.payload.attachments||[]}:{});
  const initial=useRef({text,media:JSON.stringify(media)}),previous=useRef(nodes||[]),fileInput=useRef(null),guideText=useRef(null),draftCounter=useRef(0);
  const [error,setError]=useState(""),[notice,setNotice]=useState(""),[files,setFiles]=useState([]),[reading,setReading]=useState(false),[uploading,setUploading]=useState(false);
  const [preview,setPreview]=useState(null),[mediaIndex,setMediaIndex]=useState(null),[help,setHelp]=useState(false);
  const locked=pending||reading||uploading;
  const changed=text!==initial.current.text||JSON.stringify(media)!==initial.current.media;
  useEffect(()=>{onBusy(locked);},[locked,onBusy]);
  useEffect(()=>()=>onBusy(false),[onBusy]);
  useEffect(()=>{onDirty(changed);},[changed,onDirty]);
  const key=(node,index)=>lesson?"existing":node._draftKey||`${index}:${node.title}`;
  const withMedia=(node,index)=>{const {_draftKey,...clean}=node;return {...clean,payload:{...node.payload,attachments:media[key(node,index)]||[]}};};
  const orphaned=nodes?Object.entries(media).filter(([source,items])=>items.length&&!nodes.some((node,index)=>key(node,index)===source)):[];
  useEffect(()=>{if(!orphaned.length)setNotice(value=>value==="Some attachments need a reading. Reassign them before saving."?"":value);},[orphaned.length]);
  const update=value=>{setText(value);setNodes(null);setError("");};
  async function load(incoming) {
    if(locked)return;setReading(true);setError("");
    try {const selected=[...incoming];if(!selected.length)return;
      if(selected.some(file=>!/\.txt$/i.test(file.name)))throw Error("Only UTF-8 .txt files are supported.");
      if(selected.reduce((sum,file)=>sum+file.size,0)>2000000)throw Error("Combined files must not exceed 2 MB.");
      update((await Promise.all(selected.map(file=>file.text()))).map(value=>value.replace(/^\uFEFF/,"")).join("\n\n"));setFiles(selected.map(file=>file.name));
    }catch(e){setError(e.message);}finally{setReading(false);}
  }
  function check(target) {
    try {const parsed=parsePracticeText(text).nodes,matches=matchReadingDrafts(parsed,previous.current);
      const next=parsed.map((node,index)=>({...node,_draftKey:matches[index]>=0?key(previous.current[matches[index]],matches[index]):`draft${draftCounter.current++}:${node.title}`}));
      if(next.some(node=>node.payload.presentation.interaction!=="reading"))throw Error("Only TYPE: reading lessons belong here.");
      if(lesson&&next.length!==1)throw Error("Edit one reading at a time.");
      const mapped={...media};let detached=false;
      next.forEach((node,index)=>{const before=previous.current.find((item,j)=>key(item,j)===key(node,index));if(before){const items=media[key(node,index)]||[];mapped[key(node,index)]=remapQuestionMedia(items,before.payload.questions,node.payload.questions);detached||=mapped[key(node,index)].some((item,i)=>items[i].question&&!item.question);}});
      setMedia(mapped);setNodes(next);previous.current=next;setError("");setNotice(Object.entries(mapped).some(([source,items])=>items.length&&!next.some((node,index)=>key(node,index)===source))?"Some attachments need a reading. Reassign them before saving.":detached?"Some questions changed or were deleted. Their files now belong to the entire exercise; review Media before saving.":"");
      if(target==="media")setMediaIndex(0);else setPreview(0);
    }catch(e){setNodes(null);setError(e.message);}
  }
  async function copyGuide(){try{await navigator.clipboard.writeText(guide);setNotice("Guide copied.");}catch{setNotice("Clipboard access is unavailable. Select the instructions below to copy them.");guideText.current?.focus();guideText.current?.select();}}
  return <div className="reading-editor" onDragOver={e=>{if([...e.dataTransfer.types].includes("Files"))e.preventDefault();}} onDrop={e=>{if(e.dataTransfer.files.length){e.preventDefault();load(e.dataTransfer.files);}}}>
    <div className="reading-editor-tools">
      <input ref={fileInput} type="file" hidden accept=".txt,text/plain" multiple={!lesson} disabled={locked} aria-label={tr("Choose .txt files")} onChange={e=>{load(e.target.files||[]);e.target.value="";}}/>
      <Btn isDisabled={locked} onClick={()=>fileInput.current?.click()}><Icon name="upload" size={17}/><span>{tr("Choose .txt files")}</span></Btn>
      <Btn isDisabled={locked} onClick={()=>setHelp(true)}><Icon name="help" size={17}/><span>{tr("Authoring guide")}</span></Btn>
      <Btn isDisabled={locked||!!text.trim()} onClick={()=>update(textTemplate("reading"))}><Icon name="exercise" size={17}/><span>{tr("Insert sample")}</span></Btn>
    </div>
    {files.length>0&&<p className="reading-editor-files">{files.join(" · ")}</p>}
    <Status error={error}/>{notice&&<p className="reading-editor-hint" role="status">{tr(notice)}</p>}
    <Field label={tr("Reading and questions")} multiline rows={12} value={text} onChange={update} isDisabled={locked} placeholder={tr("Paste your reading here…")}/>
    <div className="reading-editor-footer"><span>{nodes?tr("{count} readings ready",{count:nodes.length}):tr("Check the content before importing.")}</span><div>
      <Btn isDisabled={locked||!text.trim()} onClick={()=>check("media")}><Icon name="image" size={17}/><span>{tr("Images and attachments")}</span></Btn>
      <Btn isDisabled={locked||!text.trim()} onClick={()=>check("preview")}><Icon name="eye" size={17}/><span>{tr("Check and preview")}</span></Btn>
      <Btn primary isDisabled={locked||!nodes||!!orphaned.length||!!(lesson&&!changed)} onClick={()=>onSave(nodes.map(withMedia))}><Icon name="save" size={17}/><span>{tr(lesson?"Save changes":"Save readings")}</span></Btn>
    </div></div>
    {help&&<PracticeModal title={tr("Authoring guide")} className="reading-guide-modal" pending={locked} onClose={()=>setHelp(false)}>
      <div className="reading-editor-tools"><Btn onClick={copyGuide}><Icon name="copy" size={17}/><span>{tr("Copy guide")}</span></Btn><a className="btn" download={`wortify-reading-guide-${lang}.txt`} href={`data:text/plain;charset=utf-8,${encodeURIComponent(guide)}`}><Icon name="download" size={17}/><span>{tr("Download full guide (.txt)")}</span></a></div>
      {notice&&<p className="reading-editor-hint" role="status">{tr(notice)}</p>}
      <textarea ref={guideText} readOnly rows={18} value={guide} aria-label={tr("Complete authoring guide")} onFocus={e=>e.target.select()}/>
    </PracticeModal>}
    {preview!==null&&nodes&&<PracticeModal title={tr("Preview reading")} size="5xl" onClose={()=>setPreview(null)}>
      {nodes.length>1&&<Select label={tr("Reading draft")} value={preview} onChange={value=>setPreview(Number(value))}>{nodes.map((node,index)=><option key={index} value={index}>{node.title}</option>)}</Select>}
      <PracticeActivity key={`${preview}:${text}`} preview data={previewData(withMedia(nodes[preview],preview).payload)} id={`reading-draft-${preview}`} userId={userId} lang={lang}/>
    </PracticeModal>}
    {mediaIndex!==null&&nodes&&<PracticeModal title={tr("Images and attachments")} pending={uploading} onClose={()=>setMediaIndex(null)}>
      {nodes.length>1&&<Select label={tr("Reading draft")} value={mediaIndex} disabled={uploading} onChange={value=>setMediaIndex(Number(value))}>{nodes.map((node,index)=><option key={index} value={index}>{node.title}</option>)}</Select>}
      {orphaned.length>0&&<div className="reading-orphan-media"><p role="status">{tr("Some attachments need a reading. Reassign them before saving.")}</p>{orphaned.map(([source,items])=><div key={source}><span>{source.slice(source.indexOf(":")+1)} · {items.length}</span><Btn isDisabled={uploading} onClick={()=>setMedia(old=>{const target=key(nodes[mediaIndex],mediaIndex),merged=[...(old[target]||[]),...items.map(item=>({...item,question:""}))];return {...old,[source]:[],[target]:[...new Map(merged.map(item=>[item.id,item])).values()]};})}>{tr("Assign to this reading")}</Btn><Btn isDisabled={uploading} onClick={()=>setMedia(old=>({...old,[source]:[]}))}>{tr("Remove")}</Btn></div>)}</div>}
      <MediaEditor lang={lang} items={media[key(nodes[mediaIndex],mediaIndex)]||[]} questions={nodes[mediaIndex].payload.questions} disabled={pending} onBusy={setUploading} onChange={items=>setMedia(old=>({...old,[key(nodes[mediaIndex],mediaIndex)]:items}))}/>
      <p className="reading-editor-hint">{tr("Keep uploaded images listed in this reading. Insert their image command into the passage.")}</p>
      {(media[key(nodes[mediaIndex],mediaIndex)]||[]).filter(item=>item.type?.startsWith("image/")).map(item=><Field key={item.id} label={item.name} readOnly value={`<img src="${item.url}" alt="Reading illustration" style="max-width:100%">`} onFocus={e=>e.target.select()}/>)}
    </PracticeModal>}
  </div>;
}
