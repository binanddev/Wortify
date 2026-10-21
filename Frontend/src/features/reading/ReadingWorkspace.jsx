import VisibilitySelect from "../../components/ui/VisibilitySelect.jsx";
import ContentSwitcher from "../../components/navigation/content-switcher.jsx";
import { t as tr, useLocale } from "../../i18n/index.js";
import ReadingDiscover from "./ReadingDiscover.jsx";
import { PracticeModal } from "../practice/practice-workspace.jsx";
import { ReadingPassage } from "../practice/reading-layout.jsx";
import { ModalContent, ModalHeader, ModalBody } from "@heroui/react";
import { Modal } from "../../components/modal/modal.jsx";
import { useEffect, useRef, useState } from "react";
import { request, useNavigate } from "../../lib/core.js";
import { Page, SidebarTools, Btn, Icon, Link, Glass, Confirm, Field, Select } from "../../components/ui/ui.jsx";
import { PracticeActivity } from "../practice/practice-activity.jsx";
import { parsePracticeText, exerciseToText, textTemplate, READING_TEXT_RULES } from "../practice/practice-text.js";
import { previewData } from "../practice/exercise-types.js";
import { MediaEditor } from "../practice/exercise-media.jsx";

const guide = `READING IMPORT — UTF-8 .txt
Create original reading lessons in the requested language and level. Return only importable text.
Start each lesson with EXERCISE: title, then TYPE: reading and STYLE: split_reading.
Use INSTRUCTIONS: before the passage and all QUESTION fields. Put metadata before questions.
Continue multiline text with > at the beginning of each continuation line. Separate lessons with another EXERCISE.
${READING_TEXT_RULES}
Use 1–100 questions per passage, 1–100 lessons per import, maximum 2 MB per import.
Use exact option text in ANSWER, not letters or indexes. Options are shuffled for learners.
Do not use | inside an option. Each question needs 2–12 unique options.
Images must be real URLs supplied by the author; do not invent image URLs. Images are not required.

COMPLETE EXAMPLE
${textTemplate("reading")}`;

