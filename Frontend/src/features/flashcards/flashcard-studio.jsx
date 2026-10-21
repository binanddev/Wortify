import CardImage from "./card-image.jsx";
import CardManager from "./card-manager.jsx";
import { studyCards, sourceCardId, isExample, termProgress } from "./flashcard-engine.js";
import ContentSwitcher from "../../components/navigation/content-switcher.jsx";
import { t as tr, useLocale } from "../../i18n/index.js";
import QuickCardEditor from "./quick-card-editor.jsx";
import { useWindowActive } from "../../lib/core.js";
import { SkipButton, AnswerReveal } from "../learning/skip-controls.jsx";
import { cardSolution } from "../learning/skip-learning.js";
import { useAnswerClock } from "../learning/use-answer-clock.js";
import { PracticeModal } from "../practice/practice-workspace.jsx";
import { useLearningSync, pendingLearning } from "../learning/learning-sync.js";
import { useEffect, useRef, useState, lazy, Suspense } from "react";
const FlashcardDefense = lazy(() => import("./defense/GameFrame.jsx"));
import {
  endpoint,
  useResource,
  useRoute,
  readPreference,
  savePreference,
} from "../../lib/core.js";
import {
  Btn,
  Icon,
  Field,
  Select,
  Page,
  Heading,
  SidebarTools,
  Status,
  Confirm,
  FlipCard,
  Choice,
  Matching,
  useSound,
} from "../../components/ui/ui.jsx";
import {
  TYPES,
  makeQuestion,
  checkQuestion,
  advanceProgress,
  nextLearningCard,
  createTest,
} from "./flashcard-engine.js";
const defaults = {
  mode: "flash",
  shuffle: false,
  includeExamples: false,
  showExampleAfterAnswer: false,
  exampleOrder: "after",
  exampleDirection: "front",
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
  useLocale();
  const resource = useResource(endpoint(lang, `decks/${id}/`));
  return resource.data ? (
    <Studio
      key={`${userId}:${lang}:${id}`}
      {...{ lang, id, userId, sound }}
      data={resource.data}
    />
  ) : (
    <Status error={resource.error}>{tr("Loading deck…")}</Status>
  );
}
function Studio({ lang, id, userId, sound, data: initialData }) {
  useLocale();
  const [data, setData] = useState(initialData);
  const [editingCard, setEditingCard] = useState(null);
  const [managingCards,setManagingCards]=useState(false);
  const route = useRoute();
  const requestedMode = new URLSearchParams(route.split("?")[1]).get("mode");
  const windowActive = useWindowActive();
  const sync = useLearningSync(userId, lang);
  const [{ initialStars, initialProgress, initialOptions }] = useState(() => {
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
    return { initialStars, initialProgress, initialOptions };
  });
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
    mode: ["flash","learn","test"].includes(requestedMode) ? requestedMode : ["flash","learn","test"].includes(initialOptions.mode) ? initialOptions.mode : "flash",
    frontVoice:
      initialOptions.frontVoice || (lang === "de" ? "de-DE" : "en-US"),
  }));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [defenseOpen,setDefenseOpen]=useState(false);
  const [stars, setStars] = useState(() => [...initialStars]),
    [progress, setProgress] = useState(() => initialProgress);
  const [order, setOrder] = useState(() => studyCards(data.cards, options)),
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
  const [flashRevealed, setFlashRevealed] = useState(false);
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
  function cardUpdated(updated) {
    const cards = data.cards.map(c => c.id === updated.id ? updated : c);
    setData(old => ({ ...old, cards }));
    const queue = studyCards(cards, options);
    setOrder(queue);
    setSessionCards(queue);
    const refresh = q => makeQuestion(queue.find(c => c.id === q.card.id) || q.card, q.type, queue,
      q.expected === q.card.german_text ? "term" : "definition");
    if (question) {
      const stillPresent=queue.some(c=>c.id===question.id);
      setQuestion(stillPresent?refresh(question):null);
      if(!stillPresent)setRunning(false);
      setValue("");
      setFeedback(null);
    }
    if (test.length) {
      // Distractors and matching groups can reference any card in the deck.
      setTest(test.filter(q=>queue.some(c=>c.id===q.id)).map(refresh));
      setTestAnswers({});
      setTestChecked({});
      setTestSkipped({});
      setTestResult(null);
    }
  }
  const questionTimers = useRef({});
  const audio = useSound(sound, lang),
    startSides = useRef({});
  const pool = data.cards.filter(
    (c) => !options.starredOnly || stars.includes(sourceCardId(c)),
  );
  const active = order[index];
  const flashClock = useAnswerClock(
    active?.id,
    options.mode === "flash" && !flashSkipped,
  );
  useEffect(() => { setFlashSkipped(false); setFlashRevealed(false); }, [active?.id, options.direction]);
  useEffect(() => savePreference(`${key}:options`, options), [options, key]);
  useEffect(() => savePreference(`${key}:stars`, stars), [stars, key]);
  useEffect(() => savePreference(`${key}:progress`, termProgress(progress)), [progress, key]);
  useEffect(() => {
    if (options.mode !== "flash") return;
    setOrder(studyCards(pool, options));
    setFlashEnded(false);
    setIndex(0);
    startSides.current = {};
  }, [options.shuffle, options.starredOnly, options.mode, options.includeExamples, options.exampleOrder, options.exampleDirection, options.starredOnly ? stars : null, data.cards]);
  useEffect(() => {
    if (!active) return;
    startSides.current[active.id] ??= Math.random() > 0.5;
    const direction=isExample(active)?options.exampleDirection:options.direction;
    setFlipped(
      direction === "back" ||
        (direction === "random" && startSides.current[active.id]),
    );
  }, [active?.id, options.direction, options.exampleDirection]);
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
      if (document.querySelector('[role="dialog"]')) return;
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
        setFlipped((v) => !v); setFlashRevealed(true);
      }
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [
    windowActive,
    index,
    order.length,
    options.mode,
    settingsOpen,
    resetLearning,
  ]);
  const speak = (text, voice) => {
    if (!window.speechSynthesis) {
      setError("This browser does not support speech synthesis.");
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voice;
    u.rate = 0.9;
    u.onerror = (event) => {
      if (!["canceled", "interrupted"].includes(event.error))
        setError(
          "Could not play pronunciation. Check the voice selected in settings.",
        );
    };
    window.speechSynthesis.resume();
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
    if (v.mode || v.types || v.answerWith || v.goal || "includeExamples" in v || v.exampleOrder || v.exampleDirection || "shuffle" in v || "starredOnly" in v) {
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
  const star = (item) => {
    const card={id:sourceCardId(item)};
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
    const cards = studyCards(pool, options);
    setProgress(previous=>termProgress(previous));
    setSessionCards(cards);
    setTurn(0);
    setFeedback(null);
    setValue("");
    setElapsed(0);
    setStarted(Date.now());
    setRunning(true);
    setCompleted(false);
    if (options.mode === "test") {
      setTest(createTest(pool, cards.length, options.types, options.answerWith, Math.random, options));
      setTestSkipped({});
      setTestAnswers({});
      setTestChecked({});
      setTestResult(null);
    } else {
      const card = nextLearningCard(cards, termProgress(progress), 0, undefined, options);
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
    if(isExample(question.card)) records[question.id].stage="mastered";
    if(!isExample(question.card)) sync.enqueue("review", {
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
        speak(question.card.german_text, options.frontVoice);
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
    if (sessionCards.every((c) => nextProgress[c.id]?.stage === "mastered") && !(options.includeExamples && options.exampleOrder === "after" && !isExample(question.card) && sessionCards.some(c=>c.sourceCardId===question.id))) {
      setRunning(false);
      setCompleted(true);
      audio.applause();
      return;
    }
    const c = nextLearningCard(sessionCards, progress, t, question?.id, options);
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
    observed.filter(item=>Number.isFinite(Number(item.id))).forEach((item) =>
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
      sync.enqueue("test", { deck: Number(id), results:results.filter((_,i)=>!isExample(test[i].card)) });
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
    <Page className="flashcard-workspace">
      <Heading title={data.deck.title} />
      {defenseOpen && <Suspense fallback={<Status>{tr("Loading game…")}</Status>}><FlashcardDefense lang={lang} userId={userId} initialDeck={{...data,learning:{...data.learning,progress}}} onClose={()=>setDefenseOpen(false)}/></Suspense>}
      <SidebarTools>
        <div className="flash-icon-row">
          <ContentSwitcher lang={lang} kind="decks" currentId={id}/>
          <Btn icon="manage" onClick={()=>setManagingCards(true)}>{tr("Manage cards")}</Btn>
        </div>
        <Status error={sync.error} />
        <div className="flash-mode-picker" aria-label={tr("Study mode")}>
          {[
            ["flash", "cards", "Card"],
            ["learn", "learn", "Study"],
            ["test", "exercise", "Check"],
            ["defense", "game", "Game"],
          ].map(([mode, icon, label]) => (
            <button
              key={mode}
              aria-pressed={options.mode === mode}
              onClick={() => {
                setSettingsOpen(false);
                setRunning(false);
                if(mode==="defense"){setDefenseOpen(true);return;}
                patch({ mode });
              }}
            >
              <Icon name={icon} />
              <span>{tr(label)}</span>
            </button>
          ))}
        </div>
        {(
          <div className="flash-icon-row">
            <Btn
              icon="star"
              aria-pressed={options.starredOnly}
              onClick={() => patch({ starredOnly: !options.starredOnly })}
            >{tr("Starred cards only · {v0}", { v0: stars.length })}</Btn>
            <Btn
              icon="shuffle"
              aria-pressed={options.shuffle}
              onClick={() => patch({ shuffle: !options.shuffle })}
            >{tr("Shuffle cards")}</Btn>
            <Btn icon="settings" onClick={() => setSettingsOpen(true)}>{tr("Study options")}</Btn>

            {options.mode !== "flash" && (
              <Btn primary icon={running ? "refresh" : "play"} onClick={begin}>
                {running ? tr("Restart session") : tr("Start learning")}
              </Btn>
            )}
            {options.mode === "test" && test.length > 0 && (
              <Btn icon="print" onClick={() => window.print()}>{tr("Print / Save PDF")}</Btn>
            )}
          </div>
        )}
      </SidebarTools>
      {settingsOpen && (
        <PracticeModal
          title={tr("Study options")}
          size="lg"
          onClose={() => setSettingsOpen(false)}
        >
          <div className="flash-settings">
            <label className="check-line"><input type="checkbox" checked={options.includeExamples} onChange={e=>patch({includeExamples:e.target.checked})}/>{tr("Study example sentences")}</label>
            {!options.includeExamples && <label className="check-line"><input type="checkbox" checked={options.showExampleAfterAnswer} onChange={e=>patch({showExampleAfterAnswer:e.target.checked})}/>{tr("Show example and translation after answering")}</label>}
            {options.includeExamples && <>
              <Select label={tr("Example order")} value={options.exampleOrder} onChange={exampleOrder=>patch({exampleOrder})}>
                <option value="after">{tr("After its term")}</option><option value="mixed">{tr("Mixed with terms")}</option>
              </Select>
              <Select label={tr("Example first side")} value={options.exampleDirection} onChange={exampleDirection=>patch({exampleDirection})}>
                <option value="front">{tr("Example sentence")}</option><option value="back">{tr("Sentence translation")}</option>
              </Select>
            </>}
            <label className="check-line">
              <input
                type="checkbox"
                checked={options.starredOnly}
                onChange={(e) => patch({ starredOnly: e.target.checked })}
              />{tr("Starred cards only (")}{stars.length})
            </label>
            <label className="check-line">
              <input
                type="checkbox"
                checked={options.shuffle}
                onChange={(e) => patch({ shuffle: e.target.checked })}
              />{tr("Shuffle randomly")}</label>
            {options.mode === "flash" ? (
              <>
                <Select
                  label={tr("First side shown")}
                  value={options.direction}
                  onChange={(direction) => patch({ direction })}
                >
                  <option value="front">{tr("Term")}</option>
                  <option value="back">{tr("Definition")}</option>
                  <option value="random">{tr("Random for each card")}</option>
                </Select>
                <label className="check-line">
                  <input
                    type="checkbox"
                    checked={options.autoSpeak}
                    onChange={(e) => patch({ autoSpeak: e.target.checked })}
                  />{tr("Play audio automatically")}</label>
                {[
                  ["frontVoice", "Term voice"],
                  ["backVoice", "Definition voice"],
                ].map(([k, label]) => (
                  <Select
                    key={k}
                    label={tr(label)}
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
                  label={tr("Answer with")}
                  value={options.answerWith}
                  onChange={(answerWith) => patch({ answerWith })}
                >
                  <option value="term">{tr("Term · Show the definition first")}</option>
                  <option value="definition">{tr("Definition · Show the term first")}</option>
                  <option value="random">{tr("Both · Random")}</option>
                </Select>
                <fieldset>
                  <legend>{tr("Question type")}</legend>
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
                      {tr(title)}
                    </label>
                  ))}
                </fieldset>
                {options.mode === "learn" && (
                  <>
                    <Select
                      label={tr("Learning goal")}
                      value={options.goal}
                      onChange={(goal) => patch({ goal })}
                    >
                      <option value="quick">{tr("Basic")}</option>
                      <option value="comprehensive">{tr("Smart learning")}</option>
                    </Select>
                    <Field
                      label={tr("Time target (minutes)")}
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
                    >{tr("Reset learning progress")}</Btn>
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
                    />{tr("Read the term aloud after a correct answer")}</label>
                )}
                <label className="check-line">
                  <input
                    type="checkbox"
                    checked={options.ignore_case}
                    onChange={(e) => patch({ ignore_case: e.target.checked })}
                  />{tr("Ignore case")}</label>
                <label className="check-line">
                  <input
                    type="checkbox"
                    checked={options.ignore_punctuation}
                    onChange={(e) =>
                      patch({ ignore_punctuation: e.target.checked })
                    }
                  />{tr("Ignore punctuation")}</label>
              </>
            )}
          </div>
        </PracticeModal>
      )}
      <Status error={error} />
      {managingCards && <CardManager lang={lang} deckId={id} cards={data.cards}
        onClose={()=>setManagingCards(false)} onUpdated={cardUpdated}
        onCardsChanged={cards=>{
          setData(old=>({...old,cards}));
          setOrder(studyCards(cards,options)); setIndex(0);
          setRunning(false); setQuestion(null); setFeedback(null); setCompleted(false);
          setSessionCards([]); setTest([]); setTestAnswers({}); setTestChecked({}); setTestResult(null);
        }}/>}
      {editingCard && <QuickCardEditor card={editingCard} lang={lang} deckId={id}
        notice={options.mode === "test" ? tr("Saving refreshes this test and clears its answers because choices may have changed.") : undefined}
        onClose={() => setEditingCard(null)} onSaved={cardUpdated} />}
      {options.mode === "flash" && active && !flashEnded && <Btn onClick={() => setEditingCard(data.cards.find(c=>c.id===sourceCardId(active)))}>{tr("Edit card")}</Btn>}
      {options.mode === "learn" && question && <Btn onClick={() => setEditingCard(data.cards.find(c=>c.id===sourceCardId(question.card)))}>{tr("Edit card")}</Btn>}
      {options.mode === "flash" ? (
        flashEnded ? (
          <section className="work-paper">
            <h2>{tr("All cards reviewed")}</h2>
            <Btn
              icon="refresh"
              onClick={() => {
                setFlashEnded(false);
                setIndex(0);
                setFlashSkipped(false);
              }}
            >{tr("Review")}</Btn>
          </section>
        ) : active ? (
          <div className="studio-flash" ref={flashClock.root}>
            <Btn
              icon="star"
              className="star-button"
              aria-label={stars.includes(sourceCardId(active)) ? tr("Unstar") : tr("Star")}
              aria-pressed={stars.includes(sourceCardId(active))}
              onClick={() => star(active)}
            >
              {stars.includes(sourceCardId(active)) ? "★" : "☆"}
            </Btn>
            <FlipCard
              front={active.german_text}
              back={active.vietnamese_meaning}
              example={null}
              image={!isExample(active)?active:null}
              flipped={flipped}
              setFlipped={(v) => {
                setFlipped(v);
                setFlashRevealed(true);
                audio.tick();
              }}
            />
            <ExampleFeedback card={active} options={options} revealed={flashRevealed || flashSkipped}/>
            <div className="toolbar flashcard-actions flashcard-review-controls">
              {flashSkipped ? (
                <Btn
                  icon="arrow"
                  primary
                  onClick={() => {
                    if (index === order.length - 1) setFlashEnded(true);
                    else step(1);
                  }}
                >{tr("Continue")}</Btn>
              ) : (
                <SkipButton
                  onClick={() => {
                    setFlashSkipped(true);
                    setFlipped(true);
                    if(!isExample(active)) sync.enqueue("review", {
                      deck: Number(id),
                      card: active.id,
                      correct: false,
                      type: "flash",
                      rating: 1,
                      response_ms: flashClock.read(),
                      goal: learningGoal,
                    });
                    if(!isExample(active)) setProgress((previous) => ({
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
              >{tr("← Previous")}</Btn>
              <span>
                {index + 1}/{order.length}
              </span>
              <Btn
                icon="chevron_right"
                isDisabled={index === order.length - 1}
                onClick={() => step(1)}
              >{tr("Next →")}</Btn>
              <Btn icon="flip" onClick={() => {setFlipped((v) => !v); setFlashRevealed(true);}}>{tr("Flip card · Space")}</Btn>
              <Btn
                icon="sound"
                onClick={() =>
                  speak(
                    flipped ? active.vietnamese_meaning : active.german_text,
                    flipped ? options.backVoice : options.frontVoice,
                  )
                }
              >{tr("Nghe")}</Btn>
            </div>
          </div>
        ) : (
          <p>{tr("No matching cards.")}</p>
        )
      ) : options.mode === "learn" ? (
        <>
          {completed && !running ? (
            <section className="learning-complete" role="status">
              <div className="learning-complete-icon" aria-hidden="true">
                🎉
              </div>
              <h2>{tr("Congratulations!")}</h2>
              <p>{tr("You have completed all cards in this session.")}</p>
              <Btn icon="refresh" primary onClick={begin}>{tr("Study again")}</Btn>
            </section>
          ) : null}
          <p>{tr("Practiced today")}{" "}
            {
              pool.filter(
                (c) =>
                  progress[c.id]?.lastStudied ===
                  new Date().toLocaleDateString("en-CA"),
              ).length
            }
            /{pool.length}{tr(" cards · ")}{options.minutes}{tr(" target minutes")}</p>
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
                {String(elapsed % 60).padStart(2, "0")} / {options.minutes}{" "}{tr("minutes · Round ")}{turn + 1}
              </p>
              <Btn
                icon="star"
                className="star-button"
                aria-label={stars.includes(sourceCardId(question.card)) ? tr("Unstar") : tr("Star")}
                aria-pressed={stars.includes(sourceCardId(question.card))}
                onClick={() => star(question.card)}
              >
                {stars.includes(sourceCardId(question.card)) ? "★" : "☆"}
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
              <ExampleFeedback card={question.card} options={options} revealed={!!feedback}/>
              {feedback?.skipped && (
                <AnswerReveal answers={cardSolution(question)} />
              )}
              <div className="session-controls">
                <Btn
                  icon="close"
                  className="end-session"
                  aria-label={tr("End session")}
                  title={tr("End session")}
                  onClick={() => {
                    setRunning(false);
                    sync.flush();
                  }}
                >
                  <Icon name="close" />
                  <span>{tr("Finish")}</span>
                </Btn>
                <div className="flashcard-actions">
                  {!feedback?.correct && !feedback?.skipped && (
                    <SkipButton onClick={() => submitLearn("", true)} />
                  )}
                  <Btn
                    primary
                    icon="arrow"
                    className="next-question"
                    aria-label={tr("Next question")}
                    title={tr("Next question")}
                    onClick={next}
                    isDisabled={!feedback?.correct && !feedback?.skipped}
                  >
                    <span className="next-label">{tr("Continue")}</span>
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
              <h2>{tr("Test")}</h2>

              <Btn primary icon="play" onClick={begin}>{tr("Generate test")}</Btn>
            </section>
          ) : (
            <div className="print-test">
              <h2>{data.deck.title}{tr(" · Test")}</h2>
              <p className="print-only">{tr("Name: ____________________ Date: ____________")}</p>
              {test.map((q, i) => (
                <section
                  className="work-paper"
                  id={`studio-test-${i}`}
                  tabIndex={-1}
                  key={`${q.id}:${i}`}
                >
                  <h3>{tr("Question ")}{i + 1} · {tr(TYPES.find(([k]) => k === q.type)?.[1])}
                  </h3>
                  <Btn onClick={() => setEditingCard(data.cards.find(c=>c.id===sourceCardId(q.card)))}>{tr("Edit card")}</Btn>
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
                  <ExampleFeedback card={q.card} options={options} revealed={Object.hasOwn(testChecked,i)}/>
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
                        >{tr("Continue")}</Btn>
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
                    aria-label={tr("{v0}/{v1} correct answers", { v0: testResult.filter(Boolean).length, v1: test.length })}
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
                    {testResult.filter(Boolean).length}/{test.length}{tr(" correct answers")}</h2>

                  <Btn icon="refresh" onClick={begin}>{tr("Generate new test")}</Btn>
                </section>
              ) : null}
            </div>
          )}
        </>
      )}
      {resetLearning && (
        <Confirm
          title={tr("Reset learning progress?")}
          description={tr("All accuracy and mastery progress for this deck will be cleared. Stars and study preferences will be kept.")}
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
  useLocale();
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
      {!isExample(q.card)&&q.type!=="matching"&&(q.prompt===q.card.vietnamese_meaning||checked)&&<CardImage card={q.card}/>}
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
          <p>{tr("Suggested answer: ")}<strong>{q.proposed}</strong>
          </p>
          <div className="toolbar">
            <Btn
              className={answerClass(true, q.truth === true)}
              aria-pressed={value === true}
              isDisabled={disabled}
              onClick={() => onChange(true)}
            >{tr("Correct")}</Btn>
            <Btn
              className={answerClass(false, q.truth === false)}
              aria-pressed={value === false}
              isDisabled={disabled}
              onClick={() => onChange(false)}
            >{tr("Sai")}</Btn>
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
          label={tr("Answer")}
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
              aria-label={tr("Check answer")}
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

function ExampleFeedback({card,options,revealed}) {
  if (!revealed || !options.showExampleAfterAnswer || options.includeExamples || isExample(card) || !card?.example_german) return null;
  return <div className="answer-reveal" aria-live="polite"><p>{card.example_german}</p>{card.example_vietnamese && <p className="muted">{card.example_vietnamese}</p>}</div>;
}
