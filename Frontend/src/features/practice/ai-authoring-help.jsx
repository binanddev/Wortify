import { t as tr, useLocale } from "../../i18n/index.js";
import { useRef, useState } from "react";
import { Btn, Icon } from "../../components/ui/ui.jsx";
import { PracticeModal } from "./practice-workspace.jsx";
import { aiAuthoringGuide } from "./ai-authoring-guide.js";

export function AuthoringGuideText({ lang = "en" }) {
  useLocale();
  const [notice, setNotice] = useState("");
  const text = useRef(null);
  const instructions = aiAuthoringGuide(lang);
  async function copy() {
    try { await navigator.clipboard.writeText(instructions); setNotice("Guide copied."); }
    catch {
      setNotice("Clipboard access is unavailable. Select the instructions below to copy them.");
      text.current?.focus(); text.current?.select();
    }
  }
  return <div className="authoring-guide-document">
    <div className="guide-actions">
      <Btn primary onClick={copy}><Icon name="copy" size={18}/><span>{tr("Copy guide")}</span></Btn>
      <a className="btn guide-download" download={`wortify-authoring-${lang}.txt`} href={`data:text/plain;charset=utf-8,${encodeURIComponent(instructions)}`}><Icon name="download" size={18}/><span>{tr("Download full guide (.txt)")}</span></a>
    </div>
    {notice && <p role="status" className="text-sm">{tr(notice)}</p>}
    <textarea ref={text} aria-label={tr("Complete instructions")} readOnly spellCheck={false} value={instructions} rows={20} className="authoring-guide-text"/>
  </div>;
}

export function AiAuthoringHelp({ lang = "en", guide = false }) {
  useLocale();
  const [open, setOpen] = useState(false);
  if (guide) return <AuthoringGuideText lang={lang}/>;
  return <>
    <div className="authoring-guide-help"><Btn aria-label={tr("Authoring guide")} onClick={()=>setOpen(true)}><Icon name="help" size={18}/><span>{tr("Authoring guide")}</span></Btn></div>
    {open && <PracticeModal title={tr("Authoring guide")} size="4xl" className="authoring-guide-dialog" onClose={()=>setOpen(false)}><AuthoringGuideText lang={lang}/></PracticeModal>}
  </>;
}
