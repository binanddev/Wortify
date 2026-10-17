import { ReadingPassage } from "../practice/reading-layout.jsx";
import { ModalContent, ModalHeader, ModalBody } from "@heroui/react";
import { Modal } from "../../components/modal/modal.jsx";
import { useEffect, useRef, useState } from "react";
import { request, useNavigate } from "../../lib/core.js";
import { Page, SidebarTools, Btn, Icon, Link, Glass, Confirm } from "../../components/ui/ui.jsx";
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

export default function ReadingWorkspace({ lang, route, userId, sound }) {
  const nav = useNavigate(), parts = route.split("?")[0].split("/").filter(Boolean);
  const creating = parts[2] === "create", id = creating ? null : parts[2], editing = parts[3] === "edit", authoring = creating || editing;
  const passageOnly = parts[3] === "passage";
  const fileInput = useRef(null);
  const [showMedia,setShowMedia] = useState(false);
  const base = `/api/${lang}/reading/`;
  const [lessons,setLessons] = useState([]), [lesson,setLesson] = useState(null), [text,setText] = useState("");
  const [draft,setDraft] = useState(null), [preview,setPreview] = useState(false), [media,setMedia] = useState([]), [mediaBusy,setMediaBusy] = useState(false);
  const [busy,setBusy] = useState(false), [message,setMessage] = useState(""), [confirm,setConfirm] = useState(false), [showGuide,setShowGuide] = useState(false);
  async function act(fn) { setBusy(true); setMessage(""); try { await fn(); } catch(e) { setMessage(e.message); } finally { setBusy(false); } }
  useEffect(() => {
    const c = new AbortController();
    if (creating) return () => c.abort();
    request(base + (id ? `${id}/` : ""),"GET",undefined,c.signal).then(d => {
      if (id) { setLesson(d); if (editing) { setText(exerciseToText(d.payload)); setMedia(d.payload.attachments || []); } }
      else setLessons(d.lessons);
    }).catch(e => { if(e.name !== "AbortError") setMessage(e.message); });
    return () => c.abort();
  }, [base,id,creating,editing]);
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
  if (passageOnly) return <Page><h1>{lesson?.title || "Reading"}</h1>{message && <p role="status">{message}</p>}{lesson && <ReadingPassage exercise={lesson.payload}/>}</Page> ;
  return <Page><SidebarTools navOnly><nav className="reading-navigation" aria-label="Reading tools">
    <div className="reading-nav-links">
      <Link to={`/${lang}/reading`} aria-current={!id && !creating ? "page" : undefined}><Icon name="book"/> My readings</Link>
      <Link to={`/${lang}/reading/create`} aria-current={creating ? "page" : undefined}><Icon name="plus"/> Create reading</Link>
    </div>
    {authoring && <>
      <div className="reading-nav-tools" role="group" aria-label="Import and authoring tools">
        <Btn icon="copy" isDisabled={busy} onClick={()=>act(copyGuide)}>Copy AI instructions</Btn>
        <Btn icon="book" onClick={()=>setShowGuide(true)}>Formatting & import guide</Btn>
        <Btn icon="upload" isDisabled={busy} onClick={()=>fileInput.current?.click()}>Import text file</Btn>
        <Btn icon="exercise" isDisabled={busy || !!text.trim()} onClick={insertSample}>Insert sample</Btn>
        <Btn icon="image" onClick={()=>setShowMedia(true)}>Images and attachments</Btn>
      </div>
      <div className="reading-nav-tools" role="group" aria-label="Editor actions">
        <Btn icon="edit" aria-pressed={!preview} onClick={()=>setPreview(false)}>Edit source</Btn>
        <Btn icon="eye" aria-pressed={preview} isDisabled={busy || mediaBusy || !text.trim()} onClick={()=>act(async()=>{validate();setPreview(true);})}>Preview reading</Btn>
        <Btn primary icon="save" isDisabled={busy || mediaBusy || !text.trim()} onClick={()=>act(save)}>Save reading</Btn>
      </div>
    </>}
    {id && lesson && <div className="reading-nav-tools">
      <a className="btn" href={`/${lang}/reading/${id}/passage`} target="_blank" rel="noopener noreferrer" title="Open passage in new tab" aria-label="Open passage in new tab"><Icon name="book"/></a>
      <Btn icon={editing ? "book" : "edit"} onClick={()=>nav(`/${lang}/reading/${id}${editing ? "" : "/edit"}`)}>{editing ? "Read lesson" : "Edit reading"}</Btn>
      <Btn icon="trash" onClick={()=>setConfirm(true)}>Delete reading</Btn>
    </div>}
  </nav></SidebarTools>
  <h1>{authoring ? editing ? "Edit reading" : "Create reading" : lesson?.title || "Reading"}</h1>
  {message && <p role="status">{message}</p>}
  {authoring ? <div className="reading-author">
    <input ref={fileInput} type="file" hidden aria-label="Import reading text file" accept=".txt,text/plain" disabled={busy} onChange={e=>{const file=e.target.files[0];e.target.value="";if(!file)return;act(async()=>{if(file.size>2000000)throw new Error("Use a file smaller than 2 MB.");setText(await file.text());setDraft(null);setPreview(false);});}}/>
    {!preview && <textarea className="reading-source-editor" aria-label="Reading and questions" spellCheck={false} rows={22} value={text} placeholder="Paste your reading here…" onChange={e=>{setText(e.target.value);setDraft(null);}}/>}
    {preview && draft?.map((node,i)=><section key={i}><h2>{node.title}</h2><PracticeActivity preview id={`reading-preview-${i}`} userId={userId} lang={lang} data={previewData(node.payload)}/></section>)}
  </div> : id ? lesson && <PracticeActivity key={lesson.revision} data={{...previewData(lesson.payload),progress:lesson.progress}} id={`reading-${id}-${lesson.revision}`} userId={userId} lang={lang} sound={sound} onProgress={completed=>request(base+id+"/","POST",{completed,revision:lesson.revision}).catch(e=>setMessage(e.message))}/> : <>
    <p>Your passages and their questions, together in one place.</p><Link className="btn primary" to={`/${lang}/reading/create`}>{lessons.length ? "Create / import reading" : "Create your first reading"}</Link>
    <div className="reading-library">{lessons.map(item=><Glass key={item.id}><h2>{item.title}</h2><Link to={`/${lang}/reading/${item.id}`}>Read & answer →</Link></Glass>)}</div>
  </>}
  {showGuide && <Modal isOpen onClose={()=>setShowGuide(false)} size="3xl" scrollBehavior="inside" classNames={{base:"glass dialog"}}>
    <ModalContent><ModalHeader>Formatting & import guide</ModalHeader><ModalBody>
      <div className="reading-nav-tools"><Btn icon="copy" onClick={()=>act(copyGuide)}>Copy AI instructions</Btn></div>
      <div className="reading-author"><textarea aria-label="Complete authoring guide" readOnly rows={18} value={guide} onFocus={e=>e.target.select()}/></div>
    </ModalBody></ModalContent>
  </Modal>}
  {showMedia && <Modal isOpen onClose={()=>setShowMedia(false)} size="3xl" scrollBehavior="inside" isDismissable={!mediaBusy} isKeyboardDismissDisabled={mediaBusy} hideCloseButton={mediaBusy} classNames={{base:"glass dialog"}}>
    <ModalContent><ModalHeader>Images and attachments</ModalHeader><ModalBody>
      <MediaEditor lang={lang} items={media} onChange={setMedia} onBusy={setMediaBusy} disabled={busy}/>
      <div className="reading-author">{media.filter(m=>m.type?.startsWith("image/")).map(m=><label key={m.id}>HTML · {m.name}<input readOnly value={`<img src="${m.url}" alt="Reading illustration" style="width:60%;float:right;margin:12px">`} onFocus={e=>e.target.select()}/></label>)}</div>
    </ModalBody></ModalContent>
  </Modal>}
  {confirm && <Confirm title="Delete reading?" description="This removes this reading and its questions." onClose={()=>setConfirm(false)} onConfirm={async()=>{await request(base+id+"/","DELETE");nav(`/${lang}/reading`);}}/>}
  </Page>;
}
