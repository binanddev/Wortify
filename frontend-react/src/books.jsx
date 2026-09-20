import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  request,
  endpoint,
  useResource,
  useAction,
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
  Select,
  Link,
  Choice,
  WordOrder,
} from "./ui";
import { BookMedia, Theory } from "./learning";
export const TYPE_LABELS = {
  cloze: "Điền chỗ trống",
  choice: "Chọn một đáp án",
  multi: "Chọn nhiều đáp án",
  matching: "Nối hai cột",
  order: "Sắp xếp",
  text: "Trả lời ngắn",
  writing: "Viết tự do",
  wordset: "Tập từ",
  table: "Hoàn thành bảng",
};
export function Books({ lang, parts, userId }) {
  const slug = parts[2],
    section = parts[3],
    id = parts[4];
  const resource = useResource(
    endpoint(
      lang,
      slug
        ? `books/${slug}/${section === "lesson" ? `lessons/${id}/` : section === "exercise" ? `exercises/${id}/` : ""}`
        : "books/",
    ),
  );
  return (
    <Loading resource={resource}>
      {(data) =>
        section === "exercise" ? (
          <BookActivity key={id} {...{ data, lang, slug, id, userId }} />
        ) : (
          <BookIndex
            {...{ data, lang, slug, section, reload: resource.reload }}
          />
        )
      }
    </Loading>
  );
}
function BookIndex({ data, lang, slug, section, reload }) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [checks, setChecks] = useState({});
  const action = useAction();
  const rows = data.books || data.chapters || data.exercises || [];
  const shown = rows.filter(
    (r) =>
      `${r.number || ""} ${r.title}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter !== "todo" || !(checks[r.id] ?? r.completed ?? r.attempt)),
  );
  const title = data.book?.title || data.chapter?.title || "Thư viện sách";
  const completed = rows.filter(
    (r) => checks[r.id] ?? r.completed ?? r.attempt,
  ).length;
  return (
    <Page>
      <div className="book-reading-width">
        <Link
          className="breadcrumb"
          to={
            section === "lesson"
              ? `/${lang}/books/${slug}`
              : slug
                ? `/${lang}/books`
                : `/${lang}/flashcard`
          }
        >
          ←{" "}
          {section === "lesson"
            ? "Mục lục sách"
            : slug
              ? "Thư viện sách"
              : "Flashcard"}
        </Link>
        <Heading
          eyebrow={
            section === "lesson"
              ? `CHƯƠNG ${data.chapter.number}`
              : "BOOKDIGITAL"
          }
          title={section === "lesson" ? data.chapter.title : title}
          description={
            data.book?.description ||
            (slug
              ? "Đọc theo nhịp của bạn. Từng chương, từng bước."
              : "Chọn một cuốn sách để bắt đầu.")
          }
        />
        {data.chapter?.theory && (
          <details className="theory-disclosure" open>
            <summary>
              <Icon name="book" /> Kiến thức & ví dụ{" "}
              <span>Thu gọn / mở rộng</span>
            </summary>
            <Theory value={data.chapter.theory} assets={data.assets} />
          </details>
        )}
        <div className="book-list-toolbar">
          <div>
            <h2>
              {section === "lesson"
                ? "Bài luyện tập"
                : slug
                  ? "Mục lục"
                  : "Các đầu sách"}
            </h2>
            {slug && (
              <p>
                {completed}/{rows.length}{" "}
                {section === "lesson" ? "bài đã làm" : "chương đã đánh dấu"}
              </p>
            )}
          </div>
          <Field
            label={
              section === "lesson"
                ? "Tìm bài tập"
                : slug
                  ? "Tìm chương"
                  : "Tìm sách"
            }
            value={query}
            onChange={setQuery}
          />
          {slug && (
            <Select label="Hiển thị" value={filter} onChange={setFilter}>
              <option value="all">Tất cả</option>
              <option value="todo">Chưa hoàn thành</option>
            </Select>
          )}
        </div>
        <Status error={action.error} />
        <div className="book-outline">
          {shown.map((r, i) => {
            const checked = checks[r.id] ?? r.completed;
            const to = !slug
              ? `/${lang}/books/${r.slug}`
              : section === "lesson"
                ? `/${lang}/books/${slug}/exercise/${r.id}`
                : `/${lang}/books/${slug}/lesson/${r.id}`;
            return (
              <div
                className={`outline-row ${checked ? "is-complete" : ""}`}
                key={r.id}
              >
                {data.chapters && (
                  <label className="chapter-check">
                    <input
                      type="checkbox"
                      checked={Boolean(checked)}
                      disabled={action.pending}
                      aria-label={`Đánh dấu hoàn thành chương ${r.number}`}
                      onChange={(e) => {
                        const value = e.target.checked;
                        action.run(async (signal) => {
                          await request(
                            endpoint(
                              lang,
                              `books/${slug}/lessons/${r.id}/progress/`,
                            ),
                            "POST",
                            { completed: value },
                            signal,
                          );
                          setChecks((v) => ({ ...v, [r.id]: value }));
                        });
                      }}
                    />
                    <span aria-hidden="true">{checked ? "✓" : ""}</span>
                  </label>
                )}
                <Link className="outline-link" to={to}>
                  <span className="outline-number">
                    {data.exercises
                      ? String(i + 1).padStart(2, "0")
                      : r.number || String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="outline-copy">
                    <strong>{r.title}</strong>
                    <small>
                      {data.exercises
                        ? TYPE_LABELS[r.type] || "Bài luyện tập"
                        : slug
                          ? `${r.count} bài tập`
                          : r.author || "Sách học tập"}
                    </small>
                  </span>
                  <span className="outline-status">
                    {r.attempt
                      ? r.attempt.score === null
                        ? "Đã lưu"
                        : `${r.attempt.score}/${r.attempt.total} đúng`
                      : checked
                        ? "Đã xong"
                        : data.exercises
                          ? "Làm bài"
                          : ""}
                  </span>
                  <Icon name="arrow" size={18} />
                </Link>
              </div>
            );
          })}
        </div>
        {!shown.length && <Status>Không có nội dung phù hợp.</Status>}
        {data.chapters && (
          <p className="fine-print">
            Ô đánh dấu giúp bạn tự theo dõi chương đã học. Điểm từng bài được
            lưu riêng.
          </p>
        )}
      </div>
    </Page>
  );
}
function feedbackFor(result, q, key) {
  return result?.answers?.find(
    (r) =>
      r.key === key ||
      (r.question_position === q.position &&
        (!key.includes("_") ||
          r.label === `Ô ${Number(key.split("_")[1]) + 1}`)),
  );
}
function InlineBlank({
  q,
  index,
  answers,
  onAnswer,
  disabled,
  result,
  submitted,
  missing,
}) {
  const key = `${q.id}_${index}`,
    row = feedbackFor(result, q, key),
    fresh = row && (answers[key] ?? "") === (submitted[key] ?? "");
  return (
    <span
      className={`inline-answer ${fresh ? (row.correct === true ? "answer-correct" : row.correct === false ? "answer-incorrect" : "") : ""}`}
      data-incorrect={(fresh && row.correct === false) || undefined}
    >
      <input
        data-answer-key={key}
        aria-label={`Câu ${q.position}, ô ${index + 1}`}
        aria-invalid={
          missing.includes(key) || Boolean(fresh && row.correct === false)
        }
        autoComplete="off"
        spellCheck={false}
        value={answers[key] || ""}
        disabled={disabled}
        onChange={(e) => onAnswer(key, e.target.value)}
        style={{
          width: `${Math.min(22, Math.max(9, (answers[key] || "").length + 2))}ch`,
        }}
      />
      {fresh && (
        <span className="blank-feedback">
          {row.correct === true
            ? "✓ Đúng"
            : row.correct === false
              ? `↻ ${row.expected.join(" / ")}`
              : "Đã lưu"}
        </span>
      )}
      {missing.includes(key) && (
        <span className="blank-feedback">Cần điền ô này</span>
      )}
    </span>
  );
}
function ClozeText({ text, ...props }) {
  return (
    <>
      {text.split(/(\{\{\d+\}\})/g).map((segment, i) => {
        const m = segment.match(/^\{\{(\d+)\}\}$/);
        return m ? (
          <InlineBlank key={i} index={Number(m[1]) - 1} {...props} />
        ) : (
          <span key={i}>{segment}</span>
        );
      })}
    </>
  );
}
function AnswerFeedback({ row, fresh = true }) {
  if (!row || !fresh) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`answer-feedback ${row.correct === true ? "correct" : row.correct === false ? "incorrect" : "saved"}`}
    >
      <strong>
        {row.correct === true
          ? "✓ Chính xác"
          : row.correct === false
            ? "↻ Chưa chính xác"
            : "Đã lưu bài viết"}
      </strong>
      {row.correct === false && row.expected?.length > 0 && (
        <span>
          Đáp án đúng: <b>{row.expected.join(" / ")}</b>
        </span>
      )}
    </motion.div>
  );
}
function BookMatching({
  questions,
  answers,
  onAnswer,
  disabled,
  result,
  submitted,
  missing,
}) {
  const [selected, setSelected] = useState(null);
  const [options] = useState(() =>
    shuffled([...new Set(questions.flatMap((q) => q.options))]),
  );
  const choose = (option) => {
    if (selected === null) return;
    onAnswer(String(selected), option);
    setSelected(null);
  };
  return (
    <section className="book-matching" aria-label="Bài nối hai cột">
      <p className="interaction-hint" role="status">
        {selected === null
          ? "1. Chọn một câu bên trái. 2. Chọn phần phù hợp bên phải."
          : `Đang nối câu ${questions.find((q) => q.id === selected)?.position}. Chọn ở cột phải.`}
      </p>
      <div className="match-columns">
        <div>
          <h3>Câu / vế đầu</h3>
          {questions.map((q, i) => {
            const key = String(q.id),
              row = feedbackFor(result, q, key),
              fresh = (answers[key] || "") === (submitted[key] || "");
            return (
              <div
                className="match-row"
                key={q.id}
                data-incorrect={(fresh && row?.correct === false) || undefined}
              >
                <button
                  type="button"
                  data-answer-key={key}
                  disabled={disabled}
                  aria-pressed={selected === q.id}
                  aria-label={`Nối câu ${i + 1}: ${q.prompt}`}
                  className={`match-tile ${selected === q.id ? "selected" : ""} ${answers[key] ? "paired" : ""}`}
                  onClick={() => setSelected(q.id)}
                >
                  <span className="pair-number">{i + 1}</span>
                  <span>
                    {q.prompt}
                    <small>
                      {answers[key] ? `↔ ${answers[key]}` : "Chọn để nối"}
                    </small>
                  </span>
                </button>
                {answers[key] && (
                  <button
                    className="unpair"
                    type="button"
                    disabled={disabled}
                    onClick={() => onAnswer(key, "")}
                    aria-label={`Bỏ nối câu ${i + 1}`}
                  >
                    Bỏ nối
                  </button>
                )}
                {missing.includes(key) && (
                  <small className="field-error">Chưa nối câu này</small>
                )}
                <AnswerFeedback row={row} fresh={fresh} />
              </div>
            );
          })}
        </div>
        <div>
          <h3>Phần tương ứng</h3>
          {options.map((option, i) => {
            const pairs = questions
              .filter((q) => answers[String(q.id)] === option)
              .map((q) => q.position);
            return (
              <button
                type="button"
                key={option}
                disabled={disabled || selected === null}
                className={`match-tile match-target ${pairs.length ? "paired" : ""}`}
                onClick={() => choose(option)}
                aria-label={`Ghép với ${option}`}
              >
                <span className="pair-number">
                  {String.fromCharCode(65 + i)}
                </span>
                <span>
                  {option}
                  {pairs.length > 0 && (
                    <small>Đã nối: {pairs.join(", ")}</small>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
export function BookActivity({
  data,
  lang,
  slug,
  id,
  userId,
  preview = false,
}) {
  const exercise = data.exercise,
    questions = data.questions.filter((q) => !q.example),
    kind = exercise.presentation?.type || "text";
  const storageKey = `lernraum:book:${userId}:${id}:${data.questions.map((q) => q.id).join("-")}`;
  const [answers, setAnswers] = useState(() =>
      preview ? {} : readPreference(storageKey, {}),
    ),
    [submitted, setSubmitted] = useState({}),
    [token, setToken] = useState(data.token),
    [result, setResult] = useState(null),
    [missing, setMissing] = useState([]);
  const action = useAction(),
    formRef = useRef(null),
    resultRef = useRef(null);
  useEffect(() => {
    if (!preview) savePreference(storageKey, answers);
  }, [answers, storageKey, preview]);
  const onAnswer = (key, value) => {
    setAnswers((a) => ({ ...a, [key]: value }));
    setMissing((m) => m.filter((k) => k !== key));
  };
  const requiredKeys = (q) =>
    q.blank_count
      ? Array.from({ length: q.blank_count }, (_, i) => `${q.id}_${i}`)
      : [String(q.id)];
  const complete = (q) =>
    requiredKeys(q).every((k) =>
      Array.isArray(answers[k])
        ? q.kind === "order"
          ? answers[k].length === (q.presentation?.tokens || []).length
          : answers[k].length > 0
        : Boolean(String(answers[k] || "").trim()),
    );
  const answered = questions.filter(complete).length,
    dirty = result && JSON.stringify(answers) !== JSON.stringify(submitted);
  const props = {
    answers,
    onAnswer,
    disabled: action.pending,
    result,
    submitted,
    missing,
  };
  const submit = (e) => {
    e.preventDefault();
    if (preview) return;
    const gaps = questions.flatMap((q) =>
      complete(q)
        ? []
        : requiredKeys(q).filter(
            (k) =>
              !answers[k] || !String(answers[k]).trim() || q.kind === "order",
          ),
    );
    if (gaps.length) {
      setMissing(gaps);
      formRef.current?.querySelector(`[data-answer-key="${gaps[0]}"]`)?.focus();
      action.setError(
        "Còn câu chưa hoàn thành. Kiểm tra các vị trí được đánh dấu.",
      );
      return;
    }
    action.run(async (signal) => {
      const saved = await request(
        endpoint(lang, `books/${slug}/exercises/${id}/`),
        "POST",
        { token, answers },
        signal,
      );
      const r = await request(
        endpoint(lang, `results/${saved.id}/`),
        "GET",
        undefined,
        signal,
      );
      setSubmitted(structuredClone(answers));
      setResult(r);
      setToken(crypto.randomUUID());
      requestAnimationFrame(() => resultRef.current?.focus());
    });
  };
  return (
    <Page>
      <div
        className={`book-reading-width book-activity ${preview ? "activity-preview" : ""}`}
      >
        {!preview && (
          <Link
            className="breadcrumb"
            to={`/${lang}/books/${slug}/lesson/${exercise.chapter}`}
          >
            ← Các bài trong chương
          </Link>
        )}
        {!preview && (
          <Heading
            eyebrow={TYPE_LABELS[kind] || "BÀI LUYỆN TẬP"}
            title={exercise.title}
            description={
              exercise.title !== exercise.instruction
                ? exercise.instruction
                : undefined
            }
          />
        )}
        {preview && (
          <p className="preview-caption">
            Bản xem tương tác · {exercise.instruction}
          </p>
        )}
        <div className="activity-meta">
          <span>{TYPE_LABELS[kind] || "Bài luyện tập"}</span>
          <span>
            {answered}/{questions.length} câu đã điền
          </span>
          {exercise.check_mode !== "auto_check" && (
            <span>Có phần tự luyện</span>
          )}
        </div>
        <BookMedia resources={exercise.resources} assets={data.assets} />
        {exercise.context && (
          <Glass className="reading-passage">
            <span className="eyebrow">ĐỌC NGỮ CẢNH</span>
            <p>{exercise.context}</p>
          </Glass>
        )}
        {exercise.hints && (
          <details className="book-hints">
            <summary>Từ gợi ý & lưu ý</summary>
            <p>{exercise.hints}</p>
          </details>
        )}
        <form ref={formRef} onSubmit={submit} noValidate>
          {data.questions
            .filter((q) => q.example)
            .map((q) => (
              <div className="worked-example" key={q.id}>
                <strong>Ví dụ</strong>
                <p>
                  {q.prompt} {q.sample?.join(" / ")}
                </p>
              </div>
            ))}
          {kind === "matching" &&
          questions.every((q) => q.kind === "matching") ? (
            <Glass className="question-sheet">
              <BookMatching questions={questions} {...props} />
            </Glass>
          ) : kind === "table" && questions.every((q) => q.kind === "table") ? (
            <Glass className="question-sheet">
              <div className="exercise-table-scroll">
                <table className="exercise-table">
                  <thead>
                    <tr>
                      {exercise.presentation.columns.map((h, i) => (
                        <th scope="col" key={i}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {questions.map((q) => (
                      <tr key={q.id}>
                        {q.presentation.cells.map((cell, i) => (
                          <td key={i}>
                            <ClozeText text={cell} q={q} {...props} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Glass>
          ) : (
            <div className="question-stack">
              {questions.map((q) => {
                const key = String(q.id),
                  row = feedbackFor(result, q, key),
                  fresh =
                    JSON.stringify(answers[key]) ===
                    JSON.stringify(submitted[key]);
                return (
                  <Glass
                    className={`question-sheet ${missing.some((k) => k === key || k.startsWith(key + "_")) ? "question-incomplete" : ""}`}
                    key={q.id}
                    data-incorrect={
                      (fresh && row?.correct === false) || undefined
                    }
                  >
                    <div className="question-heading">
                      <span className="question-number">{q.position}</span>
                      <span>{TYPE_LABELS[q.kind] || "Câu hỏi"}</span>
                    </div>
                    <BookMedia
                      resources={q.presentation?.resources}
                      assets={data.assets}
                    />
                    {q.presentation?.hint && (
                      <p className="worked-example">
                        Ví dụ: {q.presentation.hint}
                      </p>
                    )}
                    {q.blank_count ? (
                      <div className="passage-cloze">
                        <ClozeText text={q.prompt} q={q} {...props} />
                      </div>
                    ) : (
                      <>
                        <p className="book-question-prompt">{q.prompt}</p>
                        {q.kind === "order" ? (
                          <div data-answer-key={key} tabIndex={-1}>
                            <WordOrder
                              items={q.presentation?.tokens || []}
                              value={answers[key] || []}
                              disabled={action.pending}
                              onChange={(v) => onAnswer(key, v)}
                            />
                          </div>
                        ) : q.options?.length ? (
                          <div data-answer-key={key} tabIndex={-1}>
                            {q.kind === "multi" && (
                              <p className="interaction-hint">
                                Chọn tất cả đáp án phù hợp.
                              </p>
                            )}
                            <Choice
                              label={`Câu ${q.position}`}
                              options={q.options}
                              multiple={q.kind === "multi"}
                              value={
                                answers[key] ?? (q.kind === "multi" ? [] : "")
                              }
                              disabled={action.pending}
                              onChange={(v) => onAnswer(key, v)}
                            />
                          </div>
                        ) : (
                          <Field
                            data-answer-key={key}
                            label={
                              q.kind === "wordset"
                                ? "Các từ, ngăn cách bằng dấu phẩy"
                                : q.kind === "writing"
                                  ? "Bài viết của bạn"
                                  : "Câu trả lời của bạn"
                            }
                            multiline={q.kind === "writing"}
                            minRows={5}
                            value={answers[key] || ""}
                            isDisabled={action.pending}
                            onChange={(v) => onAnswer(key, v)}
                          />
                        )}
                        {missing.includes(key) && (
                          <p className="field-error">
                            Hoàn thành câu này trước khi kiểm tra.
                          </p>
                        )}
                        <AnswerFeedback row={row} fresh={fresh} />
                      </>
                    )}
                  </Glass>
                );
              })}
            </div>
          )}
          {!preview && (
            <>
              <Status error={action.error} />
              <div className="activity-submit">
                <p>
                  {dirty
                    ? "Bạn đã sửa bài. Kiểm tra lại để cập nhật kết quả."
                    : result
                      ? "Bạn có thể sửa trực tiếp để luyện lại."
                      : "Bài làm được giữ lại trên trình duyệt khi bạn rời trang."}
                </p>
                <Btn
                  primary
                  type="submit"
                  isLoading={action.pending}
                  isDisabled={!questions.length}
                >
                  {result
                    ? "Kiểm tra lại"
                    : exercise.check_mode === "auto_check"
                      ? "Kiểm tra bài"
                      : "Lưu & kiểm tra"}{" "}
                  <Icon name="check" />
                </Btn>
              </div>
            </>
          )}
        </form>
        <AnimatePresence>
          {result && (
            <motion.section
              ref={resultRef}
              tabIndex={-1}
              role="status"
              key={result.id}
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="book-result"
            >
              <span className="result-symbol">
                {result.answers.every((r) => r.correct === true) ? "✓" : "↻"}
              </span>
              <div>
                <h2>
                  {result.score === null
                    ? "Đã lưu bài làm"
                    : `${result.score} / ${result.total} câu đúng`}
                </h2>
                <p>
                  {result.score === null
                    ? "Phần viết tự do được lưu để tự ôn."
                    : "Đối chiếu đáp án ngay tại từng câu. Các câu đúng vẫn được giữ nguyên."}
                </p>
                <div className="toolbar">
                  {result.answers.some((r) => r.correct === false) && (
                    <Btn
                      onClick={() => {
                        const node = formRef.current?.querySelector(
                          '[data-incorrect="true"]',
                        );
                        node?.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                        node
                          ?.querySelector("input,button")
                          ?.focus({ preventScroll: true });
                      }}
                    >
                      Xem câu cần sửa
                    </Btn>
                  )}
                  {data.next && (
                    <Link
                      className="text-link"
                      to={`/${lang}/books/${slug}/exercise/${data.next.id}`}
                    >
                      Bài tiếp theo →
                    </Link>
                  )}
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </Page>
  );
}
