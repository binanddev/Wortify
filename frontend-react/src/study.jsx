import { gradeCard } from "./local-learning";
import { useEffect, useRef, useState } from "react";
import {
  endpoint,
  request,
  useResource,
  useAction,
  navigate,
  readPreference,
  savePreference,
  shuffled,
} from "./core";
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
} from "./ui";
export function Session({ lang, token, sound }) {
  const resource = useResource(endpoint(lang, `sessions/${token}/`));
  return (
    <Loading resource={resource}>
      {(data) => <SessionContent initial={data} {...{ lang, token, sound }} />}
    </Loading>
  );
}
function SessionContent({ initial, lang, token, sound }) {
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
  useEffect(() => {
    if (!synced) savePreference(draftKey, answers);
  }, [answers, synced, draftKey]);
  const sync = async (signal) => {
    await request(
      endpoint(lang, `sessions/${token}/finish/`),
      "POST",
      { answers },
      signal,
    );
    setSynced(true);
    savePreference(draftKey, {});
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
  }, [session, feedback, next]);
  const title = {
    flash: "Thẻ ghi nhớ",
    learn: "Học",
    test: "Kiểm tra",
  }[session.kind];
  return (
    <Page>
      <Link
        className="breadcrumb"
        to={
          session.deck
            ? `/${lang}/flashcard/deck/${session.deck}`
            : `/${lang}/flashcard`
        }
      >
        ← Trở về bộ thẻ
      </Link>
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
            ? "Hoàn thành tất cả câu hỏi rồi nộp bài. Đáp án được giữ kín đến lúc đó."
            : "Không cần vội. Hãy nhớ lại trước khi xem đáp án."
        }
      />
      <div className="session-width">
        <div className="section-heading">
          <span>Tiến độ buổi học</span>
          <strong>
            {session.completed} / {session.total}
          </strong>
        </div>
        <progress value={session.completed} max={session.total} />
        {session.result && !(session.kind === "test" && session.questions) ? (
          <>
            <Glass className="result-summary">
              <Icon name="check" size={36} />
              <h2>Buổi học đã hoàn thành</h2>
              <div className="result-number">
                {session.result.correct}
                <span> / {session.result.total}</span>
              </div>
              <p>câu đã ghi nhớ</p>
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
                  Luyện lại từ chưa nhớ <Icon name="arrow" />
                </Btn>
              )}
            </Glass>
            {session.result.rows.map((r, i) => (
              <Glass key={i}>
                <strong>
                  {i + 1}. {r.target}
                </strong>
                <p>
                  Bạn trả lời:{" "}
                  {r.answer === "remember"
                    ? "Đã nhớ"
                    : r.answer === "again"
                      ? "Cần ôn"
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
              setSession({
                ...session,
                completed: session.total,
                result: summarizeLocal(session.questions, answers),
              });
            }}
          >
            {session.questions.map((question, i) => (
              <Glass key={question.token}>
                <span className="eyebrow">CÂU {i + 1}</span>
                <h2 className="question-text">{question.prompt}</h2>
                <Answer
                  question={question}
                  value={answers[question.token] || ""}
                  onChange={(v) =>
                    setAnswers({ ...answers, [question.token]: v })
                  }
                  disabled={action.pending || !!session.result}
                />
                <Feedback row={session.result?.rows[i]} />
              </Glass>
            ))}
            {session.result ? (
              <Glass className="result-summary">
                <h2>
                  {session.result.correct} / {session.result.total} câu đúng
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
                    Luyện lại từ chưa nhớ
                  </Btn>
                )}
              </Glass>
            ) : (
              <Btn
                primary
                type="submit"
                isLoading={action.pending}
                isDisabled={
                  Object.values(answers).filter((v) => v.trim()).length !==
                  session.total
                }
              >
                Nộp toàn bài ·{" "}
                {Object.values(answers).filter((v) => v.trim()).length}/
                {session.total} câu
              </Btn>
            )}
          </form>
        ) : q ? (
          <div key={q.token}>
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
                    Nghe từ
                  </Btn>
                  {!feedback &&
                    (!flipped ? (
                      <Btn primary onClick={() => setFlipped(true)}>
                        Lật thẻ <Icon name="flip" />
                      </Btn>
                    ) : (
                      <>
                        <Btn
                          isDisabled={action.pending}
                          onClick={() => send("again")}
                        >
                          ↻ Cần ôn lại
                        </Btn>
                        <Btn
                          primary
                          isLoading={action.pending}
                          onClick={() => send("remember")}
                        >
                          ✓ Đã nhớ
                        </Btn>
                      </>
                    ))}
                </div>
              </>
            ) : (
              <Glass>
                <span className="eyebrow">
                  CÂU {session.completed + 1} ·{" "}
                  {q.mode === "quiz" ? "CHỌN NGHĨA ĐÚNG" : "VIẾT TỪ TƯƠNG ỨNG"}
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
                    onChange={v=>{setAnswer(v);if(q.options?.length)send(v);}}
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
                      Kiểm tra <Icon name="arrow" />
                    </Btn>
                  )}
                </form>
              </Glass>
            )}
            <Feedback row={feedback} />
            {feedback && (
              <Btn primary onClick={continueSession}>
                {next?.result ? "Xem tổng kết" : "Tiếp tục"}{" "}
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
      label="Chọn đáp án"
      graded={!!feedback}
      correctAnswer={question.mode==='quiz'?question.card.vietnamese_meaning:question.target}
    />
  ) : (
    <Field
      label="Câu trả lời của bạn"
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
      {(pack) => <LocalPractice {...{ pack, lang, params, sound }} />}
    </Loading>
  );
}
function LocalPractice({ pack, lang, params, sound }) {
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
        throw new Error("Trình duyệt chưa hỗ trợ ghi âm.");
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
  const check = (submitted = answer) => {
    if (mode === "match") {
      const rows = group.map((v) => ({
        is_correct: submitted[String(v.id)] === String(v.id),
        term: v.german_text,
        meaning: v.vietnamese_meaning,
      }));
      setResult({
        rows,
        correct: rows.filter((v) => v.is_correct).length,
        total: rows.length,
      });
    } else {
      const actual =
        mode === "order"
          ? submitted.map((id) => items.find((t) => t.id === id)?.text).join(" ")
          : submitted;
      setResult(
        gradeCard(
          {
            mode: mode === "quiz" ? "quiz" : "write",
            target,
            meaning: c.vietnamese_meaning,
            card: c,
            alternatives: example ? c.accepted_examples : c.accepted_answers,
            grading: pack.grading,
          },
          actual,
        ),
      );
    }
    audio.tick();
  };
  return (
    <Page>
      <Link
        to={deck ? `/${lang}/flashcard/deck/${deck}` : `/${lang}/flashcard`}
      >
        ← Bộ thẻ
      </Link>
      <Heading
        title={
          {
            write: "Viết để nhớ lâu",
            quiz: "Chọn nghĩa đúng",
            spell: "Nghe và viết",
            order: "Sắp xếp từ",
            match: "Nối cặp",
            speak: "Luyện phát âm",
          }[mode] || "Luyện tập"
        }
      />
      <div className="session-width">
        <Status error={action.error} />
        {!c ? (
          <Glass>
            <h2>Đã hoàn thành</h2>
          </Glass>
        ) : (
          <Glass>
            <p>
              {index + 1}/{cards.length}
            </p>
            <h2>
              {mode === "spell"
                ? "Nghe rồi nhập từ bạn nghe được"
                : mode === "quiz" || mode === "speak"
                  ? target
                  : example
                    ? c.example_vietnamese
                    : c.vietnamese_meaning}
            </h2>
            {["spell", "speak"].includes(mode) && (
              <Btn onClick={() => audio.speak(target)}>Nghe mẫu</Btn>
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
                  {recording ? "Dừng thu" : "Thu âm"}
                </Btn>
                {recordUrl && <audio controls src={recordUrl} />}
                <Btn
                  isDisabled={recording}
                  onClick={() =>
                    setResult({ is_correct: true, target, card: c })
                  }
                >
                  Đã luyện xong
                </Btn>
              </>
            ) : mode === "quiz" ? (
              <LocalChoices
                key={index}
                options={options}
                answer={answer}
                setAnswer={v=>{setAnswer(v);check(v);}}
                correctAnswer={c.vietnamese_meaning}
                disabled={!!result}
              />
            ) : (
              <Field
                label="Câu trả lời"
                value={answer}
                onChange={setAnswer}
                isDisabled={!!result}
              />
            )}
            {!result && mode !== "speak" && mode !== "quiz" && (
              <Btn primary onClick={()=>check()}>
                Kiểm tra
              </Btn>
            )}
            {result && (
              <>
                {mode === "match" ? (
                  <Status>
                    {result.correct}/{result.total} cặp đúng
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
                  onClick={() => {
                    setIndex((i) => i + (mode === "match" ? group.length : 1));
                    setAnswer(
                      mode === "order" ? [] : mode === "match" ? {} : "",
                    );
                    setResult(null);
                    setRecordUrl("");
                  }}
                >
                  Tiếp tục
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
        throw new Error("Trình duyệt chưa hỗ trợ thu âm.");
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
            action.setError("Bản thu vượt 10 MB. Hãy thu lại ngắn hơn.");
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
      <p>Bản thu tạm, tối đa 60 giây. Kết quả đánh giá nội dung nhận dạng.</p>
      <Btn onClick={recording ? stop : start} isLoading={action.pending}>
        {recording ? "■ Dừng thu" : "● Bắt đầu thu âm"}
      </Btn>
      {url && <audio controls src={url} />}
      <label className="check-line">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        Tôi đồng ý gửi bản thu đến dịch vụ nhận dạng khi bấm gửi.
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
              throw new Error(r.error || "Chưa nhận dạng rõ. Hãy thu lại.");
            onResult(r.result);
            setBlob(null);
            setUrl("");
          })
        }
      >
        Gửi kiểm tra
      </Btn>
      <Status error={action.error} />
    </div>
  );
}
