import { t as tr, useLocale } from "../../i18n/index.js";
import { Icon } from "../../components/ui/ui.jsx";

function WordFeedback({result, label}) {
  return <section className="written-feedback" aria-label={label}>
    <div className="written-feedback-heading">
      <span>{label}</span>
      <strong className={result.correct ? "is-accepted" : "needs-retry"}>
        <Icon name={result.correct ? "check" : "edit"} size={16}/>
        {tr(result.correct ? result.score === 100 ? "Correct" : "Close enough" : "Try again")} · {result.score}%
      </strong>
    </div>
    <p className="written-word-diff">{result.words.map((word, index) => <span key={index} className={`word-diff-${word.kind}`}>
      {word.kind === "correct" ? word.actual : <>
        {word.actual && <del><span className="sr-only">{tr("Your answer")}: </span>{word.actual}</del>}
        {word.expected && <ins><span className="sr-only">{tr(word.kind === "missing" ? "Missing word" : "Expected word")}: </span>{word.expected}</ins>}
      </>}{" "}
    </span>)}</p>
    {result.negationMismatch && <p className="written-feedback-note">{tr("Check the negative wording.")}</p>}
  </section>;
}
export default function WrittenFeedback({assessment}) {
  useLocale();
  if (!assessment) return null;
  return <div className="written-feedback-group" role="status" aria-live="polite">
    {assessment.term ? <>
      <WordFeedback result={assessment.term} label={tr("Term")}/>
      <WordFeedback result={assessment.definition} label={tr("Definition")}/>
    </> : <WordFeedback result={assessment} label={tr("Your answer")}/>}
  </div>;
}
