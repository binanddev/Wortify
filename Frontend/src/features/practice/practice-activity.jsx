import { sharedGapQuestions } from "./gap-bank.js";
import { PracticeRichText } from "./practice-rich-text.jsx";
import { SkipButton, AnswerReveal } from "../learning/skip-controls.jsx";
import { exerciseSolution } from "../learning/skip-learning.js";
import { ExerciseMedia } from "./exercise-media.jsx";
import { useEffect, useRef, useState } from "react";
import { gradeExercise } from "../learning/local-learning.js";
import { TypeQuestion, MatchPairs, Categories } from "./exercise-interactions.jsx";
import { exerciseStylesOf, modeOf } from "./exercise-types.js";
import { readPreference, savePreference } from "../../lib/core.js";
import { Btn, Icon, Status, useSound } from "../../components/ui/ui.jsx";
import {
  mergeProgress,
  readyToCheck,
  activeQuestions,
  needsManualCheck,
  advanceQueue,
  repeatLater,
  isWholeExercise,
} from "./practice-session.js";

export function PracticeActivity({
  data,
  id,
  userId,
  preview = false,
  onProgress,
  onNext,
  sound = false,
  lang,
  uiStyle,
}) {
  const e = data.exercise;
  const mode = modeOf(e);
  const sourceQuestions = data.questions.filter((q) => !q.example);
  const questions = mode === "cloze_drag_drop" && e.presentation?.bank_scope !== "question" ? sharedGapQuestions(sourceQuestions) : sourceQuestions;
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
  const [queue, setQueue] = useState(() =>
    questions
      .filter((q) => !completed.includes(String(q.id)))
      .map((q) => String(q.id)),
  );
  const index = queue.length
    ? questions.findIndex((q) => String(q.id) === queue[0])
    : questions.length;
  const [reviewed, setReviewed] = useState([]);
  const [attempt, setAttempt] = useState(0);
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
  const batch = activeQuestions(mode, questions, index);
  const manual = needsManualCheck(mode, style);
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
  const checkNow = () => {
    if (
      !batch.length ||
      revealed ||
      composing ||
      feedback?.correct ||
      !batch.every((q) => readyToCheck(q, answers))
    )
      return;
    const fingerprint = JSON.stringify([batch.map((q) => q.id), answers]);
    if (checked.current === fingerprint) return;
    checked.current = fingerprint;
    const result = gradeExercise(e, batch, answers);
    const correct = result.answers.every((row) => row.correct);
    setFeedback({ correct, rows: result.answers, fingerprint });
    if (style === "partial_input") {
      setReviewed((previous) => [
        ...new Set([...previous, String(question.id)]),
      ]);
      if (!correct || !reviewed.includes(String(question.id))) {
        setRevealed(true);
        sounds.feedback(correct);
        return;
      }
    }

    if (correct)
      setSkipped((previous) =>
        previous.filter((id) => !batch.some((q) => String(q.id) === id)),
      );
    sounds.feedback(correct);
    if (correct)
      setCompleted((current) =>
        mergeProgress(
          questions,
          current,
          batch.map((q) => String(q.id)),
        ),
      );
  };
  useEffect(() => {
    if (
      mode === "matching" ||
      manual ||
      !question ||
      revealed ||
      composing ||
      feedback?.correct ||
      !batch.every((q) => readyToCheck(q, answers))
    )
      return;
    const timer = setTimeout(checkNow, typed ? 1400 : 250);
    return () => clearTimeout(timer);
  }, [answers, question, composing, feedback?.correct, revealed, manual]);
  const reveal = () => {
    setRevealed(true);
    setFeedback(null);
    setSkipped((previous) => [
      ...new Set([...previous, ...batch.map((q) => String(q.id))]),
    ]);
  };
  const advance = () => {
    const next =
      revealed && ["partial_input", "click_edit"].includes(style)
        ? repeatLater(queue)
        : advanceQueue(queue, revealed, isWholeExercise(mode));
    setAttempt((value) => value + 1);
    setQueue(next);
    setAnswers({});
    setFeedback(null);
    setRevealed(false);
    checked.current = "";
    if (!next.length) {
      sounds.applause();
      onNext?.();
    }
  };
  const update = (key, value) => {
    if (feedback?.correct || revealed) return;
    if (JSON.stringify(answers[key]) === JSON.stringify(value)) return;
    checked.current = "";
    setAnswers((current) => ({ ...current, [key]: value }));
    setFeedback((current) =>
      current
        ? {
            ...current,
            correct: false,
            rows: current.rows.filter((row) => row.key !== String(key)),
          }
        : null,
    );
    if (!typed) sounds.tick();
  };
  const props = {
    exercise: e,
    revealed,
    onPairResult: (correct) => sounds.feedback(correct),
    onPairCorrect: (key, value) => {
      const next = { ...answers, [key]: value };
      setAnswers(next);
      setCompleted((current) => mergeProgress(questions, current, [key]));
      if (questions.every((q) => readyToCheck(q, next)))
        setFeedback({ correct: true, rows: [] });
    },
    questions: batch,
    q: question,
    answers,
    onAnswer: update,
    disabled: Boolean(feedback?.correct || revealed),
    uiStyle: style,
    rows: feedback?.rows || [],
  };
  if (!questions.length) return <Status>This exercise has no questions yet.</Status>;
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
              ? "Set reviewed"
              : "Session complete"
            : mode === "matching"
              ? `Matching · ${questions.length} pairs`
              : mode === "categorization"
                ? `Categorize · ${questions.length} words`
                : `Question ${index + 1} / ${questions.length}`}
        </span>
        {!isWholeExercise(mode) && (
          <progress
            aria-label="Lesson progress"
            value={
              replaying ? Math.min(index, questions.length) : completed.length
            }
            max={questions.length}
          />
        )}
        <button
          type="button"
          className="exercise-sound-toggle"
          aria-label={
            soundEnabled ? "Mute exercise audio" : "Enable exercise audio"
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
              ? "I have reviewed this set"
              : "You did it!"}
          </h2>
          <p>
            {skipped.length
              ? `${skipped.length} questions with revealed answers. Practice again to answer on your own.`
              : "Every completed question is progress. See you in the next exercise."}
          </p>
          <Btn
            onClick={() => {
              setSkipped([]);
              setReviewed([]);
              setRevealed(false);
              setReplaying(true);
              setQueue(questions.map((q) => String(q.id)));
              setAnswers({});
              setFeedback(null);
              checked.current = "";
            }}
          >
            Practice again to reinforce learning
          </Btn>
        </section>
      ) : (
        <>
          {e.instruction &&
            !/^(Hoàn thành từng câu[.!]?|Hoàn thành câu này, mình sẽ tự kiểm tra cho bạn[.!]?)$/i.test(
              e.instruction.trim(),
            ) && (
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
            key={`${question.id}:${attempt}`}
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
            {(revealed || (style === "partial_input" && feedback)) && (
              <AnswerReveal
                answers={batch.flatMap((q) => exerciseSolution(e, q))}
                explanation={question.presentation?.explanation}
              />
            )}
            <div className="exercise-check-actions">
              {revealed || feedback?.correct ? (
                <button
                  type="button"
                  className="btn primary exercise-next"
                  aria-label="Continue"
                  title="Continue"
                  onClick={advance}
                >
                  <Icon name="arrow" />
                </button>
              ) : mode === "matching" ? null : manual ? (
                <>
                  {feedback && !feedback.correct && (
                    <Btn onClick={reveal}>Show answer</Btn>
                  )}
                  <Btn
                    primary
                    className="btn primary check-action"
                    isDisabled={
                      composing || !batch.every((q) => readyToCheck(q, answers))
                    }
                    onClick={checkNow}
                  >
                    Check
                  </Btn>
                </>
              ) : style === "click_edit" ? (
                <Btn onClick={reveal}>Show answer</Btn>
              ) : (
                <SkipButton
                  disabled={feedback?.correct || composing}
                  onClick={reveal}
                />
              )}
            </div>
            <div
              className={`journey-feedback ${feedback ? (feedback.correct ? "right" : "wrong") : ""}`}
              aria-live="polite"
              aria-atomic="true"
            >
              {revealed
                ? ""
                : feedback
                  ? feedback.correct
                    ? "Correct!"
                    : "Not quite. Try again."
                  : ""}
              {!revealed &&
                style !== "partial_input" &&
                feedback?.correct &&
                question.presentation?.explanation && (
                  <p>
                    <PracticeRichText>
                      {question.presentation.explanation}
                    </PracticeRichText>
                  </p>
                )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
