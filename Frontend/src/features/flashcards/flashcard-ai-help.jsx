import { useState } from "react";
import { Btn } from "../../components/ui/ui.jsx";
import { flashcardAiGuide } from "./flashcard-ai-guide.js";
export function FlashcardAiHelp({lang, separator}) {
  const [notice,setNotice]=useState(""),[manual,setManual]=useState(false);
  const guide=flashcardAiGuide(lang,separator);
  return <section className="grid gap-3 rounded-xl border border-(--line) p-4">
    <h3>Create flashcards with AI</h3>
    <p>Copy the guide into your AI chat and request your topic. Paste its response below. The guide includes sentences, translations and phrases for every study mode.</p>
    <div className="flex flex-wrap gap-2">
      <Btn primary onClick={async()=>{try{await navigator.clipboard.writeText(guide);setNotice("Copied. Paste into your AI chat, then describe your topic.");}catch{setManual(true);setNotice("Select the guide below to copy it, or download the file.");}}}>Copy all instructions for AI</Btn>
      <a className="btn" download="wortify-flashcard-guide.txt" href={"data:text/plain;charset=utf-8,"+encodeURIComponent(guide)}>Download guide</a>
    </div>
    {notice&&<p role="status">{notice}</p>}
    <details open={manual||undefined}>
      <summary>Full format, fields and examples</summary>
      <textarea className="w-full bg-transparent p-3 text-sm" aria-label="Flashcard AI instructions" readOnly rows={12} value={guide} onFocus={e=>e.target.select()}/>
    </details>
  </section>;
}
