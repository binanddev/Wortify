import { useWindowActive } from "../../lib/core.js";
import { SkipButton } from "../learning/skip-controls.jsx";
import { SKIPPED_ANSWER } from "../learning/skip-learning.js";
import { useAnswerClock } from "../learning/use-answer-clock.js";
import { useLearningSync } from "../learning/learning-sync.js";
import { gradeCard } from "../learning/local-learning.js";
import { useEffect, useRef, useState } from "react";
import {
  endpoint,
  request,
  useResource,
  useAction,
  useNavigate,
  readPreference,
  savePreference,
  shuffled,
} from "../../lib/core.js";
import {
  Btn,
  Icon,
  Glass,
  Page,
  Heading,
  Status,
  Loading,
  Field,
  Link,
  FlipCard,
  Choice,
  WordOrder,
  Matching,
  Feedback,
  useSound,
} from "../../components/ui/ui.jsx";
export function Session({ lang, token, sound }) {
  const resource = useResource(endpoint(lang, `sessions/${token}/`));
  return (
    <Loading resource={resource}>
      {(data) => <SessionContent initial={data} {...{ lang, token, sound }} />}
    </Loading>
  );
}
function SessionContent({ initial, lang, token, sound }) {
 const windowActive = useWindowActive();
  const navigate = useNavigate();
  const draftKey = `wortify:session:${token}`;
  const restored = readPreference(draftKey, {});
  const [session, setSession] = useState(() => {
      if (initial.result) return initial;
      const values = { ...initial.saved_answers, ...restored };
      const completed = initial.questions.filter(
        (q) => values[q.token] !== undefined,
      ).length;
      return {
        ...initial,
        completed,
        question: initial.questions.find((q) => values[q.token] === undefined),
        result:
          completed === initial.total
            ? summarizeLocal(initial.questions, values)
            : null,
      };
    }),
    [feedback, setFeedback] = useState(null),
    [next, setNext] = useState(null),
    [answer, setAnswer] = useState(""),
    [answers, setAnswers] = useState(() => ({
      ...initial.saved_answers,
      ...restored,
    })),
    [synced, setSynced] = useState(Boolean(initial.result)),
    [flipped, setFlipped] = useState(false);
  const action = useAction(),
    audio = useSound(sound, lang);
  const q = session.question;
  const clock = useAnswerClock(q?.token, !feedback);
  const timers = useRef({});
  const timings = useRef(readPreference(`${draftKey}:timings`, {}));
  useEffect(() => {
    if (!synced) savePreference(draftKey, answers);
  }, [answers, synced, draftKey]);
  const sync = async (signal) => {
    await request(
      endpoint(lang, `sessions/${token}/finish/`),
      "POST",
      { answers, timings: timings.current },
      signal,
    );
    setSynced(true);
    savePreference(draftKey, {});
    savePreference(`${draftKey}:timings`, {});
  };
  useEffect(() => {
    if (!session.result || synced) return;
    let active = true;
    let busy = false;
    const save = async () => {
      if (busy) return;
      busy = true;
      try {
        await sync();
      } catch (e) {
        if (active) action.setError(e.message);
      } finally {
        busy = false;
      }
    };
    save();
    const timer = setInterval(save, 15000);
    window.addEventListener("online", save);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("online", save);
    };
  }, [session.result, synced]);
  const send = (value) => {
    if (!q || feedback) return;
    timings.current[q.token] = clock.read();
    savePreference(`${draftKey}:timings`, timings.current);
    const values = { ...answers, [q.token]: value };
    setAnswers(values);
    const row = gradeCard(q, value);
    const completed = session.completed + 1;
    setFeedback(row);
    setNext({
      ...session,
      completed,
      question: session.questions[completed],
      result:
        completed === session.total
          ? summarizeLocal(session.questions, values)
          : null,
    });
    audio.feedback(row.is_correct);
  };
  const continueSession = () => {
    setSession(next);
    setNext(null);
    setFeedback(null);
    setAnswer("");
    setFlipped(false);
  };
  useEffect(() => {
    const key = (e) => {
      if (!windowActive) return;
      if (
        e.target.closest("input,textarea,select") ||
        session.kind !== "flash" ||
        session.result
      )
        return;
      if (e.code === "Space" && e.target.closest("button")) return;
      if (e.code === "Space") {
        e.preventDefault();
        setFlipped((v) => !v);
      }
      if (e.key === "ArrowRight" && feedback) continueSession();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [windowActive, session, feedback, next]);
  const title = {
    flash: "Flashcards",
    learn: "Study",
    test: "Check",
  }[session.kind];
  return (
    <Page>
      {session.deck && (
        <Link
          className="breadcrumb"
          to={`/${lang}/flashcard/deck/${session.deck}`}
        >
          ← Back to deck
        </Link>
      )}
      <Heading
        eyebrow={
          session.kind === "flash"
            ? "FLASHCARDS"
            : session.kind === "learn"
              ? "LEARN"
              : "TEST"
        }
        title={title}
        description={
          session.kind === "test"
            ? "Complete all questions, then submit. Answers stay hidden until then."
            : "Take your time. Try recalling the answer before revealing it."
        }
      />
      <div className="session-width">
        <div className="section-heading">
          <span>Session progress</span>
          <strong>
            {session.completed} / {session.total}
          </strong>
        </div>
        <progress value={session.completed} max={session.total} />
        {session.result && !(session.kind === "test" && session.questions) ? (
          <>
            <Glass className="result-summary">
              <Icon name="check" size={36} />
              <h2>Study session complete</h2>
              <div className="result-number">
                {session.result.correct}
                <span> / {session.result.total}</span>
              </div>
              <p>questions mastered</p>
              {session.result.correct < session.result.total && (
                <Btn
                  primary
                  isLoading={action.pending}
                  onClick={() =>
                    action.run(async (s) => {
                      if (!synced) await sync(s);
                      const next = await request(
                        endpoint(lang, "sessions/"),
                        "POST",
                        {
                          kind: "learn",
                          deck: session.deck,
                          review_session: token,
                          count: 100,
                        },
                        s,
                      );
                      navigate(`/${lang}/flashcard/session/${next.token}`);
                    })
                  }
                >
                  Practice missed words <Icon name="arrow" />
                </Btn>
              )}
            </Glass>
            {session.result.rows.map((r, i) => (
              <Glass key={i}>
                <strong>
                  {i + 1}. {r.target}
                </strong>
                <p>
                  Your answer:{" "}
                  {r.answer === SKIPPED_ANSWER
                    ? "Answer revealed"
                    : r.answer === "remember"
                      ? "Remembered"
                      : r.answer === "again"
                        ? "Due for review"
                        : r.answer}
                </p>
                <Feedback row={r} />
              </Glass>
            ))}
          </>
        ) : session.kind === "test" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              for (const question of session.questions)
                if (
                  timers.current[question.token] &&
                  answers[question.token] !== SKIPPED_ANSWER
                )
                  timings.current[question.token] =
                    timers.current[question.token]();
              savePreference(`${draftKey}:timings`, timings.current);
              setSession({
                ...session,
                completed: session.total,
                result: summarizeLocal(session.questions, answers),
              });
            }}
          >
            {session.questions.map((question, i) => (
              <TimedArea
                key={question.token}
                id={question.token}
                enabled={
                  !session.result && answers[question.token] !== SKIPPED_ANSWER
                }
                onTimer={(read) => {
                  timers.current[question.token] = read;
                }}
              >
                <Glass id={`session-test-${i}`} tabIndex={-1}>
                  <span className="eyebrow">QUESTION {i + 1}</span>
                  <h2 className="question-text">{question.prompt}</h2>
                  <Answer
                    question={question}
                    value={
                      answers[question.token] === SKIPPED_ANSWER
                        ? ""
                        : answers[question.token] || ""
                    }
                    onChange={(v) =>
                      setAnswers({ ...answers, [question.token]: v })
                    }
                    disabled={
                      action.pending ||
                      !!session.result ||
                      answers[question.token] === SKIPPED_ANSWER
                    }
                  />
                  <Feedback
                    row={
                      session.result?.rows[i] ||
                      (answers[question.token] === SKIPPED_ANSWER
                        ? gradeCard(question, SKIPPED_ANSWER)
                        : null)
                    }
                  />
                  {answers[question.token] === SKIPPED_ANSWER ? (
                    <Btn
                      icon="arrow"
                      onClick={() =>
                        document
                          .getElementById(
                            i + 1 < session.questions.length
                              ? `session-test-${i + 1}`
                              : "session-test-submit",
                          )
                          ?.focus()
                      }
                    >
                      Continue
                    </Btn>
                  ) : (
                    <SkipButton
                      onClick={() => {
                        timings.current[question.token] =
                          timers.current[question.token]?.() ?? null;
                        savePreference(`${draftKey}:timings`, timings.current);
                        setAnswers((previous) => ({
                          ...previous,
                          [question.token]: SKIPPED_ANSWER,
                        }));
                      }}
                    />
                  )}
                </Glass>
              </TimedArea>
            ))}
            {session.result ? (
              <Glass className="result-summary">
                <h2>
                  {session.result.correct} / {session.result.total} correct answers
                </h2>

                {session.result.correct < session.result.total && (
                  <Btn
                    onClick={() =>
                      action.run(async (s) => {
                        if (!synced) await sync(s);
                        const next = await request(
                          endpoint(lang, "sessions/"),
                          "POST",
                          {
                            kind: "learn",
                            deck: session.deck,
                            review_session: token,
                            count: 100,
                          },
                          s,
                        );
                        navigate(`/${lang}/flashcard/session/${next.token}`);
                      })
                    }
                  >
                    Practice missed words
                  </Btn>
                )}
              </Glass>
            ) : (
              <Btn
                primary
                type="submit"
                id="session-test-submit"
                isLoading={action.pending}
                isDisabled={
                  Object.values(answers).filter((v) => v.trim()).length !==
                  session.total
                }
              >
                Submit all ·{" "}
                {Object.values(answers).filter((v) => v.trim()).length}/
                {session.total} questions
              </Btn>
            )}
          </form>
        ) : q ? (
          <div key={q.token} ref={clock.root}>
            {q.mode === "flash" ? (
              <>
                <FlipCard
                  front={q.target}
                  back={q.card.vietnamese_meaning}
                  example={q.card.example_german}
                  flipped={flipped}
                  setFlipped={(v) => {
                    setFlipped(v);
                    audio.tick();
                  }}
                />
                <div className="toolbar centered">
                  <Btn onClick={() => action.run(() => audio.speak(q.target))}>
                    <Icon name="sound" />
                    Listen to word
                  </Btn>
                  {!feedback &&
                    (!flipped ? (
                      <Btn primary onClick={() => setFlipped(true)}>
                        Flip card <Icon name="flip" />
                      </Btn>
                    ) : (
                      <>
                        <Btn
                          isDisabled={action.pending}
                          onClick={() => send("again")}
                        >
                          ↻ Review again
                        </Btn>
                        <Btn
                          primary
                          isLoading={action.pending}
                          onClick={() => send("remember")}
                        >
                          ✓ Remembered
                        </Btn>
                      </>
                    ))}
                </div>
              </>
            ) : (
              <Glass>
                <span className="eyebrow">
                  QUESTION {session.completed + 1} ·{" "}
                  {q.mode === "quiz" ? "CHOOSE THE CORRECT MEANING" : "WRITE THE MATCHING WORD"}
                </span>
                <h2 className="question-text">{q.prompt}</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    send(answer);
                  }}
                >
                  <Answer
                    question={q}
                    value={answer}
                    onChange={(v) => {
                      setAnswer(v);
                      if (q.options?.length) send(v);
                    }}
                    feedback={feedback}
                    disabled={!!feedback || action.pending}
                  />
                  {!feedback && !q.options?.length && (
                    <Btn
                      primary
                      type="submit"
                      isLoading={action.pending}
                      isDisabled={!answer.trim()}
                    >
                      Check <Icon name="arrow" />
                    </Btn>
                  )}
                </form>
              </Glass>
            )}
            {!feedback && (
              <SkipButton
                onClick={() => {
                  setFlipped(true);
                  send(SKIPPED_ANSWER);
                }}
              />
            )}
            <Feedback row={feedback} />
            {feedback && (
              <Btn primary icon="arrow" onClick={continueSession}>
                {next?.result ? "View summary" : "Continue"}{" "}
                <Icon name="arrow" />
              </Btn>
            )}
          </div>
        ) : null}
        <Status error={action.error} />
      </div>
    </Page>
  );
}
function Answer({ question, value, onChange, disabled, feedback }) {
  return question.options?.length ? (
    <Choice
      options={question.options}
      value={value}
      onChange={onChange}
      disabled={disabled}
      label="Choose an answer"
      graded={!!feedback}
      correctAnswer={
        question.mode === "quiz"
          ? question.card.vietnamese_meaning
          : question.target
      }
    />
  ) : (
    <Field
      label="Your answer"
      value={value}
      onChange={onChange}
      isRequired
      isDisabled={disabled}
      autoComplete="off"
    />
  );
}
function summarizeLocal(questions, answers) {
  const rows = questions.map((q) => gradeCard(q, answers[q.token]));
  return {
    correct: rows.filter((r) => r.is_correct).length,
    total: rows.length,
    rows,
  };
}
export function ExtraStudy({ lang, params, sound }) {
  const query = new URLSearchParams();
  if (params.get("deck")) query.set("deck", params.get("deck"));
  query.set("filter", params.get("filter") || "all");
  const resource = useResource(endpoint(lang, `study-pack/?${query}`));
  return (
    <Loading resource={resource}>
      {(pack) => <LocalPractice {...{ pack, lang, params, sound, userId }} />}
    </Loading>
  );
}
function LocalPractice({ pack, lang, params, sound, userId }) {
  const navigate = useNavigate();
  const mode = params.get("mode") || "write",
    deck = params.get("deck");
  const example = params.get("target") === "example";
  const [cards] = useState(() =>
    shuffled(pack.cards.filter((c) => !example || c.example_german)),
  );
  const [index, setIndex] = useState(0),
    [answer, setAnswer] = useState(
      mode === "order" ? [] : mode === "match" ? {} : "",
    ),
    [result, setResult] = useState(null);
  const audio = useSound(sound, lang),
    action = useAction();
  const c = cards[index],
    group = cards.slice(index, index + 6);
  const sync = useLearningSync(userId, lang);
  const clock = useAnswerClock(c?.id, !result);
  const target = c ? (example ? c.example_german : c.german_text) : "";
  const items = target.split(/\s+/).map((text, i) => ({ id: String(i), text }));
  const options = [
    ...new Set([
      c?.vietnamese_meaning,
      ...cards.filter((v) => v.id !== c?.id).map((v) => v.vietnamese_meaning),
    ]),
  ].slice(0, 4);
  const [recording, setRecording] = useState(false),
    [recordUrl, setRecordUrl] = useState("");
  const recordingRef = useRef({});
  useEffect(
    () => () => {
      recordingRef.current.stream?.getTracks().forEach((t) => t.stop());
      if (recordingRef.current.url)
        URL.revokeObjectURL(recordingRef.current.url);
      clearTimeout(recordingRef.current.timer);
    },
    [],
  );
  const record = () =>
    action.run(async () => {
      if (recording) {
        recordingRef.current.rec.stop();
        setRecording(false);
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error("This browser does not support recording.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }),
        rec = new MediaRecorder(stream),
        chunks = [];
      recordingRef.current.stream = stream;
      recordingRef.current.rec = rec;
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        clearTimeout(recordingRef.current.timer);
        if (recordingRef.current.url)
          URL.revokeObjectURL(recordingRef.current.url);
        const url = URL.createObjectURL(
          new Blob(chunks, { type: rec.mimeType }),
        );
        recordingRef.current.url = url;
        setRecordUrl(url);
        setRecording(false);
      };
      rec.start();
      setRecording(true);
      recordingRef.current.timer = setTimeout(() => {
        if (rec.state === "recording") rec.stop();
      }, 60000);
    });
  const check = (submitted = answer, skipped = false) => {
    if (result) return;
    const observe = (card, correct, type, response_ms) =>
      sync.enqueue("review", {
        deck: card.deck,
        card: card.id,
        correct,
        type,
        response_ms,
        goal: "comprehensive",
      });
    if (mode === "match") {
      const rows = group.map((v) => ({
        is_correct: !skipped && submitted[String(v.id)] === String(v.id),
        term: v.german_text,
        meaning: v.vietnamese_meaning,
      }));
      group.forEach((card, i) =>
        observe(card, rows[i].is_correct, "matching", null),
      );
      setResult({
        rows,
        correct: rows.filter((v) => v.is_correct).length,
        total: rows.length,
      });
    } else {
      const actual =
        mode === "order"
          ? submitted
              .map((id) => items.find((t) => t.id === id)?.text)
              .join(" ")
          : submitted;
      const graded = gradeCard(
        {
          mode: mode === "quiz" ? "quiz" : "write",
          target,
          meaning: c.vietnamese_meaning,
          card: c,
          alternatives: example ? c.accepted_examples : c.accepted_answers,
          grading: pack.grading,
        },
        actual,
      );
      if (skipped) {
        graded.is_correct = false;
        graded.skipped = true;
      }
      setResult(graded);
      observe(
        c,
        graded.is_correct,
        mode === "quiz" ? "choice" : mode === "speak" ? "flash" : mode,
        clock.read(),
      );
    }
    audio.tick();
  };
  return (
    <Page>
      {deck && <Link to={`/${lang}/flashcard/deck/${deck}`}>← Decks</Link>}
      <Heading
        title={
          {
            write: "Write to remember",
            quiz: "Choose the correct meaning",
            spell: "Listen and write",
            order: "Arrange words",
            match: "Matching",
            speak: "Pronunciation practice",
          }[mode] || "Practice"
        }
      />
      <div className="session-width">
        <Status error={action.error} />
        {!c ? (
          <Glass>
            <h2>Completed</h2>
          </Glass>
        ) : (
          <Glass>
            <p>
              {index + 1}/{cards.length}
            </p>
            <h2>
              {mode === "spell"
                ? "Listen and type what you hear"
                : mode === "quiz" || mode === "speak"
                  ? target
                  : example
                    ? c.example_vietnamese
                    : c.vietnamese_meaning}
            </h2>
            {["spell", "speak"].includes(mode) && (
              <Btn icon="sound" onClick={() => audio.speak(target)}>
                Listen to example
              </Btn>
            )}
            {mode === "match" ? (
              <LocalMatching
                key={index}
                group={group}
                answer={answer}
                setAnswer={setAnswer}
                disabled={!!result}
              />
            ) : mode === "order" ? (
              <LocalOrder
                key={index}
                items={items}
                answer={answer}
                setAnswer={setAnswer}
                disabled={!!result}
              />
            ) : mode === "speak" ? (
              <>
                <Btn onClick={record} isLoading={action.pending}>
                  {recording ? "Stop recording" : "Record"}
                </Btn>
                {recordUrl && <audio controls src={recordUrl} />}
                <Btn
                  isDisabled={recording}
                  onClick={() =>
                    setResult({ is_correct: true, target, card: c })
                  }
                >
                  Practice complete
                </Btn>
              </>
            ) : mode === "quiz" ? (
              <LocalChoices
                key={index}
                options={options}
                answer={answer}
                setAnswer={(v) => {
                  setAnswer(v);
                  check(v);
                }}
                correctAnswer={c.vietnamese_meaning}
                disabled={!!result}
              />
            ) : (
              <Field
                label="Answer"
                value={answer}
                onChange={setAnswer}
                isDisabled={!!result}
              />
            )}
            {!result && mode !== "speak" && mode !== "quiz" && (
              <Btn primary onClick={() => check()}>
                Check
              </Btn>
            )}
            {!result && (
              <SkipButton
                disabled={recording || action.pending}
                onClick={() =>
                  check(
                    mode === "match" ? {} : mode === "order" ? [] : "",
                    true,
                  )
                }
              />
            )}
            {result && (
              <>
                {mode === "match" ? (
                  <Status>
                    {result.correct}/{result.total} correct pairs
                    {result.rows.map((r, i) => (
                      <p key={i}>
                        {r.is_correct ? "✓" : "↻"} {r.term} — {r.meaning}
                      </p>
                    ))}
                  </Status>
                ) : (
                  <Feedback row={result} />
                )}
                <Btn
                  primary
                  icon="arrow"
                  onClick={() => {
                    setIndex((i) => i + (mode === "match" ? group.length : 1));
                    setAnswer(
                      mode === "order" ? [] : mode === "match" ? {} : "",
                    );
                    setResult(null);
                    setRecordUrl("");
                  }}
                >
                  Continue
                </Btn>
              </>
            )}
          </Glass>
        )}
      </div>
    </Page>
  );
}
function LocalChoices({ options, answer, setAnswer, disabled, correctAnswer }) {
  const [rows] = useState(() => shuffled(options));
  return (
    <Choice
      options={rows}
      value={answer}
      onChange={setAnswer}
      disabled={disabled}
      graded={disabled}
      correctAnswer={correctAnswer}
    />
  );
}
function LocalOrder({ items, answer, setAnswer, disabled }) {
  const [rows] = useState(() => shuffled(items));
  return (
    <WordOrder
      items={rows}
      value={answer}
      onChange={setAnswer}
      disabled={disabled}
    />
  );
}
function LocalMatching({ group, answer, setAnswer, disabled }) {
  const [right] = useState(() =>
    shuffled(
      group.map((c) => ({ id: String(c.id), text: c.vietnamese_meaning })),
    ),
  );
  return (
    <Matching
      left={group.map((c) => ({ id: String(c.id), text: c.german_text }))}
      right={right}
      value={answer}
      onChange={setAnswer}
      disabled={disabled}
    />
  );
}
function Recorder({ lang, token, onResult }) {
  const [recording, setRecording] = useState(false),
    [blob, setBlob] = useState(null),
    [url, setUrl] = useState(""),
    [consent, setConsent] = useState(false);
  const ref = useRef({}),
    action = useAction();
  useEffect(
    () => () => {
      ref.current.disposed = true;
      clearTimeout(ref.current.timer);
      if (ref.current.rec) {
        ref.current.rec.onstop = null;
        ref.current.rec.ondataavailable = null;
        if (ref.current.rec.state === "recording") ref.current.rec.stop();
      }
      ref.current.stream?.getTracks().forEach((t) => t.stop());
      if (ref.current.url) URL.revokeObjectURL(ref.current.url);
    },
    [],
  );
  const stop = () => {
    if (ref.current.rec?.state === "recording") ref.current.rec.stop();
    ref.current.stream?.getTracks().forEach((t) => t.stop());
    clearTimeout(ref.current.timer);
    setRecording(false);
  };
  const start = () =>
    action.run(async () => {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error("This browser does not support audio recording.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (ref.current.disposed) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      ref.current.stream = stream;
      try {
        const rec = new MediaRecorder(stream);
        ref.current.rec = rec;
        const parts = [];
        rec.ondataavailable = (e) => {
          if (e.data.size) parts.push(e.data);
          if (parts.reduce((n, p) => n + p.size, 0) > 10 * 1024 * 1024) stop();
        };
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const b = new Blob(parts, { type: rec.mimeType });
          if (b.size > 10 * 1024 * 1024) {
            action.setError("The recording exceeds 10 MB. Please make a shorter recording.");
            return;
          }
          if (ref.current.url) URL.revokeObjectURL(ref.current.url);
          ref.current.url = URL.createObjectURL(b);
          setBlob(b);
          setUrl(ref.current.url);
        };
        rec.start(250);
        setBlob(null);
        setUrl("");
        setRecording(true);
        ref.current.timer = setTimeout(stop, 60000);
      } catch (e) {
        stream.getTracks().forEach((t) => t.stop());
        throw e;
      }
    });
  return (
    <div className="recorder">
      <p>Temporary recording, up to 60 seconds. Feedback evaluates the recognized content.</p>
      <Btn onClick={recording ? stop : start} isLoading={action.pending}>
        {recording ? "■ Stop recording" : "● Start recording"}
      </Btn>
      {url && <audio controls src={url} />}
      <label className="check-line">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        I agree to send my recording to the speech recognition service when I submit.
      </label>
      <Btn
        primary
        isDisabled={!blob || !consent || recording}
        isLoading={action.pending}
        onClick={() =>
          action.run(async (s) => {
            const form = new FormData();
            form.append(
              "audio",
              blob,
              blob.type.includes("mp4")
                ? "recording.mp4"
                : blob.type.includes("ogg")
                  ? "recording.ogg"
                  : "recording.webm",
            );
            form.append("consent", "yes");
            const r = await request(
              endpoint(lang, `speaking/${token}/`),
              "POST",
              form,
              s,
            );
            if (r.status !== "done")
              throw new Error(r.error || "Speech was unclear. Please record again.");
            onResult(r.result);
            setBlob(null);
            setUrl("");
          })
        }
      >
        Submit for checking
      </Btn>
      <Status error={action.error} />
    </div>
  );
}

function TimedArea({ id, enabled, onTimer, children }) {
  const clock = useAnswerClock(id, enabled);
  useEffect(() => {
    onTimer(clock.read);
  });
  return <div ref={clock.root}>{children}</div>;
}
