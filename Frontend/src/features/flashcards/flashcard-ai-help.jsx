import { t as tr, useLocale } from "../../i18n/index.js";
import { useState } from "react";
import { Btn } from "../../components/ui/ui.jsx";
import { flashcardAiGuide } from "./flashcard-ai-guide.js";
export function FlashcardAiHelp({lang}) {
  useLocale();
  const [notice, setNotice] = useState("");
  return <div className="flex items-center gap-2">
    <Btn icon="copy" onClick={async () => {
      try {
        await navigator.clipboard.writeText(flashcardAiGuide(lang));
        setNotice("Copied.");
      } catch {
        setNotice("Could not copy. Please try again.");
      }
    }}>{tr("Copy guide")}</Btn>
    {notice && <span role="status" className="text-sm">{tr(notice)}</span>}
  </div>;
}