export default function ReadingWorkspace({ lang, route, userId, sound, onRequireAccount, initialReadingId }) {
  useLocale();
  const nav = useNavigate(), parts = route.split("?")[0].split("/").filter(Boolean);
  const discovering = !!onRequireAccount || parts[2] === "discover";
  const creating = parts[2] === "create", id = creating || discovering ? null : parts[2], editing = parts[3] === "edit", authoring = creating || editing;
  const passageOnly = parts[3] === "passage";
  const fileInput = useRef(null);
  const [showMedia,setShowMedia] = useState(false);
  const [sharing,setSharing] = useState(null);
  const base = `/api/${lang}/reading/`;
  const [folders,setFolders]=useState([]),[folderId,setFolderId]=useState(null);
  const [lessons,setLessons] = useState([]), [lesson,setLesson] = useState(null), [text,setText] = useState("");
  const [draft,setDraft] = useState(null), [preview,setPreview] = useState(false), [media,setMedia] = useState([]), [mediaBusy,setMediaBusy] = useState(false);
  const [busy,setBusy] = useState(false), [message,setMessage] = useState(""), [confirm,setConfirm] = useState(false), [showGuide,setShowGuide] = useState(false);
  useEffect(() => { setFolderId(null); }, [base]);
  async function act(fn) { setBusy(true); setMessage(""); try { await fn(); } catch(e) { setMessage(e.message); } finally { setBusy(false); } }
  useEffect(() => {
    const c = new AbortController();
    if (creating || discovering) return () => c.abort();
    request(base + (id ? `${id}/` : ""),"GET",undefined,c.signal).then(d => {
      if (id) { setLesson(d); if (editing) { setText(exerciseToText(d.payload)); setMedia(d.payload.attachments || []); } }
      else {setLessons(d.lessons);setFolders(d.folders||[]);}
    }).catch(e => { if(e.name !== "AbortError") setMessage(e.message); });
    return () => c.abort();
  }, [base,id,creating,editing,discovering]);
  function validate() {
    const result = parsePracticeText(text).nodes;
    if (result.some(n => n.payload.presentation.interaction !== "reading")) throw new Error("Only TYPE: reading lessons belong here.");
    if (editing && result.length !== 1) throw new Error("Edit one reading at a time.");
    setDraft(result);
    return result;
  }
  async function save() {
    const nodes = validate().map(n => ({...n,payload:{...n.payload,attachments:media}}));
    if (editing) {
      await request(base+id+"/","PATCH",{...nodes[0],revision:lesson.revision});
      nav(`/${lang}/reading/${id}`);
    } else {
      const result = await request(base,"POST",{lessons:nodes});
      nav(`/${lang}/reading/${result.lessons[0].id}`);
    }
  }
  async function copyGuide() {
    await navigator.clipboard.writeText(guide);
    setMessage("AI instructions copied.");
  }
  function insertSample() {
    if (text.trim()) { setMessage("Clear the editor before inserting the sample, so your draft is not overwritten."); return; }
    setText(textTemplate("reading")); setDraft(null); setPreview(false);
  }
  if (passageOnly) return <Page><h1>{lesson?.title || tr("Reading")}</h1>{message && <p role="status">{message}</p>}{lesson && <ReadingPassage exercise={lesson.payload}/>}</Page> ;
  return <Page><SidebarTools navOnly><nav className="reading-navigation" aria-label={tr("Reading tools")}>
    <div className="reading-nav-links">
      <Link to={`/${lang}/reading`} onClick={()=>setFolderId(null)} aria-current={!id && !creating && !discovering ? "page" : undefined}><Icon name="book"/>{tr(" My readings")}</Link>
      <Link to={`/${lang}/reading/create`} aria-current={creating ? "page" : undefined}><Icon name="plus"/>{tr(" Create reading")}</Link>
    </div>
    <Link className="btn guide-icon-link" to={`/${lang}/reading/discover`} aria-label={tr("Explore")} title={tr("Explore")} aria-current={discovering ? "page" : undefined}><Icon name="explore"/></Link>
    {authoring && <>
      <div className="reading-nav-tools" role="group" aria-label={tr("Import and authoring tools")}>
        <Btn icon="copy" isDisabled={busy} onClick={()=>act(copyGuide)}>{tr("Copy AI instructions")}</Btn>
        <Btn icon="book" onClick={()=>setShowGuide(true)}>{tr("Formatting & import guide")}</Btn>
        <Btn icon="upload" isDisabled={busy} onClick={()=>fileInput.current?.click()}>{tr("Import text file")}</Btn>
        <Btn icon="exercise" isDisabled={busy || !!text.trim()} onClick={insertSample}>{tr("Insert sample")}</Btn>
        <Btn icon="image" onClick={()=>setShowMedia(true)}>{tr("Images and attachments")}</Btn>
      </div>
      <div className="reading-nav-tools" role="group" aria-label={tr("Editor actions")}>
        <Btn icon="close" onClick={()=>{if(!text.trim()||window.confirm(tr("Leave this draft without saving?")))nav(`/${lang}/reading${editing?`/${id}`:""}`);}}>{tr("Cancel")}</Btn>
        <Btn icon="edit" aria-pressed={!preview} onClick={()=>setPreview(false)}>{tr("Edit source")}</Btn>
        <Btn icon="eye" aria-pressed={preview} isDisabled={busy || mediaBusy || !text.trim()} onClick={()=>act(async()=>{validate();setPreview(true);})}>{tr("Preview reading")}</Btn>
        <Btn primary icon="save" isDisabled={busy || mediaBusy || !text.trim()} onClick={()=>act(save)}>{tr("Save reading")}</Btn>
      </div>
    </>}
    {id && lesson && <div className="reading-nav-tools">
      {!authoring&&<ContentSwitcher lang={lang} kind="reading" currentId={id}/>}
      <Btn icon="share" onClick={()=>setSharing({visibility:lesson.visibility||"private",level:lesson.level||"",topic:lesson.topic||""})}>{tr("Sharing & categories")}</Btn>
      <a className="btn" href={`/${lang}/reading/${id}/passage`} target="_blank" rel="noopener noreferrer" title={tr("Open passage in new tab")} aria-label={tr("Open passage in new tab")}><Icon name="external"/></a>
      <Btn icon={editing ? "book" : "edit"} onClick={()=>nav(`/${lang}/reading/${id}${editing ? "" : "/edit"}`)}>{editing ? tr("Read lesson") : tr("Edit reading")}</Btn>
      <Btn icon="trash" onClick={()=>setConfirm(true)}>{tr("Delete reading")}</Btn>
    </div>}
  </nav></SidebarTools>
  <h1>{discovering ? tr("Explore") : authoring ? editing ? tr("Edit reading") : tr("Create reading") : lesson?.title || tr("Reading")}</h1>
  {message && <p role="status">{message}</p>}
  {discovering ? <ReadingDiscover lang={lang} userId={userId} onRequireAccount={onRequireAccount} initialReadingId={initialReadingId}/> : authoring ? <div className="reading-author">
    <input ref={fileInput} type="file" hidden aria-label={tr("Import reading text file")} accept=".txt,text/plain" disabled={busy} onChange={e=>{const file=e.target.files[0];e.target.value="";if(!file)return;act(async()=>{if(file.size>2000000)throw new Error("Use a file smaller than 2 MB.");setText(await file.text());setDraft(null);setPreview(false);});}}/>
    {!preview && <textarea className="reading-source-editor" aria-label={tr("Reading and questions")} spellCheck={false} rows={22} value={text} placeholder={tr("Paste your reading here…")} onChange={e=>{setText(e.target.value);setDraft(null);}}/>}
    {preview && draft?.map((node,i)=><section key={i}><h2>{node.title}</h2><PracticeActivity preview id={`reading-preview-${i}`} userId={userId} lang={lang} data={previewData(node.payload)}/></section>)}
  </div> : id ? lesson && <PracticeActivity key={lesson.revision} data={{...previewData(lesson.payload),progress:lesson.progress}} id={`reading-${id}-${lesson.revision}`} userId={userId} lang={lang} sound={sound} onProgress={completed=>request(base+id+"/","POST",{completed,revision:lesson.revision}).catch(e=>setMessage(e.message))}/> : <>
    <nav aria-label={tr("Reading folders")}>{folderId&&<Btn onClick={()=>setFolderId(folders.find(f=>f.id===folderId)?.parent_id||null)}>{tr("Up")}</Btn>}{folders.filter(f=>(f.parent_id||null)===folderId).map(f=><Btn key={f.id} onClick={()=>setFolderId(f.id)}>{f.title}</Btn>)}</nav>
    <div className="reading-library">{lessons.filter(item=>(item.folder_id||null)===folderId).map(item=><Glass key={item.id}><h2>{item.title}</h2><Link to={`/${lang}/reading/${item.id}`}>{tr("Read & answer →")}</Link></Glass>)}</div>
  </>}
  {sharing && <PracticeModal title={tr("Sharing & categories")} onClose={()=>setSharing(null)} pending={busy}>
    <VisibilitySelect value={sharing.visibility} onChange={v=>setSharing(s=>({...s,visibility:v}))} />
    <p className="text-sm">{tr("Public readings appear in Explore. Other learners can read and practice them.")}</p>
    <Select label={tr("Level")} value={sharing.level} onChange={v=>setSharing(s=>({...s,level:v}))}><option value="">{tr("Level not specified")}</option>{['A1','A2','B1','B2','C1','C2'].map(v=><option key={v} value={v}>{v}</option>)}</Select>
    <Field label={tr("Topic")} value={sharing.topic} maxLength={80} onChange={v=>setSharing(s=>({...s,topic:v}))}/>
    <Btn primary isDisabled={busy} onClick={()=>act(async()=>{setLesson(await request(base+id+'/sharing/','PATCH',sharing));setSharing(null);})}>{tr("Save changes")}</Btn>
    {message && <p role="alert">{message}</p>}
  </PracticeModal>}
  {showGuide && <Modal isOpen onClose={()=>setShowGuide(false)} size="3xl" scrollBehavior="inside" classNames={{base:"glass dialog"}}>
    <ModalContent><ModalHeader>{tr("Formatting & import guide")}</ModalHeader><ModalBody>
      <div className="reading-nav-tools"><Btn icon="copy" onClick={()=>act(copyGuide)}>{tr("Copy AI instructions")}</Btn></div>
      <div className="reading-author"><textarea aria-label={tr("Complete authoring guide")} readOnly rows={18} value={guide} onFocus={e=>e.target.select()}/></div>
    </ModalBody></ModalContent>
  </Modal>}
  {showMedia && <Modal isOpen onClose={()=>setShowMedia(false)} size="3xl" scrollBehavior="inside" isDismissable={!mediaBusy} isKeyboardDismissDisabled={mediaBusy} hideCloseButton={mediaBusy} classNames={{base:"glass dialog"}}>
    <ModalContent><ModalHeader>{tr("Images and attachments")}</ModalHeader><ModalBody>
      <MediaEditor lang={lang} items={media} onChange={setMedia} onBusy={setMediaBusy} disabled={busy}/>
      <div className="reading-author">{media.filter(m=>m.type?.startsWith("image/")).map(m=><label key={m.id}>HTML · {m.name}<input readOnly value={`<img src="${m.url}" alt="Reading illustration" style="width:60%;float:right;margin:12px">`} onFocus={e=>e.target.select()}/></label>)}</div>
    </ModalBody></ModalContent>
  </Modal>}
  {confirm && <Confirm title={tr("Delete reading?")} description={tr("This removes this reading and its questions.")} onClose={()=>setConfirm(false)} onConfirm={async()=>{await request(base+id+"/","DELETE");nav(`/${lang}/reading`);}}/>}
  </Page>;
}
