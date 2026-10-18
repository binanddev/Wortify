import { t as tr, useLocale } from "../../i18n/index.js";
import { useState } from "react";
import { AiAuthoringHelp } from "./ai-authoring-help.jsx";
import { PracticeModal } from "./practice-workspace.jsx";
import { Page, Heading, Link, SidebarTools, Select, Btn, Icon } from "../../components/ui/ui.jsx";
import { EXERCISE_TYPES, exerciseStylesOf } from "./exercise-types.js";
import { textTemplate } from "./practice-text.js";
const panel = "rounded-2xl border border-(--line) bg-(--surface) p-5";
export function PracticeGuide({ lang }) {
  useLocale();
  const [mode, setMode] = useState("cloze_drag_drop");
  const [style, setStyle] = useState("drag_drop");
  const [dialog, setDialog] = useState(null);
  const [notice, setNotice] = useState("");
  const template = textTemplate(mode, style);
  return <Page className="lesson-guide-page">
    <SidebarTools navOnly><div className="guide-actions">
      <Link className="btn guide-icon-link" to={`/${lang}/create`} title={tr("My Exercise Library")} aria-label={tr("My Exercise Library")}><Icon name="home" /></Link>
      <Link className="btn guide-icon-link" to={`/${lang}/create/new`} title={tr("Create exercise")} aria-label={tr("Create exercise")}><Icon name="plus" /></Link>
    </div></SidebarTools>
    <div className="mx-auto grid w-full max-w-5xl gap-6 text-(--ink)">
      <Heading title={tr("Create a lesson")} />
      <AiAuthoringHelp lang={lang} guide />
      <div><Link className="btn guide-draft-link" to={`/${lang}/create/new`}><Icon name="plus" />{tr("New draft")}</Link></div>
      <details><summary className="cursor-pointer font-semibold">{tr("Template library")}</summary><div className="mt-3">
        <section className={panel}>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {EXERCISE_TYPES.map(([key, title, number]) => (
              <button
                type="button"
                key={key}
                className="flex items-center gap-4 rounded-2xl border border-(--line) bg-transparent p-4 text-left transition-transform hover:scale-[1.01] focus-visible:outline-2 focus-visible:outline-(--accent)"
                onClick={() => {
                  setMode(key);
                  setStyle(exerciseStylesOf(key)[0][0]);
                  setDialog("template");
                }}
              >
                <span className="font-bold text-(--accent)">{number}</span>
                <span className="flex-1 font-semibold">{tr(title)}</span>
                <Icon name="arrow" />
              </button>
            ))}
          </div>
        </section>

      </div></details>
    </div>
    {dialog && <PracticeModal title={tr("Exercise template")} onClose={()=>{setDialog(null);setNotice("");}}>
      <Select label={tr("Style")} value={style} onChange={setStyle}>
        {exerciseStylesOf(mode).map(([key,title])=><option key={key} value={key}>{tr(title)}</option>)}
      </Select>
      <Btn icon="copy" onClick={async()=>{try{await navigator.clipboard.writeText(template);setNotice("Copied.");}catch{setNotice("Clipboard access is unavailable. Select the instructions below to copy them.");}}}>{tr("Copy content")}</Btn>
      {notice && <p role="status">{tr(notice)}</p>}
      <textarea aria-label={tr("Exercise template")} readOnly value={template} rows={12} onFocus={e=>e.currentTarget.select()} className="mt-3 w-full rounded-xl border border-(--line) bg-transparent p-3 text-sm" />
    </PracticeModal>}
  </Page>;
}
