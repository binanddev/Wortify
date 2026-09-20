import { useEffect, useRef, useState } from "react";
import { endpoint, request, useResource, useAction, navigate } from "./core";
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
  const [session, setSession] = useState(initial),
    [feedback, setFeedback] = useState(null),
    [next, setNext] = useState(null),
    [answer, setAnswer] = useState(""),
    [answers, setAnswers] = useState({}),
    [flipped, setFlipped] = useState(false);
  const action = useAction(),
    audio = useSound(sound, lang);
  const q = session.question;
  const send = (value) =>
    action.run(async (signal) => {
      const result = await request(
        endpoint(lang, `sessions/${token}/answer/`),
        "POST",
        { question: q.token, answer: value },
        signal,
      );
      setFeedback(result.feedback);
      setNext(result.session);
      audio.tick();
    });
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
    flash: "Nhìn. Nhớ. Khám phá.",
    learn: "Mỗi câu, một bước tiến.",
    test: "Đến lúc thử sức.",
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
              <p>câu đã ghi nhớ. Bạn đã dành thời gian cho chính mình.</p>
              {session.result.correct < session.result.total && (
                <Btn
                  primary
                  isLoading={action.pending}
                  onClick={() =>
                    action.run(async (s) => {
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
              action.run(async (signal) => {
                const completed = await request(
                  endpoint(lang, `sessions/${token}/finish/`),
                  "POST",
                  { answers },
                  signal,
                );
                setSession({ ...completed, questions: session.questions });
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
                <p>Đã lưu kết quả và đáp án của bạn.</p>
                {session.result.correct < session.result.total && (
                  <Btn
                    onClick={() =>
                      action.run(async (s) => {
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
                    onChange={setAnswer}
                    disabled={!!feedback || action.pending}
                  />
                  {!feedback && (
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
function Answer({ question, value, onChange, disabled }) {
  return question.options?.length ? (
    <Choice
      options={question.options}
      value={value}
      onChange={onChange}
      disabled={disabled}
      label="Chọn đáp án"
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
export function ExtraStudy({ lang, params, sound }) {
  const mode = params.get("mode") || "write",
    deck = params.get("deck"),
    filter = params.get("filter") || "all";
  const [data, setData] = useState(null),
    [index, setIndex] = useState(0),
    [answer, setAnswer] = useState(""),
    [result, setResult] = useState(null);
  const action = useAction(),
    audio = useSound(sound, lang),
    player = useRef(null);
  const load = (signal) =>
    request(
      endpoint(lang, mode === "match" ? `match/${deck}/new/` : "next/"),
      "POST",
      mode === "match"
        ? { wrong_only: filter === "weak" }
        : { mode, deck, filter, index, target: params.get("target") || "term" },
      signal,
    ).then((d) => {
      setData(d);
      setAnswer(mode === "match" ? {} : mode === "order" ? [] : "");
      setResult(d.completed ? d.result : null);
    });
  useEffect(() => {
    const c = new AbortController();
    load(c.signal).catch((e) => {
      if (e.name !== "AbortError") action.setError(e.message);
    });
    return () => {
      c.abort();
      player.current?.pause();
      window.speechSynthesis?.cancel();
    };
  }, [index]);
  const listen = () =>
    action.run(async (s) => {
      const d = await request(
        endpoint(lang, `audio/${data.token}/`),
        "POST",
        {},
        s,
      );
      if (d.url) {
        player.current?.pause();
        player.current = new Audio(d.url);
        await player.current.play();
      } else audio.speak(d.text || data.target);
    });
  return (
    <Page>
      <Link className="breadcrumb" to={`/${lang}/flashcard/deck/${deck}`}>
        ← Bộ thẻ
      </Link>
      <Heading
        eyebrow="LUYỆN TẬP"
        title={
          {
            write: "Viết để nhớ lâu.",
            quiz: "Tìm nghĩa phù hợp.",
            spell: "Lắng nghe từng từ.",
            order: "Đặt từ vào đúng chỗ.",
            match: "Tìm những cặp đồng điệu.",
            speak: "Tự tin cất tiếng.",
          }[mode] || "Luyện tập"
        }
        description="Phản hồi ngay tại chỗ. Bạn quyết định khi nào chuyển tiếp."
      />
      <div className="session-width">
        <Status error={action.error} />
        {!data ? (
          <Btn onClick={() => action.run(load)} isLoading={action.pending}>
            Tải bài luyện
          </Btn>
        ) : data.done ? (
          <Status>{data.message}</Status>
        ) : (
          <Glass>
            <h2 className="question-text">{data.prompt || data.target}</h2>
            {mode === "match" ? (
              <Matching
                {...data}
                value={answer}
                onChange={setAnswer}
                disabled={!!result || action.pending}
              />
            ) : mode === "order" ? (
              <WordOrder
                items={data.items}
                value={answer}
                onChange={setAnswer}
                disabled={!!result || action.pending}
              />
            ) : mode === "speak" ? (
              <>
                <Btn onClick={listen}>
                  <Icon name="sound" />
                  Nghe mẫu
                </Btn>
                {data.stt_ready ? (
                  <Recorder
                    {...{ lang, token: data.token }}
                    onResult={setResult}
                  />
                ) : (
                  <Status>
                    Chưa cấu hình dịch vụ nhận dạng. Bạn vẫn có thể nghe mẫu và
                    luyện đọc.
                  </Status>
                )}
              </>
            ) : (
              <>
                {mode === "spell" && (
                  <Btn primary onClick={listen} isLoading={action.pending}>
                    <Icon name="sound" />
                    Nghe mẫu
                  </Btn>
                )}
                <Answer
                  question={data}
                  value={answer}
                  onChange={setAnswer}
                  disabled={!!result || action.pending}
                />
              </>
            )}
            {!result && mode !== "speak" && (
              <Btn
                primary
                isLoading={action.pending}
                onClick={() =>
                  action.run(async (s) => {
                    const r = await request(
                      endpoint(
                        lang,
                        mode === "match"
                          ? `match/${data.token}/submit/`
                          : `submit/${data.token}/`,
                      ),
                      "POST",
                      mode === "match"
                        ? { pairs: answer }
                        : {
                            answer:
                              mode === "order"
                                ? JSON.stringify(answer)
                                : answer,
                          },
                      s,
                    );
                    setResult(r);
                    audio.tick();
                  })
                }
              >
                Kiểm tra
              </Btn>
            )}
            {result &&
              (mode === "match" ? (
                <>
                  <Status>
                    {result.correct} / {result.total} cặp chính xác
                  </Status>
                  {result.rows.map((r, i) => (
                    <p key={i}>
                      {r.is_correct ? "✓" : "↻"} {r.term} — {r.meaning}
                    </p>
                  ))}
                </>
              ) : (
                <Feedback row={result} />
              ))}
            {(result || (mode === "speak" && !data.stt_ready)) && (
              <Btn
                primary
                onClick={() => {
                  setData(null);
                  setIndex((i) => i + 1);
                }}
              >
                Tiếp tục <Icon name="arrow" />
              </Btn>
            )}
          </Glass>
        )}
      </div>
    </Page>
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
