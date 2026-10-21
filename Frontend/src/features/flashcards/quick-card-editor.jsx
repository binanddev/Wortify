import CardImagePicker from "./card-image-picker.jsx";
import {IMAGE_FIELDS} from "./image-search.js";
import { t as tr, useLocale } from "../../i18n/index.js";
import { Editor } from "../../components/ui/ui.jsx";
import { endpoint, request } from "../../lib/core.js";
import { cardFields } from "./card-fields.js";

export default function QuickCardEditor({ card, lang, deckId, onSaved, onClose, notice }) {
  useLocale();
  const initial = Object.fromEntries([...cardFields,...IMAGE_FIELDS.map(name=>({name}))].map(({ name }) => [name,
    Array.isArray(card[name]) ? card[name].join("\n") : card[name] || ""]));
  return <Editor title={tr("Edit card")} fields={cardFields} initial={initial} onClose={onClose}
    onSave={async (values, signal) => {
      await request(endpoint(lang, `decks/${deckId}/cards/${card.id}/`), "PATCH", values, signal);
      const updated = { ...card, ...values };
      onSaved(updated);
    }}>{(values,set)=><>{notice && <p className="text-sm">{notice}</p>}<CardImagePicker values={values} set={set} lang={lang}/></>}</Editor>;
}
