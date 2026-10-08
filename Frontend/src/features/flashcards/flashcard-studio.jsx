import { useWindowActive } from "../../lib/core.js";
import { SkipButton, AnswerReveal } from "../learning/skip-controls.jsx";
import { cardSolution } from "../learning/skip-learning.js";
import SpacedReview from "./spaced-review.jsx";
import { useAnswerClock } from "../learning/use-answer-clock.js";
import { PracticeModal } from "../practice/practice-workspace.jsx";
import { useLearningSync, pendingLearning } from "../learning/learning-sync.js";
import { useEffect, useRef, useState } from "react";
import { endpoint, useResource, readPreference, savePreference } from "../../lib/core.js";
import {
  Btn,
  Icon,
  Field,
  Select,
  Page,
  Heading,
  SidebarTools,
  Status,
  Link,
  Confirm,
  FlipCard,
  Choice,
  Matching,
  useSound,
} from "../../components/ui/ui.jsx";
import {
  TYPES,
  mix,
  sides,
  makeQuestion,
  checkQuestion,
  advanceProgress,
  nextLearningCard,
  createTest,
} from "./flashcard-engine.js";
const defaults = {
  mode: "flash",
  shuffle: false,
  direction: "front",
  autoSpeak: false,
  speakAfterCorrect: false,
  frontVoice: "",
  backVoice: "vi-VN",
  starredOnly: false,
  goal: "comprehensive",
  answerWith: "term",
  types: ["choice", "written", "truefalse"],
  count: 20,
  minutes: 10,
  ignore_case: true,
  ignore_punctuation: true,
};
export default function FlashcardStudio({ lang, id, userId, sound }) {
  const resource = useResource(endpoint(lang, `decks/${id}/`));
  return resource.data ? (
    <Studio
      key={`${userId}:${lang}:${id}`}
      {...{ lang, id, userId, sound }}
      data={resource.data}
    />
  ) : (
    <Status error={resource.error}>Loading deck…</Status>
  );
}
function Studio({ lang, id, userId, sound, data }) {
 const windowActive = useWindowActive();
  const sync = useLearningSync(userId, lang);
  const waiting = pendingLearning(userId, lang).filter(
    (e) =>
      Number(e.payload.deck) === Number(id) &&
      !(data.learning?.applied || []).includes(e.token),
  );
  const initialStars = new Set(data.learning?.stars || []);
  waiting
    .filter((e) => e.kind === "star")
    .forEach((e) =>
      e.payload.value
        ? initialStars.add(e.payload.card)
        : initialStars.delete(e.payload.card),
    );
  const initialProgress = { ...data.learning?.progress };
  waiting.forEach((e) => {
    if (e.kind === "reset") {
      Object.keys(initialProgress).forEach(
        (key) => delete initialProgress[key],
      );
    } else if (e.kind === "review") {
      initialProgress[e.payload.card] = advanceProgress(
        initialProgress[e.payload.card],
        e.payload.correct,
        e.payload.type,
        0,
        e.payload.goal,
      );
    }
  });
  const initialOptions =
    waiting.filter((e) => e.kind === "options").at(-1)?.payload.options ||
    data.learning?.options ||
    {};
  const key = `wortify:cards:${userId}:${lang}:${id}`;
  const [options, setOptions] = useState(() => ({
    ...defaults,
    autoSpeak: data.study_defaults?.autoplay ?? defaults.autoSpeak,
    ignore_case: data.study_defaults?.ignore_case ?? defaults.ignore_case,
    ignore_punctuation:
      data.study_defaults?.ignore_punctuation ?? defaults.ignore_punctuation,
    transliteration: data.study_defaults?.transliteration ?? false,
    minutes: data.study_defaults?.session_minutes ?? defaults.minutes,
    ...initialOptions,
    frontVoice:
      initialOptions.frontVoice || (lang === "de" ? "de-DE" : "en-US"),
  }));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stars, setStars] = useState(() => [...initialStars]),
    [progress, setProgress] = useState(() => initialProgress);
  const [order, setOrder] = useState(() => data.cards),
    [index, setIndex] = useState(0),
    [flipped, setFlipped] = useState(false);
  const [question, setQuestion] = useState(null),
    [value, setValue] = useState(""),
    [feedback, setFeedback] = useState(null),
    [turn, setTurn] = useState(0),
    [running, setRunning] = useState(false),
    [started, setStarted] = useState(0),
    [elapsed, setElapsed] = useState(0),
    [completed, setCompleted] = useState(false);
  const [flashSkipped, setFlashSkipped] = useState(false);
  const [flashEnded, setFlashEnded] = useState(false);
  const [testSkipped, setTestSkipped] = useState({});
  const [test, setTest] = useState([]),
    [testAnswers, setTestAnswers] = useState({}),
    [testResult, setTestResult] = useState(null),
    [testChecked, setTestChecked] = useState({}),
    [error, setError] = useState(""),
    [sessionCards, setSessionCards] = useState([]),
    [resetLearning, setResetLearning] = useState(false);
  const questionTimers = useRef({});
  const audio = useSound(sound, lang),
    startSides = useRef({});
  const pool = data.cards.filter(
    (c) => !options.starredOnly || stars.includes(c.id),
  );
  const active = order[index];
  const flashClock = useAnswerClock(
    active?.id,
    options.mode === "flash" && !flashSkipped,
  );
  useEffect(() => setFlashSkipped(false), [active?.id]);
  useEffect(() => {
    if (!options.starredOnly) return;
    setOrder((previous) => {
      const remaining = previous.filter((c) => stars.includes(c.id));
      const added = data.cards.filter(
        (c) => stars.includes(c.id) && !remaining.some((p) => p.id === c.id),
      );
      const next = [...remaining, ...added];
      const kept = next.findIndex((c) => c.id === active?.id);
      setIndex(
        kept >= 0 ? kept : Math.min(index, Math.max(0, next.length - 1)),
      );
      return next;
    });
  }, [stars]);
  useEffect(() => savePreference(`${key}:options`, options), [options, key]);
  useEffect(() => savePreference(`${key}:stars`, stars), [stars, key]);
  useEffect(() => savePreference(`${key}:progress`, progress), [progress, key]);
  useEffect(() => {
    if (options.mode !== "flash") return;
    setOrder(options.shuffle ? mix(pool) : pool);
    setIndex(0);
    startSides.current = {};
  }, [options.shuffle, options.starredOnly, options.mode]);
  useEffect(() => {
    if (!active) return;
    startSides.current[active.id] ??= Math.random() > 0.5;
    setFlipped(
      options.direction === "back" ||
        (options.direction === "random" && startSides.current[active.id]),
    );
  }, [active?.id, options.direction]);
  useEffect(() => {
    if (options.mode === "flash" && options.autoSpeak && active) {
      speak(
        flipped ? active.vietnamese_meaning : active.german_text,
        flipped ? options.backVoice : options.frontVoice,
      );
    }
    return () => window.speechSynthesis?.cancel();
  }, [
    active?.id,
    flipped,
    options.autoSpeak,
    options.frontVoice,
    options.backVoice,
    options.mode,
  ]);
  useEffect(() => {
    if (!running || options.mode !== "learn") return;
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [running, started, options.mode]);
  useEffect(() => {
    if (
      running &&
      options.mode === "learn" &&
      elapsed >= options.minutes * 60 &&
      !feedback?.skipped
    )
      setRunning(false);
  }, [elapsed, options.minutes, running, options.mode, feedback?.skipped]);
  useEffect(() => {
    const listener = (e) => {
      if (!windowActive) return;
      if (
        e.target.closest("input,textarea,select,button,a") ||
        options.mode !== "flash" ||
        settingsOpen ||
        resetLearning
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        setFlipped((v) => !v);
      }
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [windowActive, index, order.length, options.mode, settingsOpen, resetLearning]);
  const speak = (text, voice) => {
    if (!window.speechSynthesis) {
      setError("This browser does not support speech synthesis.");
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voice;
    u.rate = 0.9;
    u.onerror = () =>
      setError("This browser has no voice for the selected language.");
    window.speechSynthesis.speak(u);
  };
  const step = (delta) => {
    setIndex((i) => Math.max(0, Math.min(order.length - 1, i + delta)));
    audio.tick();
  };
  const patch = (v) => {
    sync.enqueue("options", {
      deck: Number(id),
      options: { ...options, ...v },
    });
    setOptions((o) => ({ ...o, ...v }));
    if (v.mode || v.types || v.answerWith || v.goal) {
      setFlashEnded(false);
      setFlashSkipped(false);
      setStarted(0);
      setElapsed(0);
      setRunning(false);
      setQuestion(null);
      setFeedback(null);
      setValue("");
      setCompleted(false);
      setTest([]);
      setTestResult(null);
      setError("");
    }
  };
  const star = (card) => {
    sync.enqueue("star", {
      deck: Number(id),
      card: card.id,
      value: !stars.includes(card.id),
    });
    setStars((s) =>
      s.includes(card.id) ? s.filter((x) => x !== card.id) : [...s, card.id],
    );
  };
  const reset = () => {
    sync.enqueue("reset", { deck: Number(id) });
    setProgress({});
    setRunning(false);
    setQuestion(null);
    setFeedback(null);
    setValue("");
    setTurn(0);
    setResetLearning(false);
  };
  const learningGoal = options.types.includes("written")
    ? options.goal
    : "quick";
  const chooseType = (card, records, t = 0) => {
    const p = records[card.id];
    if (
      options.types.includes("written") &&
      options.goal === "comprehensive" &&
      (p?.misses || p?.streak >= 2)
    )
      return "written";
    const enabled = options.types.filter((t) => t !== "matching");
    return enabled[t % enabled.length] || "written";
  };
  const begin = () => {
    setError("");
    if (!pool.length) {
      setError("No cards match these filters.");
      return;
    }
    if (
      !options.types.filter((t) => options.mode === "test" || t !== "matching")
        .length
    ) {
      setError("Choose at least one question type.");
      return;
    }
    const cards = options.shuffle ? mix(pool) : pool;
    setSessionCards(cards);
    setTurn(0);
    setFeedback(null);
    setValue("");
    setElapsed(0);
    setStarted(Date.now());
    setRunning(true);
    setCompleted(false);
    if (options.mode === "test") {
      setTest(createTest(pool, pool.length, options.types, options.answerWith));
      setTestSkipped({});
      setTestAnswers({});
      setTestChecked({});
      setTestResult(null);
    } else {
      const card = nextLearningCard(cards, progress, 0);
      setQuestion(
        makeQuestion(
          card,
          chooseType(card, progress),
          cards,
          options.answerWith,
        ),
      );
    }
  };
  const submitLearn = (submittedValue = value, skipped = false) => {
    if (!question || feedback?.correct || feedback?.skipped) return;
    const correct =
        !skipped && checkQuestion(question, submittedValue, options),
      records = {
        ...progress,
        [question.id]: advanceProgress(
          progress[question.id],
          correct,
          question.type,
          turn,
          learningGoal,
        ),
      };
    records[question.id].lastStudied = new Date().toLocaleDateString("en-CA");
    sync.enqueue("review", {
      deck: Number(id),
      card: question.id,
      correct,
      type: question.type,
      goal: learningGoal,
      response_ms: questionTimers.current[question.id]?.() ?? null,
    });
    setProgress(records);
    setValue(submittedValue);
    setFeedback({ correct, expected: question.expected, skipped });
    audio.feedback(correct);
    if (correct && options.speakAfterCorrect) {
      try {
        audio.speak(question.card.german_text);
      } catch (e) {
        setError(e.message);
      }
    }
  };
  const next = () => {
    if (elapsed >= options.minutes * 60) {
      setRunning(false);
      setFeedback(null);
      sync.flush();
      return;
    }
    const t = turn + 1;
    setTurn(t);
    setFeedback(null);
    setValue("");
    const nextProgress = progress;
    if (sessionCards.every((c) => nextProgress[c.id]?.stage === "mastered")) {
      setRunning(false);
      setCompleted(true);
      audio.applause();
      return;
    }
    const c = nextLearningCard(sessionCards, progress, t, question?.id);
    setQuestion(
      makeQuestion(
        c,
        chooseType(c, progress, t),
        sessionCards,
        options.answerWith,
      ),
    );
  };
  const answerTest = (i, v, commit = false, skipped = false) => {
    if (Object.hasOwn(testChecked, i) || testResult) return;
    const answers = { ...testAnswers, [i]: v };
    setTestAnswers(answers);
    const q = test[i];
    const complete =
      skipped ||
      q.type === "choice" ||
      q.type === "truefalse" ||
      (q.type === "matching" && q.left.every((l) => v?.[l.id])) ||
      (q.type === "written" && commit && String(v || "").trim());
    if (!complete) return;
    const correct = !skipped && checkQuestion(q, v, options),
      checked = { ...testChecked, [i]: correct };
    setTestChecked(checked);
    if (skipped) setTestSkipped((previous) => ({ ...previous, [i]: true }));
    const observed =
      q.type === "matching"
        ? q.left.map((item) => ({
            id: Number(item.id),
            correct:
              !skipped &&
              q.right.find((row) => row.id === v?.[item.id])?.text ===
                q.right.find((row) => row.id === item.id)?.text,
          }))
        : [{ id: q.id, correct }];
    observed.forEach((item) =>
      sync.enqueue("review", {
        deck: Number(id),
        card: item.id,
        correct: item.correct,
        type: q.type,
        goal: learningGoal,
        source: "test",
        response_ms:
          q.type === "matching"
            ? null
            : (questionTimers.current[`test:${i}`]?.() ?? null),
      }),
    );
    audio.feedback(correct);
    if (Object.keys(checked).length === test.length) {
      const results = test.map((_, j) => checked[j]);
      setTestResult(results);
      sync.enqueue("test", { deck: Number(id), results });
      sync.flush();
    }
  };
  const stages = {
    new: pool.filter(
      (c) => !progress[c.id]?.stage || progress[c.id].stage === "new",
    ).length,
    familiar: pool.filter((c) => progress[c.id]?.stage === "familiar").length,
    mastered: pool.filter((c) => progress[c.id]?.stage === "mastered").length,
  };
  return (
    <Page>
      <Heading title={data.deck.title} />
      <SidebarTools>
        <Status error={sync.error} />
        <div className="flash-mode-picker" aria-label="Study mode">
          {[
            ["flash", "cards", "Card"],
            ["learn", "spark", "Study"],
            ["test", "exercise", "Check"],
            ["review", "history", "Due reviews"],
          ].map(([mode, icon, label]) => (
            <button
              key={mode}
              aria-pressed={options.mode === mode}
              onClick={() => patch({ mode })}
            >
              <Icon name={icon} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        {options.mode !== "review" && (
          <div className="flash-icon-row">
            <Btn
              icon="star"
              aria-pressed={options.starredOnly}
              onClick={() => patch({ starredOnly: !options.starredOnly })}
            >{`Starred cards only · ${stars.length}`}</Btn>
            <Btn
              icon="shuffle"
              aria-pressed={options.shuffle}
              onClick={() => patch({ shuffle: !options.shuffle })}
            >
              Shuffle cards
            </Btn>
            <Btn icon="settings" onClick={() => setSettingsOpen(true)}>
              Study options
            </Btn>
            <Link
              className="btn flash-icon-link"
              title="Manage terms"
              aria-label="Manage terms"
              to={`/${lang}/flashcard/deck/${id}/edit`}
            >
              <Icon name="edit" />
            </Link>
            {options.mode !== "flash" && (
              <Btn primary icon={running ? "refresh" : "play"} onClick={begin}>
                {running ? "Restart session" : "Start learning"}
              </Btn>
            )}
            {options.mode === "test" && test.length > 0 && (
              <Btn icon="print" onClick={() => window.print()}>
                Print / Save PDF
              </Btn>
            )}
          </div>
        )}
      </SidebarTools>
      {settingsOpen && (
        <PracticeModal
          title="Study options"
          size="lg"
          onClose={() => setSettingsOpen(false)}
        >
          <div className="flash-settings">
            <label className="check-line">
              <input
                type="checkbox"
                checked={options.starredOnly}
                onChange={(e) => patch({ starredOnly: e.target.checked })}
              />
              Starred cards only ({stars.length})
            </label>
            <label className="check-line">
              <input
                type="checkbox"
                checked={options.shuffle}
                onChange={(e) => patch({ shuffle: e.target.checked })}
              />
              Shuffle randomly
            </label>
            {options.mode === "flash" ? (
              <>
                <Select
                  label="First side shown"
                  value={options.direction}
                  onChange={(direction) => patch({ direction })}
                >
                  <option value="front">Term</option>
                  <option value="back">Definition</option>
                  <option value="random">Random for each card</option>
                </Select>
                <label className="check-line">
                  <input
                    type="checkbox"
                    checked={options.autoSpeak}
                    onChange={(e) => patch({ autoSpeak: e.target.checked })}
                  />
                  Play audio automatically
                </label>
                {[
                  ["frontVoice", "Term voice"],
                  ["backVoice", "Definition voice"],
                ].map(([k, label]) => (
                  <Select
                    key={k}
                    label={label}
                    value={options[k]}
                    onChange={(v) => patch({ [k]: v })}
                  >
                    {[
                      ["en-US", "English"],
                      ["de-DE", "Deutsch"],
                      ["vi-VN", "Vietnamese"],
                    ].map(([v, t]) => (
                      <option key={v} value={v}>
                        {t}
                      </option>
                    ))}
                  </Select>
                ))}
              </>
            ) : (
              <>
                <Select
                  label="Answer with"
                  value={options.answerWith}
                  onChange={(answerWith) => patch({ answerWith })}
                >
                  <option value="term">
                    Term · Show the definition first
                  </option>
                  <option value="definition">
                    Definition · Show the term first
                  </option>
                  <option value="random">Both · Random</option>
                </Select>
                <fieldset>
                  <legend>Question type</legend>
                  {TYPES.filter(
                    ([t]) => options.mode === "test" || t !== "matching",
                  ).map(([type, title]) => (
                    <label className="check-line" key={type}>
                      <input
                        type="checkbox"
                        checked={options.types.includes(type)}
                        onChange={(e) =>
                          patch({
                            types: e.target.checked
                              ? [...options.types, type]
                              : options.types.filter((t) => t !== type),
                          })
                        }
                      />
                      {title}
                    </label>
                  ))}
                </fieldset>
                {options.mode === "learn" && (
                  <>
                    <Select
                      label="Learning goal"
                      value={options.goal}
                      onChange={(goal) => patch({ goal })}
                    >
                      <option value="quick">Basic</option>
                      <option value="comprehensive">Smart learning</option>
                    </Select>
                    <Field
                      label="Time target (minutes)"
                      type="number"
                      min="1"
                      max="180"
                      value={options.minutes}
                      onChange={(minutes) =>
                        patch({
                          minutes: Math.max(
                            1,
                            Math.min(180, Number(minutes) || 1),
                          ),
                        })
                      }
                    />
                    <Btn
                      icon="refresh"
                      onClick={() => {
                        setSettingsOpen(false);
                        setResetLearning(true);
                      }}
                    >
                      Reset learning progress
                    </Btn>
                  </>
                )}
                {options.mode === "learn" && (
                  <label className="check-line">
                    <input
                      type="checkbox"
                      checked={options.speakAfterCorrect}
                      onChange={(e) =>
                        patch({ speakAfterCorrect: e.target.checked })
                      }
                    />
                    Read the term aloud after a correct answer
                  </label>
                )}
                <label className="check-line">
                  <input
                    type="checkbox"
                    checked={options.ignore_case}
                    onChange={(e) => patch({ ignore_case: e.target.checked })}
                  />
                  Ignore case
                </label>
                <label className="check-line">
                  <input
                    type="checkbox"
                    checked={options.ignore_punctuation}
                    onChange={(e) =>
                      patch({ ignore_punctuation: e.target.checked })
                    }
                  />
                  Ignore punctuation
                </label>
              </>
            )}
          </div>
        </PracticeModal>
      )}
      <Status error={error} />
      {options.mode === "review" ? (
        <SpacedReview lang={lang} id={id} userId={userId} />
      ) : options.mode === "flash" ? (
        flashEnded ? (
          <section className="work-paper">
            <h2>All cards reviewed</h2>
            <Btn
              icon="refresh"
              onClick={() => {
                setFlashEnded(false);
                setIndex(0);
                setFlashSkipped(false);
              }}
            >
              Review
            </Btn>
          </section>
        ) : active ? (
          <div className="studio-flash" ref={flashClock.root}>
            <Btn
              icon="star"
              className="star-button"
              aria-label={stars.includes(active.id) ? "Unstar" : "Star"}
              aria-pressed={stars.includes(active.id)}
              onClick={() => star(active)}
            >
              {stars.includes(active.id) ? "★" : "☆"}
            </Btn>
            <FlipCard
              front={active.german_text}
              back={active.vietnamese_meaning}
              example={active.example_german}
              flipped={flipped}
              setFlipped={(v) => {
                setFlipped(v);
                audio.tick();
              }}
            />
            <div className="toolbar flashcard-actions">
              {flashSkipped ? (
                <Btn
                  icon="arrow"
                  primary
                  onClick={() => {
                    if (index === order.length - 1) setFlashEnded(true);
                    else step(1);
                  }}
                >
                  Continue
                </Btn>
              ) : (
                <SkipButton
                  onClick={() => {
                    setFlashSkipped(true);
                    setFlipped(true);
                    sync.enqueue("review", {
                      deck: Number(id),
                      card: active.id,
                      correct: false,
                      type: "flash",
                      rating: 1,
                      response_ms: flashClock.read(),
                      goal: learningGoal,
                    });
                    setProgress((previous) => ({
                      ...previous,
                      [active.id]: advanceProgress(
                        previous[active.id],
                        false,
                        "flash",
                        0,
                        learningGoal,
                      ),
                    }));
                  }}
                />
              )}
              <Btn
                icon="chevron_left"
                isDisabled={index === 0}
                onClick={() => step(-1)}
              >
                ← Previous
              </Btn>
              <span>
                {index + 1}/{order.length}
              </span>
              <Btn
                icon="chevron_right"
                isDisabled={index === order.length - 1}
                onClick={() => step(1)}
              >
                Next →
              </Btn>
              <Btn icon="flip" onClick={() => setFlipped((v) => !v)}>
                Flip card · Space
              </Btn>
              <Btn
                icon="sound"
                onClick={() =>
                  speak(
                    flipped ? active.vietnamese_meaning : active.german_text,
                    flipped ? options.backVoice : options.frontVoice,
                  )
                }
              >
                Nghe
              </Btn>
            </div>
          </div>
        ) : (
          <p>No matching cards.</p>
        )
      ) : options.mode === "learn" ? (
        <>
          {completed && !running ? (
            <section className="learning-complete" role="status">
              <div className="learning-complete-icon" aria-hidden="true">
                🎉
              </div>
              <h2>Congratulations!</h2>
              <p>You have completed all cards in this session.</p>
              <Btn icon="refresh" primary onClick={begin}>
                Study again
              </Btn>
            </section>
          ) : null}
          <p>
            Practiced today{" "}
            {
              pool.filter(
                (c) =>
                  progress[c.id]?.lastStudied ===
                  new Date().toLocaleDateString("en-CA"),
              ).length
            }
            /{pool.length} cards · {options.minutes} target minutes
          </p>
          <div className="learn-stages">
            {[
              ["new", "Not studied"],
              ["familiar", "Familiar"],
              ["mastered", "Mastered"],
            ].map(([k, t]) => (
              <div key={k}>
                <strong>{stages[k]}</strong>
                <span>{t}</span>
              </div>
            ))}
          </div>
          {running && question ? (
            <section className="work-paper">
              <p>
                {Math.floor(elapsed / 60)}:
                {String(elapsed % 60).padStart(2, "0")} / {options.minutes} minutes
                · Round {turn + 1}
              </p>
              <Btn
                icon="star"
                className="star-button"
                aria-label={
                  stars.includes(question.id) ? "Unstar" : "Star"
                }
                aria-pressed={stars.includes(question.id)}
                onClick={() => star(question.card)}
              >
                {stars.includes(question.id) ? "★" : "☆"}
              </Btn>
              <QuestionUI
                key={`${turn}:${question.id}`}
                q={question}
                onTimer={(read) => {
                  questionTimers.current[question.id] = read;
                }}
                value={value}
                onChange={(v) => {
                  setValue(v);
                  if (
                    question.type === "choice" ||
                    question.type === "truefalse"
                  )
                    submitLearn(v);
                }}
                onCommit={() => submitLearn()}
                feedback={feedback?.correct}
                disabled={feedback?.correct || feedback?.skipped}
              />
              {feedback?.skipped && (
                <AnswerReveal answers={cardSolution(question)} />
              )}
              <div className="session-controls">
                <Btn
                  icon="close"
                  className="end-session"
                  aria-label="End session"
                  title="End session"
                  onClick={() => {
                    setRunning(false);
                    sync.flush();
                  }}
                >
                  <Icon name="close" />
                  <span>Finish</span>
                </Btn>
                <div className="flashcard-actions">
                  {!feedback?.correct && !feedback?.skipped && (
                    <SkipButton onClick={() => submitLearn("", true)} />
                  )}
                  <Btn
                    primary
                    icon="arrow"
                    className="next-question"
                    aria-label="Next question"
                    title="Next question"
                    onClick={next}
                    isDisabled={!feedback?.correct && !feedback?.skipped}
                  >
                    <span className="next-label">Continue</span>
                    <Icon name="arrow" />
                  </Btn>
                </div>
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <>
          {!test.length ? (
            <section className="work-paper">
              <h2>Test</h2>

              <Btn primary icon="play" onClick={begin}>
                Generate test
              </Btn>
            </section>
          ) : (
            <div className="print-test">
              <h2>{data.deck.title} · Test</h2>
              <p className="print-only">
                Name: ____________________ Date: ____________
              </p>
              {test.map((q, i) => (
                <section
                  className="work-paper"
                  id={`studio-test-${i}`}
                  tabIndex={-1}
                  key={`${q.id}:${i}`}
                >
                  <h3>
                    Question {i + 1} · {TYPES.find(([k]) => k === q.type)?.[1]}
                  </h3>
                  <QuestionUI
                    q={q}
                    onTimer={(read) => {
                      questionTimers.current[`test:${i}`] = read;
                    }}
                    value={testAnswers[i]}
                    onChange={(v) => answerTest(i, v)}
                    onCommit={() => answerTest(i, testAnswers[i], true)}
                    feedback={testChecked[i]}
                    disabled={Object.hasOwn(testChecked, i)}
                  />
                  {testSkipped[i] && <AnswerReveal answers={cardSolution(q)} />}
                  <div className="flashcard-actions">
                    {!Object.hasOwn(testChecked, i) ? (
                      <SkipButton
                        onClick={() => answerTest(i, "", true, true)}
                      />
                    ) : (
                      testSkipped[i] && (
                        <Btn
                          icon="arrow"
                          onClick={() =>
                            document
                              .getElementById(
                                i + 1 < test.length
                                  ? `studio-test-${i + 1}`
                                  : "studio-test-summary",
                              )
                              ?.focus()
                          }
                        >
                          Continue
                        </Btn>
                      )
                    )}
                  </div>
                </section>
              ))}
              {testResult ? (
                <section
                  className="test-summary"
                  id="studio-test-summary"
                  tabIndex={-1}
                >
                  <div
                    role="img"
                    aria-label={`${testResult.filter(Boolean).length}/${test.length} correct answers`}
                    className="result-ring"
                    style={{
                      "--percent": `${(100 * testResult.filter(Boolean).length) / test.length}%`,
                    }}
                  >
                    <strong>
                      {Math.round(
                        (100 * testResult.filter(Boolean).length) / test.length,
                      )}
                      %
                    </strong>
                  </div>
                  <h2>
                    {testResult.filter(Boolean).length}/{test.length} correct answers
                  </h2>

                  <Btn icon="refresh" onClick={begin}>
                    Generate new test
                  </Btn>
                </section>
              ) : null}
            </div>
          )}
        </>
      )}
      {resetLearning && (
        <Confirm
          title="Reset learning progress?"
          description="All accuracy and mastery progress for this deck will be cleared. Stars and study preferences will be kept."
          onClose={() => setResetLearning(false)}
          onConfirm={async () => reset()}
        />
      )}
    </Page>
  );
}
function QuestionUI({
  q,
  value,
  onChange,
  disabled,
  feedback,
  onCommit,
  onTimer,
}) {
  const clock = useAnswerClock(q.id, !disabled);
  useEffect(() => {
    onTimer?.(clock.read);
  });
  const checked = typeof feedback === "boolean";
  const answerClass = (answer, correct) =>
    `answer-option ${checked && correct ? "answer-correct" : checked && value === answer ? "answer-wrong" : value === answer ? "selected" : ""}`;
  return (
    <div
      ref={clock.root}
      className={`flash-question ${checked ? (feedback ? "answer-right" : "answer-error") : ""}`}
    >
      <h2>{q.prompt}</h2>
      {q.type === "choice" ? (
        <div className="answer-options">
          {q.options.map((answer, i) => (
            <button
              key={i}
              className={answerClass(answer, answer === q.expected)}
              disabled={disabled}
              onClick={() => onChange(answer)}
            >
              <span>{String.fromCharCode(65 + i)}</span>
              {answer}
            </button>
          ))}
        </div>
      ) : q.type === "truefalse" ? (
        <>
          <p>
            Suggested answer: <strong>{q.proposed}</strong>
          </p>
          <div className="toolbar">
            <Btn
              className={answerClass(true, q.truth === true)}
              aria-pressed={value === true}
              isDisabled={disabled}
              onClick={() => onChange(true)}
            >
              Correct
            </Btn>
            <Btn
              className={answerClass(false, q.truth === false)}
              aria-pressed={value === false}
              isDisabled={disabled}
              onClick={() => onChange(false)}
            >
              Sai
            </Btn>
          </div>
        </>
      ) : q.type === "matching" ? (
        <Matching
          left={q.left}
          right={q.right}
          value={value || {}}
          onChange={onChange}
          disabled={disabled}
        />
      ) : (
        <Field
          label="Answer"
          value={value || ""}
          onChange={onChange}
          isDisabled={disabled}
          autoComplete="off"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onCommit?.();
            }
          }}
          endContent={
            <button
              className="answer-enter"
              disabled={disabled || !String(value || "").trim()}
              aria-label="Check answer"
              onClick={() => onCommit?.()}
            >
              <Icon name="enter" />
            </button>
          }
        />
      )}
      {q.type === "matching" && (
        <div className="print-only print-matching">
          <div>
            {q.left.map((item, i) => (
              <p key={item.id}>
                {i + 1}. {item.text}
              </p>
            ))}
          </div>
          <div>
            {q.right.map((item, i) => (
              <p key={item.id}>
                {String.fromCharCode(65 + i)}. {item.text}
              </p>
            ))}
          </div>
        </div>
      )}
      <div className="print-answer">
        ________________________________________________________________
      </div>
    </div>
  );
}
