import { useState } from "react";
import { Select } from "../../components/ui/ui.jsx";
import { t as tr, useLocale } from "../../i18n/index.js";
export default function ImportSections({ component: Component }) {
  useLocale();
  const [section, setSection] = useState("practice");
  return (
    <div className="space-y-5">
      <Select label={tr("Content")} value={section} onChange={setSection}>
        <option value="flashcards">{tr("Flashcard")}</option>
        <option value="practice">{tr("Practice Hub")}</option>
        <option value="reading">{tr("Reading")}</option>
      </Select>
      <Component key={section} section={section} />
    </div>
  );
}
