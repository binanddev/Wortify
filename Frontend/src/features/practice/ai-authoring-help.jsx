import { useState } from "react";
import { Btn, Field } from "../../components/ui/ui.jsx";
import { aiAuthoringGuide } from "./ai-authoring-guide.js";

export function AiAuthoringHelp({ lang = "en", guide = false }) {
  const [brief, setBrief] = useState("");
  const [notice, setNotice] = useState("");
  const [manual, setManual] = useState(false);
  const instructions = aiAuthoringGuide(lang, brief);
  async function copy() {
    try {
      await navigator.clipboard.writeText(instructions);
      setNotice("Copied all instructions and templates. Paste them into your AI chat.");
      setManual(false);
    } catch {
      setManual(true);
      setNotice("Clipboard access is unavailable. Select the instructions below or download the file.");
    }
  }
  return (
    <section className="grid gap-3 rounded-2xl border border-(--line) bg-(--surface) p-5" aria-label="Create with AI">
      <h2 className="text-xl font-semibold">Create with your AI assistant</h2>
      <p>Copy the complete guide into your AI chat, ask for a lesson, then paste the result into Text draft.</p>
      <details>
        <summary className="cursor-pointer font-semibold">Add your lesson request (optional)</summary>
        <Field label="Topic, level and exercise preferences" multiline rows={3} value={brief}
          onChange={(value) => { setBrief(value); setNotice(""); }}
          placeholder="For example: B1 travel vocabulary, 10 gap-fill questions, a shared word bank and explanations in English." />
      </details>
      <div className="flex flex-wrap items-center gap-3">
        <Btn primary onClick={copy}>Copy all instructions for AI</Btn>
        <a className="btn" download="wortify-ai-instructions.txt" href={"data:text/plain;charset=utf-8," + encodeURIComponent(instructions)}>Download .txt</a>
        {!guide && <a href={"/" + lang + "/create/guide"} target="_blank" rel="noopener noreferrer">Detailed guide ↗</a>}
      </div>
      <p className="text-sm">Includes every exercise type, templates, answer rules, explanations, tables and images. Use any AI chat you prefer.</p>
      {notice && <p role="status">{notice}</p>}
      <details open={manual || undefined} onToggle={(event) => { if (!event.currentTarget.open) setManual(false); }}>
        <summary className="cursor-pointer">Read or select the complete AI instructions</summary>
        <textarea aria-label="Complete AI instructions" readOnly value={instructions} rows={12}
          className="mt-3 w-full rounded-xl border border-(--line) bg-transparent p-3 text-sm"
          onFocus={(event) => event.currentTarget.select()} />
      </details>
    </section>
  );
}
