import { PracticeRichText } from "./practice-rich-text";
import { Btn } from "./ui";
export function SkipButton({ onClick, disabled = false }) {
  return (
    <Btn
      primary
      className="btn primary check-action"
      aria-label="Kiểm tra và xem đáp án"
      onClick={onClick}
      isDisabled={disabled}
    >
      Kiểm tra
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
      <strong>Đáp án</strong>
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
