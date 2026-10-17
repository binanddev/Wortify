import { useState } from "react";
import { Btn, Field, Icon } from "../../components/ui/ui.jsx";
import { aiAuthoringGuide } from "./ai-authoring-guide.js";

export function AiAuthoringHelp({ lang = "en", guide = false }) {
  const [brief, setBrief] = useState("");
  const [notice, setNotice] = useState("");
  const [manual, setManual] = useState(false);
  const instructions = aiAuthoringGuide(lang, brief);
  async function copy() {
    try {
      await navigator.clipboard.writeText(instructions);
      setNotice("Guide copied.");
      setManual(false);
    } catch {
      setManual(true);
      setNotice("Clipboard access is unavailable. Select the instructions below or download the file.");
    }
  }
  return (
    <section className="authoring-guide-help grid gap-3 rounded-2xl border border-(--line) bg-(--surface) p-5" aria-label="Lesson guide">
      <h2 className="text-xl font-semibold">Lesson guide</h2>
      <p>Copy the guide, request a lesson in your chat, then paste the result into a new draft.</p>
      <details>
        <summary className="cursor-pointer font-semibold">Lesson request (optional)</summary>
        <Field label="Topic, level and exercise preferences" multiline rows={3} value={brief}
          onChange={(value) => { setBrief(value); setNotice(""); }}
          placeholder="For example: B1 travel vocabulary, 10 gap-fill questions, a shared word bank and explanations in English." />
      </details>
      <div className="guide-actions">
        <Btn primary icon="copy" onClick={copy}>Copy guide</Btn>
        <a className="btn guide-icon-link" title="Download guide" aria-label="Download guide" download="wortify-guide.txt" href={"data:text/plain;charset=utf-8," + encodeURIComponent(instructions)}><Icon name="download" /></a>
        {!guide && <a href={"/" + lang + "/create/guide"} target="_blank" rel="noopener noreferrer">Guide ↗</a>}
      </div>
      {notice && <p role="status">{notice}</p>}
      <details open={manual || undefined} onToggle={(event) => { if (!event.currentTarget.open) setManual(false); }}>
        <summary className="cursor-pointer">View instructions</summary>
        <textarea aria-label="Complete instructions" readOnly value={instructions} rows={12}
          className="mt-3 w-full rounded-xl border border-(--line) bg-transparent p-3 text-sm"
          onFocus={(event) => event.currentTarget.select()} />
      </details>
    </section>
  );
}
