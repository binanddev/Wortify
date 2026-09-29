import { PracticeRichText } from "./practice-rich-text";
import { SkipButton, AnswerReveal } from "./skip-controls";
import { exerciseSolution } from "./skip-learning";
import { ExerciseMedia } from "./exercise-media";
import { useEffect, useRef, useState } from "react";
import { gradeExercise } from "./local-learning";
import { TypeQuestion, MatchPairs, Categories } from "./exercise-interactions";
import { exerciseStylesOf, modeOf } from "./exercise-types";
import { readPreference, savePreference } from "./core";
import { Btn, Icon, Status, useSound } from "./ui";
import { mergeProgress, readyToCheck } from "./practice-session";

export function PracticeActivity({
  data,
  id,
  userId,
  preview = false,
  onProgress,
  sound = false,
  lang,
  uiStyle,
}) {
  const e = data.exercise;
  const questions = data.questions.filter((q) => !q.example);
  const mode = modeOf(e);
  const style =
    uiStyle || e.presentation?.style || exerciseStylesOf(mode)[0][0];
  const storageKey = `wortify:practice-progress:${userId}:${lang}:${id}`;
  const [completed, setCompleted] = useState(() =>
    mergeProgress(
      questions,
      data.progress?.completed,
      preview ? [] : readPreference(storageKey, []),
    ),
  );
  const [index, setIndex] = useState(() => {
    const done = mergeProgress(
      questions,
      data.progress?.completed,
      preview ? [] : readPreference(storageKey, []),
    );
    const next = questions.findIndex((q) => !done.includes(String(q.id)));
    return next < 0 ? questions.length : next;
  });
  const [revealed, setRevealed] = useState(false);
  const [skipped, setSkipped] = useState([]);
  const [answers, setAnswers] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [composing, setComposing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(sound);
  const [replaying, setReplaying] = useState(false);
  const checked = useRef("");
  const sentProgress = useRef(
    JSON.stringify(mergeProgress(questions, data.progress?.completed).sort()),
  );
  const paper = useRef(null);
  const callback = useRef(onProgress);
  callback.current = onProgress;
  const sounds = useSound(soundEnabled, lang);
  const question = questions[index];
  const typed = ["short_answer", "error_correction"].includes(mode);
  useEffect(() => setSoundEnabled(sound), [sound]);
  useEffect(() => {
    if (index > 0 && index < questions.length)
      paper.current?.focus({ preventScroll: true });
  }, [index]);
  useEffect(() => {
    if (!preview) savePreference(storageKey, completed);
  }, [storageKey, completed, preview]);
  useEffect(() => {
    const signature = JSON.stringify([...completed].sort());
    if (!preview && completed.length && signature !== sentProgress.current) {
      sentProgress.current = signature;
      callback.current?.(completed);
    }
  }, [completed, preview]);
  useEffect(() => {
    if (
      !question ||
      revealed ||
      composing ||
      feedback?.correct ||
      !readyToCheck(question, answers)
    )
      return;
    const fingerprint = JSON.stringify([question.id, answers]);
    if (checked.current === fingerprint) return;
    const timer = setTimeout(
      () => {
        checked.current = fingerprint;
        const result = gradeExercise(e, [question], answers);
        const correct = result.answers.every((row) => row.correct);
        setFeedback({ correct, rows: result.answers, fingerprint });
        sounds.feedback(correct);
        if (correct)
          setCompleted((current) =>
            mergeProgress(questions, current, [String(question.id)]),
          );
      },
      typed ? 1400 : 250,
    );
    return () => clearTimeout(timer);
  }, [answers, question, composing, feedback?.correct, revealed]);
  const advance = () => {
    const next = replaying
      ? index + 1
      : questions.findIndex(
          (q, i) => i > index && !completed.includes(String(q.id)),
        );
    setIndex(next < 0 ? questions.length : next);
    setAnswers({});
    setFeedback(null);
    setRevealed(false);
    checked.current = "";
    if (next < 0 && !skipped.length && !revealed) sounds.applause();
  };
  useEffect(() => {
    if (!feedback?.correct || revealed) return;
    const timer = setTimeout(advance, 1000);
    return () => clearTimeout(timer);
  }, [feedback?.correct, index, revealed]);
  const update = (key, value) => {
    if (feedback?.correct || revealed) return;
    if (JSON.stringify(answers[key]) === JSON.stringify(value)) return;
    setAnswers((current) => ({ ...current, [key]: value }));
    setFeedback(null);
    if (!typed) sounds.tick();
  };
  const props = {
    exercise: e,
    questions: question ? [question] : [],
    q: question,
    answers,
    onAnswer: update,
    disabled: Boolean(feedback?.correct || revealed),
    uiStyle: style,
    rows: feedback?.rows || [],
  };
  if (!questions.length) return <Status>Chưa có câu hỏi trong bài này.</Status>;
  return (
    <div
      className="exercise-workspace practice-journey learning-stage"
      data-ui-style={style}
    >
      <ExerciseMedia
        items={(e.attachments || []).filter((item) => !item.question)}
      />
      {question && (
        <ExerciseMedia
          key={question.id}
          items={(e.attachments || []).filter(
            (item) => String(item.question) === String(question.id),
          )}
        />
      )}
      <div className="journey-topline">
        <span>
          {index >= questions.length
            ? skipped.length
              ? "Đã xem hết lượt"
              : "Chặng học hoàn tất"
            : `Câu ${index + 1} / ${questions.length}`}
        </span>
        <progress
          aria-label="Tiến độ bài học"
          value={
            replaying ? Math.min(index, questions.length) : completed.length
          }
          max={questions.length}
        />
        <button
          type="button"
          className="exercise-sound-toggle"
          aria-label={
            soundEnabled ? "Tắt âm thanh bài tập" : "Bật âm thanh bài tập"
          }
          aria-pressed={soundEnabled}
          onClick={() => setSoundEnabled((v) => !v)}
        >
          <Icon name="sound" size={18} />
        </button>
      </div>
      {index >= questions.length ? (
        <section className="journey-finish" role="status">
          <span className="finish-mascot" aria-hidden="true">
            🌷
          </span>
          <h2>
            {skipped.length
              ? "Mình đã xem hết lượt này"
              : "Bạn đã làm được rồi!"}
          </h2>
          <p>
            {skipped.length
              ? `${skipped.length} câu đã xem đáp án. Bạn có thể luyện lại để tự trả lời nhé.`
              : "Mỗi câu đã hoàn thành là một bước tiến nhỏ. Hẹn bạn ở bài tiếp theo nhé."}
          </p>
          <Btn
            onClick={() => {
              setSkipped([]);
              setRevealed(false);
              setReplaying(true);
              setIndex(0);
              setAnswers({});
              setFeedback(null);
              checked.current = "";
            }}
          >
            Luyện lại cho vững
          </Btn>
        </section>
      ) : (
        <>
          {e.instruction && (
            <p className="exercise-instruction">
              <PracticeRichText>{e.instruction}</PracticeRichText>
            </p>
          )}
          {e.context && (
            <aside className="reading-document">
              <PracticeRichText>{e.context}</PracticeRichText>
            </aside>
          )}
          <section
            ref={paper}
            tabIndex={-1}
            key={question.id}
            className={`work-paper journey-question ${feedback ? (feedback.correct ? "is-correct" : "is-incorrect") : ""}`}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
          >
            {!question.blanks?.length &&
              !["error_correction", "matching", "categorization"].includes(
                mode,
              ) && (
                <p className="work-prompt">
                  <PracticeRichText>{question.prompt}</PracticeRichText>
                </p>
              )}
            {mode === "matching" ? (
              <MatchPairs {...props} />
            ) : mode === "categorization" ? (
              <Categories {...props} />
            ) : (
              <TypeQuestion {...props} />
            )}
            {revealed && (
              <AnswerReveal
                answers={exerciseSolution(e, question)}
                explanation={question.presentation?.explanation}
              />
            )}
            <div className="flex justify-center gap-3 my-3">
              {revealed ? (
                <Btn icon="arrow" primary onClick={advance}>
                  Tiếp tục
                </Btn>
              ) : (
                <SkipButton
                  disabled={feedback?.correct}
                  onClick={() => {
                    setRevealed(true);
                    setFeedback(null);
                    setSkipped((previous) => [
                      ...new Set([...previous, String(question.id)]),
                    ]);
                  }}
                />
              )}
            </div>
            <div
              className={`journey-feedback ${feedback ? (feedback.correct ? "right" : "wrong") : ""}`}
              aria-live="polite"
              aria-atomic="true"
            >
              {revealed
                ? "Đã xem đáp án. Nhấn tiếp tục khi bạn sẵn sàng."
                : feedback
                  ? feedback.correct
                    ? "✨ Đúng rồi! Mình sang câu tiếp nhé."
                    : "🌱 Gần tới rồi! Sửa một chút và thử lại nhé."
                  : typed
                    ? "Viết xong, dừng một chút để tự kiểm tra."
                    : "Hoàn thành câu này, mình sẽ tự kiểm tra cho bạn."}
              {feedback?.correct && question.presentation?.explanation && (
                <p>
                  <PracticeRichText>
                    {question.presentation.explanation}
                  </PracticeRichText>
                </p>
              )}
            </div>
          </section>
          {!preview && (
            <small className="journey-save-note">
              Tiến độ được giữ tự động. Bạn có thể quay lại bất cứ lúc nào.
            </small>
          )}
        </>
      )}
    </div>
  );
}
