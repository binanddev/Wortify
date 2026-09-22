import { gradeExercise } from "./local-learning";
import { TypeQuestion, MatchPairs, Categories } from "./exercise-interactions";
import { modeOf } from "./exercise-types";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useAction, readPreference, savePreference } from "./core";
import { Btn, Page, Status } from "./ui";
export function PracticeActivity({
  data,
  id,
  userId,
  preview = false,
  practiceOnly = false,
  onComplete,
}) {
  const e = data.exercise,
    questions = data.questions.filter((q) => !q.example),
    mode = modeOf(e),
    key = `wortify:answers:${userId}:${id}:${questions.map((q) => q.id).join("-")}`;
  const [answers, setAnswers] = useState(() =>
      preview ? {} : readPreference(key, {}),
    ),
    [submitted, setSubmitted] = useState({}),
    [result, setResult] = useState(null),
    [missing, setMissing] = useState([]);
  const action = useAction(),
    ref = useRef();
  useEffect(() => {
    if (!preview) savePreference(key, answers);
  }, [key, answers, preview]);
  const update = (k, v) => {
    setAnswers((a) => ({ ...a, [k]: v }));
    setMissing((m) => m.filter((x) => x !== k));
  };
  const keys = (q) =>
    q.blank_count
      ? Array.from({ length: q.blank_count }, (_, i) => `${q.id}_${i}`)
      : [String(q.id)];
  const has = (k) =>
    Array.isArray(answers[k])
      ? answers[k].length > 0
      : Boolean(String(answers[k] ?? "").trim());
  const rowsFor = (q) =>
    (result?.answers || []).filter(
      (r) =>
        r.question_position === q.position &&
        JSON.stringify(answers[r.key]) === JSON.stringify(submitted[r.key]),
    );
  const props = {
    exercise: e,
    questions,
    answers,
    onAnswer: update,
    disabled: action.pending,
    assets: data.assets,
  };
  async function submit(event) {
    event.preventDefault();

    const empty = questions.flatMap(keys).filter((k) => !has(k));
    setMissing(empty);
    if (empty.length) {
      action.setError("Hoàn thành các câu được đánh dấu.");
      ref.current
        ?.querySelector(`[data-question="${empty[0].split("_")[0]}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setResult(gradeExercise(e, questions, answers));
    setSubmitted(structuredClone(answers));
    if (!preview && JSON.stringify(submitted) !== JSON.stringify(answers))
      onComplete?.(structuredClone(answers));
    action.setError("");
  }
  return (
    <Page>
      <div
        className={`exercise-workspace ${preview ? "preview-workspace" : ""}`}
      >
        {e.instruction && (
          <p className="exercise-instruction">{e.instruction}</p>
        )}
        {!preview && (
          <div className="exercise-progress">
            <span>
              {questions.filter((q) => keys(q).every(has)).length}/
              {questions.length} câu
            </span>
            <progress
              value={questions.filter((q) => keys(q).every(has)).length}
              max={questions.length || 1}
            />
          </div>
        )}
        <form
          ref={ref}
          onSubmit={submit}
          noValidate
          className={mode === "true_false_not_given" ? "reading-split" : ""}
        >
          {e.context && (
            <aside className="reading-document">
              <h2>Bài đọc</h2>
              <div>{e.context}</div>
            </aside>
          )}
          <div className="exercise-questions">
            {mode === "matching" ? (
              <section className="work-paper">
                <MatchPairs {...props} />
              </section>
            ) : mode === "categorization" ? (
              <section className="work-paper">
                <Categories {...props} />
              </section>
            ) : (
              questions.map((q) => (
                <section
                  tabIndex={-1}
                  data-question={q.id}
                  className={`work-paper ${keys(q).some((k) => missing.includes(k)) ? "has-error" : ""}`}
                  key={q.id}
                >
                  <div className="question-label">Câu {q.position}</div>
                  {!q.blank_count &&
                    ![
                      "inline_error_identification",
                      "audio_dictation",
                    ].includes(mode) && (
                      <p className="work-prompt">{q.prompt}</p>
                    )}
                  <TypeQuestion {...props} q={q} rows={rowsFor(q)} />
                  {keys(q).some((k) => missing.includes(k)) && (
                    <p className="field-error">Chưa hoàn thành câu này.</p>
                  )}
                  {rowsFor(q).map((r, i) => (
                    <motion.div
                      key={`${result.id}-${i}`}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`work-feedback ${r.correct === true ? "right" : r.correct === false ? "wrong" : ""}`}
                      role="status"
                    >
                      <strong>
                        {r.label ? `${r.label} · ` : ""}
                        {r.correct === true
                          ? "✓ Chính xác"
                          : r.correct === false
                            ? "↻ Chưa chính xác"
                            : practiceOnly
                              ? "Tự đối chiếu với gợi ý"
                              : "Đã lưu"}
                      </strong>
                      {(r.correct === false ||
                        (practiceOnly && r.correct === null)) &&
                        r.expected?.length > 0 && (
                          <p>
                            Đáp án: <b>{r.expected.join(" / ")}</b>
                          </p>
                        )}
                      {r.explanation && <p>{r.explanation}</p>}
                      {r.diff && (
                        <p className="dictation-diff">
                          {r.diff.map((word, j) => (
                            <span className={word.state} key={j}>
                              {word.text}{" "}
                            </span>
                          ))}
                        </p>
                      )}
                    </motion.div>
                  ))}
                </section>
              ))
            )}
            {["matching", "categorization"].includes(mode) && result && (
              <div className="pair-results">
                {result.answers.map((r, i) => (
                  <div
                    key={i}
                    className={`work-feedback ${r.correct ? "right" : "wrong"}`}
                  >
                    <strong>
                      {r.correct ? "✓" : "↻"} {r.prompt}
                    </strong>
                    {!r.correct && <p>{r.expected.join(" / ")}</p>}
                  </div>
                ))}
              </div>
            )}
            {(!preview || practiceOnly) && (
              <>
                <Status error={action.error} />
                <div className="work-submit">
                  <span>
                    {result ? `${result.score}/${result.total} đúng` : ""}
                  </span>
                  <Btn primary type="submit" isLoading={action.pending}>
                    {result ? "Kiểm tra lại" : "Kiểm tra và lưu"}
                  </Btn>
                </div>
              </>
            )}
          </div>
        </form>
      </div>
    </Page>
  );
}
