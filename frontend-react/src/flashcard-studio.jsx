import SpacedReview from "./spaced-review";
import { useAnswerClock } from "./use-answer-clock";
import { PracticeModal } from "./practice-workspace";
import { useLearningSync, pendingLearning } from "./learning-sync";
import { useEffect, useRef, useState } from "react";
import { endpoint, useResource, readPreference, savePreference } from "./core";
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
} from "./ui";
import {
  TYPES,
  mix,
  sides,
  makeQuestion,
  checkQuestion,
  advanceProgress,
  nextLearningCard,
  createTest,
} from "./flashcard-engine";
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
    <Status error={resource.error}>Đang tải bộ thẻ…</Status>
  );
}
function Studio({ lang, id, userId, sound, data }) {
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
    if (running && options.mode === "learn" && elapsed >= options.minutes * 60)
      setRunning(false);
  }, [elapsed, options.minutes, running, options.mode]);
  useEffect(() => {
    const listener = (e) => {
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
  }, [index, order.length, options.mode, settingsOpen, resetLearning]);
  const speak = (text, voice) => {
    if (!window.speechSynthesis) {
      setError("Trình duyệt chưa hỗ trợ giọng đọc.");
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voice;
    u.rate = 0.9;
    u.onerror = () =>
      setError("Chưa có giọng đọc cho ngôn ngữ đã chọn trên trình duyệt này.");
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
    if (v.mode) {
      setStarted(0);
      setElapsed(0);
      setRunning(false);
      setQuestion(null);
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
  const chooseType = (card, records, t = 0) => {
    const p = records[card.id];
    if (options.goal === "comprehensive" && (p?.misses || p?.streak >= 2))
      return "written";
    const enabled = options.types.filter((t) => t !== "matching");
    return enabled[t % enabled.length] || "written";
  };
  const begin = () => {
    setError("");
    if (!pool.length) {
      setError("Không có thẻ phù hợp với bộ lọc.");
      return;
    }
    if (
      !options.types.filter((t) => options.mode === "test" || t !== "matching")
        .length
    ) {
      setError("Chọn ít nhất một dạng câu hỏi.");
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
  const submitLearn = (submittedValue = value) => {
    if (!question || feedback?.correct) return;
    const correct = checkQuestion(question, submittedValue, options),
      records = {
        ...progress,
        [question.id]: advanceProgress(
          progress[question.id],
          correct,
          question.type,
          turn,
          options.goal,
        ),
      };
    records[question.id].lastStudied = new Date().toLocaleDateString("en-CA");
    sync.enqueue("review", {
      deck: Number(id),
      card: question.id,
      correct,
      type: question.type,
      goal: options.goal,
      response_ms: questionTimers.current[question.id]?.() ?? null,
    });
    setProgress(records);
    setValue(submittedValue);
    setFeedback({ correct, expected: question.expected });
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
  const answerTest = (i, v, commit = false) => {
    if (Object.hasOwn(testChecked, i) || testResult) return;
    const answers = { ...testAnswers, [i]: v };
    setTestAnswers(answers);
    const q = test[i];
    const complete =
      q.type === "choice" ||
      q.type === "truefalse" ||
      (q.type === "matching" && q.left.every((l) => v?.[l.id])) ||
      (q.type === "written" && commit && String(v || "").trim());
    if (!complete) return;
    const correct = checkQuestion(q, v, options),
      checked = { ...testChecked, [i]: correct };
    setTestChecked(checked);
    const observed =
      q.type === "matching"
        ? q.left.map((item) => ({
            id: Number(item.id),
            correct:
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
        goal: options.goal,
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
        <div className="flash-mode-picker" aria-label="Chế độ học">
          {[
            ["flash", "cards", "Thẻ"],
            ["learn", "spark", "Học"],
            ["test", "exercise", "Kiểm tra"],
            ["review", "history", "Ôn đến hạn"],
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
            >{`Chỉ thẻ gắn sao · ${stars.length}`}</Btn>
            <Btn
              icon="shuffle"
              aria-pressed={options.shuffle}
              onClick={() => patch({ shuffle: !options.shuffle })}
            >
              Trộn thẻ
            </Btn>
            <Btn icon="settings" onClick={() => setSettingsOpen(true)}>
              Tùy chọn học
            </Btn>
            <Link
              className="btn flash-icon-link"
              title="Quản lý thuật ngữ"
              aria-label="Quản lý thuật ngữ"
              to={`/${lang}/flashcard/deck/${id}/edit`}
            >
              <Icon name="edit" />
            </Link>
            {options.mode !== "flash" && (
              <Btn primary icon={running ? "refresh" : "play"} onClick={begin}>
                {running ? "Tạo lại phiên học" : "Bắt đầu học"}
              </Btn>
            )}
            {options.mode === "test" && test.length > 0 && (
              <Btn icon="print" onClick={() => window.print()}>
                In đề / Lưu PDF
              </Btn>
            )}
          </div>
        )}
      </SidebarTools>
      {settingsOpen && (
        <PracticeModal
          title="Tùy chọn học"
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
              Chỉ thẻ gắn sao ({stars.length})
            </label>
            <label className="check-line">
              <input
                type="checkbox"
                checked={options.shuffle}
                onChange={(e) => patch({ shuffle: e.target.checked })}
              />
              Trộn ngẫu nhiên
            </label>
            {options.mode === "flash" ? (
              <>
                <Select
                  label="Mặt xuất hiện trước"
                  value={options.direction}
                  onChange={(direction) => patch({ direction })}
                >
                  <option value="front">Thuật ngữ</option>
                  <option value="back">Định nghĩa</option>
                  <option value="random">Ngẫu nhiên từng thẻ</option>
                </Select>
                <label className="check-line">
                  <input
                    type="checkbox"
                    checked={options.autoSpeak}
                    onChange={(e) => patch({ autoSpeak: e.target.checked })}
                  />
                  Tự động đọc âm thanh
                </label>
                {[
                  ["frontVoice", "Giọng mặt thuật ngữ"],
                  ["backVoice", "Giọng mặt định nghĩa"],
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
                      ["vi-VN", "Tiếng Việt"],
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
                  label="Trả lời bằng"
                  value={options.answerWith}
                  onChange={(answerWith) => patch({ answerWith })}
                >
                  <option value="term">
                    Thuật ngữ · Hiện định nghĩa trước
                  </option>
                  <option value="definition">
                    Định nghĩa · Hiện thuật ngữ trước
                  </option>
                  <option value="random">Cả hai · Ngẫu nhiên</option>
                </Select>
                <fieldset>
                  <legend>Dạng câu hỏi</legend>
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
                      label="Mục tiêu học"
                      value={options.goal}
                      onChange={(goal) => patch({ goal })}
                    >
                      <option value="quick">Cơ bản</option>
                      <option value="comprehensive">Học thông minh</option>
                    </Select>
                    <Field
                      label="Mục tiêu thời gian (phút)"
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
                      Đặt lại tiến độ học
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
                    Đọc thuật ngữ sau khi trả lời đúng
                  </label>
                )}
                <label className="check-line">
                  <input
                    type="checkbox"
                    checked={options.ignore_case}
                    onChange={(e) => patch({ ignore_case: e.target.checked })}
                  />
                  Bỏ qua hoa/thường
                </label>
                <label className="check-line">
                  <input
                    type="checkbox"
                    checked={options.ignore_punctuation}
                    onChange={(e) =>
                      patch({ ignore_punctuation: e.target.checked })
                    }
                  />
                  Bỏ qua dấu câu
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
        active ? (
          <div className="studio-flash">
            <Btn
              icon="star"
              className="star-button"
              aria-label={stars.includes(active.id) ? "Bỏ gắn sao" : "Gắn sao"}
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
            <div className="toolbar centered">
              <Btn
                icon="chevron_left"
                isDisabled={index === 0}
                onClick={() => step(-1)}
              >
                ← Trước
              </Btn>
              <span>
                {index + 1}/{order.length}
              </span>
              <Btn
                icon="chevron_right"
                isDisabled={index === order.length - 1}
                onClick={() => step(1)}
              >
                Tiếp →
              </Btn>
              <Btn icon="flip" onClick={() => setFlipped((v) => !v)}>
                Lật thẻ · Space
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
          <p>Không có thẻ phù hợp.</p>
        )
      ) : options.mode === "learn" ? (
        <>
          {completed && !running ? (
            <section className="learning-complete" role="status">
              <div className="learning-complete-icon" aria-hidden="true">
                🎉
              </div>
              <h2>Chúc mừng!</h2>
              <p>Bạn đã hoàn thành các thẻ cần học trong phiên này.</p>
              <Btn icon="refresh" primary onClick={begin}>
                Học lại
              </Btn>
            </section>
          ) : null}
          <p>
            Hôm nay đã luyện{" "}
            {
              pool.filter(
                (c) =>
                  progress[c.id]?.lastStudied ===
                  new Date().toLocaleDateString("en-CA"),
              ).length
            }
            /{pool.length} thẻ · {options.minutes} phút mục tiêu
          </p>
          <div className="learn-stages">
            {[
              ["new", "Chưa học"],
              ["familiar", "Quen thuộc"],
              ["mastered", "Đã thành thạo"],
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
                {String(elapsed % 60).padStart(2, "0")} / {options.minutes} phút
                · Lượt {turn + 1}
              </p>
              <Btn
                icon="star"
                className="star-button"
                aria-label={
                  stars.includes(question.id) ? "Bỏ gắn sao" : "Gắn sao"
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
                disabled={feedback?.correct}
              />
              <div className="session-controls">
                <Btn
                  primary
                  icon="arrow"
                  className="next-question"
                  aria-label="Câu tiếp theo"
                  title="Câu tiếp theo"
                  onClick={next}
                  isDisabled={!feedback?.correct}
                >
                  <span className="next-label">Tiếp tục</span>
                  <Icon name="arrow" />
                </Btn>
                <Btn
                  icon="close"
                  className="end-session"
                  aria-label="Kết thúc buổi học"
                  title="Kết thúc buổi học"
                  onClick={() => {
                    setRunning(false);
                    sync.flush();
                  }}
                >
                  <span aria-hidden="true">×</span>
                  <span>Kết thúc</span>
                </Btn>
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <>
          {!test.length ? (
            <section className="work-paper">
              <h2>Bài kiểm tra</h2>

              <Btn primary icon="play" onClick={begin}>
                Tạo đề
              </Btn>
            </section>
          ) : (
            <div className="print-test">
              <h2>{data.deck.title} · Bài kiểm tra</h2>
              <p className="print-only">
                Họ tên: ____________________ Ngày: ____________
              </p>
              {test.map((q, i) => (
                <section className="work-paper" key={`${q.id}:${i}`}>
                  <h3>
                    Câu {i + 1} · {TYPES.find(([k]) => k === q.type)?.[1]}
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
                </section>
              ))}
              {testResult ? (
                <section className="test-summary">
                  <div
                    role="img"
                    aria-label={`${testResult.filter(Boolean).length}/${test.length} câu đúng`}
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
                    {testResult.filter(Boolean).length}/{test.length} câu đúng
                  </h2>

                  <Btn icon="refresh" onClick={begin}>
                    Tạo đề mới
                  </Btn>
                </section>
              ) : null}
            </div>
          )}
        </>
      )}
      {resetLearning && (
        <Confirm
          title="Đặt lại tiến độ học?"
          description="Toàn bộ tiến độ đúng, sai và mức độ thành thạo của bộ thẻ này sẽ được xóa. Các dấu sao và tùy chọn học vẫn được giữ lại."
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
            Đáp án đề xuất: <strong>{q.proposed}</strong>
          </p>
          <div className="toolbar">
            <Btn
              className={answerClass(true, q.truth === true)}
              aria-pressed={value === true}
              isDisabled={disabled}
              onClick={() => onChange(true)}
            >
              Đúng
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
          label="Câu trả lời"
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
              aria-label="Kiểm tra câu trả lời"
              onClick={() => onCommit?.()}
            >
              ↵
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
