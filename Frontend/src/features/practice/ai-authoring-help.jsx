import { t as tr, useLocale } from "../../i18n/index.js";
import { useState } from "react";
import { Btn } from "../../components/ui/ui.jsx";
import { aiAuthoringGuide } from "./ai-authoring-guide.js";

export function AiAuthoringHelp({ lang = "en", guide = false }) {
  useLocale();
  const [notice, setNotice] = useState("");
  const [manual, setManual] = useState(false);
  const instructions = aiAuthoringGuide(lang);
  async function copy() {
    try {
      await navigator.clipboard.writeText(instructions);
      setNotice("Guide copied.");
      setManual(false);
    } catch {
      setManual(true);
      setNotice("Clipboard access is unavailable. Select the instructions below to copy them.");
    }
  }
  return (
    <section className="authoring-guide-help grid gap-3 rounded-2xl border border-(--line) bg-(--surface) p-5" aria-label={tr("Lesson guide")}>
      <h2 className="text-xl font-semibold">{tr("Lesson guide")}</h2>
      <div className="guide-actions">
        <Btn primary icon="copy" onClick={copy}>{tr("Copy guide")}</Btn>
        {!guide && <a href={"/" + lang + "/create/guide"} target="_blank" rel="noopener noreferrer">{tr("Guide ↗")}</a>}
      </div>
      {notice && <p role="status">{tr(notice)}</p>}
      <details open={manual || undefined} onToggle={(event) => { if (!event.currentTarget.open) setManual(false); }}>
        <summary className="cursor-pointer">{tr("View instructions")}</summary>
        <textarea aria-label={tr("Complete instructions")} readOnly value={instructions} rows={12}
          className="mt-3 w-full rounded-xl border border-(--line) bg-transparent p-3 text-sm"
          onFocus={(event) => event.currentTarget.select()} />
      </details>
    </section>
  );
}
