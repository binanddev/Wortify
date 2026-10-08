import { PracticeRichText } from "../practice/practice-rich-text.jsx";
import { Btn } from "../../components/ui/ui.jsx";
export function SkipButton({ onClick, disabled = false }) {
  return (
    <Btn
      primary
      className="btn primary check-action"
      aria-label="Check and show answer"
      onClick={onClick}
      isDisabled={disabled}
    >
      Check
    </Btn>
  );
}
export function AnswerReveal({ answers, explanation }) {
  return (
    <aside
      className="my-4 grid gap-2 rounded-2xl border border-(--accent) p-4"
      role="status"
      aria-live="polite"
    >
      <strong>Answer</strong>
      {answers.map((answer, i) => (
        <p key={i} className="whitespace-pre-wrap wrap-anywhere">
          {answer}
        </p>
      ))}
      {explanation &&
        !answers.some((answer) => answer.trim() === explanation.trim()) && (
          <p className="text-sm text-(--muted)">
            <PracticeRichText>{explanation}</PracticeRichText>
          </p>
        )}
    </aside>
  );
}
