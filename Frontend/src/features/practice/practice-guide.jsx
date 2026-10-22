import { t as tr, useLocale } from "../../i18n/index.js";
import { AuthoringGuideText } from "./ai-authoring-help.jsx";
import { Page, Heading } from "../../components/ui/ui.jsx";

export function PracticeGuide({ lang, embedded = false }) {
  useLocale();
  return <Page className="lesson-guide-page">{!embedded && <Heading title={tr("Authoring guide")}/>}<AuthoringGuideText lang={lang}/></Page>;
}
