import { useState } from "react";
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
  Select,
  Link,
  Choice,
  WordOrder,
  Feedback,
  Editor,
  Confirm,
} from "./ui";
function ResultPanel({ result }) {
  return (
    <Glass className="result-summary">
      <h2>
        {result.score === null
          ? "Đã lưu bài làm"
          : `${result.score} / ${result.total} câu đúng`}
      </h2>
      <p>
        {result.status === "pending_manual"
          ? "Đã lưu để tự ôn tập. Chức năng gửi người chấm đang tạm ngắt."
          : "Kết quả đã được lưu vào lịch sử học tập."}
      </p>
      {result.feedback && <Status>{result.feedback}</Status>}
    </Glass>
  );
}
export function Result({ lang, id }) {
  const resource = useResource(endpoint(lang, `results/${id}/`));
  return (
    <Loading resource={resource}>
      {(result) => (
        <Page>
          <Heading eyebrow="LỊCH SỬ BÀI LÀM" title={result.title} />
          <ResultPanel result={result} />
          {result.answers.map((r, i) => (
            <Glass key={i}>
              <p>{r.prompt}</p>
              <strong>{r.answer}</strong>
              <Feedback row={r} />
            </Glass>
          ))}
        </Page>
      )}
    </Loading>
  );
}
function ReviewRequest({ lang, result }) {
  const [reviewer, setReviewer] = useState(""),
    [classroom, setClassroom] = useState(""),
    [sent, setSent] = useState(result.review);
  const resource = useResource(endpoint(lang, "classes/")),
    action = useAction();
  if (!result.manual && !result.allow_review) return null;
  return (
    <Glass>
      <h3>Nhận phản hồi từ người chấm</h3>
      {sent ? (
        <Status>
          Đã gửi bài cho {sent.reviewer}.{" "}
          <Link to={`/${lang}/reviews/${sent.id}`}>Xem phản hồi →</Link>
        </Status>
      ) : (
        <>
          <Field
            label="Tên tài khoản người chấm"
            value={reviewer}
            onChange={setReviewer}
          />
          <Select
            label="Hoặc gửi qua lớp"
            value={classroom}
            onChange={setClassroom}
          >
            <option value="">Chọn lớp</option>
            {resource.data?.classes
              .filter((c) => !c.manage)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
          </Select>
          <Btn
            isLoading={action.pending}
            isDisabled={!reviewer && !classroom}
            onClick={() =>
              action.run(async (s) =>
                setSent(
                  await request(
                    endpoint(lang, "reviews/"),
                    "POST",
                    {
                      attempt: result.id,
                      ...(classroom ? { classroom } : { reviewer }),
                    },
                    s,
                  ),
                ),
              )
            }
          >
            Gửi bài cho người chấm
          </Btn>
          <Status error={action.error || resource.error} />
        </>
      )}
    </Glass>
  );
}
export function Community({ lang, section, id }) {
  const resource = useResource(
    endpoint(lang, `${section}/${id ? id + "/" : ""}`),
  );
  return (
    <Loading resource={resource}>
      {(data) => (
        <CommunityContent
          {...{ lang, section, id, data, reload: resource.reload }}
        />
      )}
    </Loading>
  );
}
function CommunityContent({ lang, section, id, data, reload }) {
  const [edit, setEdit] = useState(null),
    [remove, setRemove] = useState(null);
  const action = useAction();
  const api = (path, method, v, s) =>
    request(endpoint(lang, path), method, v, s);
  if (section === "profile")
    return (
      <Page>
        <Heading
          eyebrow="HÀNH TRÌNH CỦA BẠN"
          title={data.display_name || data.username}
          description={data.bio || "Những bước nhỏ làm nên thay đổi lớn."}
          actions={
            <Btn
              onClick={() =>
                setEdit({
                  title: "Chỉnh sửa hồ sơ",
                  fields: [
                    { name: "display_name", label: "Tên hiển thị" },
                    { name: "bio", label: "Giới thiệu", multiline: true },
                  ],
                  initial: data,
                  path: "profile/",
                  method: "PATCH",
                })
              }
            >
              Chỉnh sửa hồ sơ
            </Btn>
          }
        />
        <div className="stats-strip">
          {[
            [data.sessions, "Buổi học hoàn thành"],
            [data.reviews, "Lượt ôn tập"],
            [data.mastered, "Thẻ nắm vững"],
          ].map(([v, t]) => (
            <div key={t}>
              <strong>{v}</strong>
              <span>{t}</span>
            </div>
          ))}
        </div>
        <h2>Dấu mốc đáng nhớ</h2>
        <div className="toolbar">
          {data.achievements.length ? (
            data.achievements.map((a) => (
              <span className="achievement" key={a}>
                <Icon name="star" />
                {a}
              </span>
            ))
          ) : (
            <p>Dấu mốc đầu tiên đang đợi bạn hoàn thành một buổi học.</p>
          )}
        </div>
        <h2>Lịch sử học tập</h2>
        {data.study_history.map((s) => (
          <Link
            className="history-row"
            key={s.token}
            to={`/${lang}/flashcard/session/${s.token}`}
          >
            <span>
              {s.kind.toUpperCase()} ·{" "}
              {new Date(s.date).toLocaleDateString("vi-VN")}
            </span>
            <strong>
              {s.result.correct}/{s.result.total} →
            </strong>
          </Link>
        ))}
        {data.history.map((h) => (
          <Link
            className="history-row"
            key={h.id}
            to={`/${lang}/results/${h.id}`}
          >
            <span>{h.title}</span>
            <span>
              {h.status === "pending_manual" ? "Chờ chấm" : "Đã chấm"} →
            </span>
          </Link>
        ))}
        {edit && (
          <Editor
            {...edit}
            onClose={() => setEdit(null)}
            onSave={async (v, s) => {
              await api(edit.path, edit.method, v, s);
              reload();
            }}
          />
        )}
      </Page>
    );
  if (section === "classes")
    return (
      <Page>
        <Heading
          eyebrow="CÙNG NHAU TIẾN BỘ"
          title={id ? data.title : "Lớp học của bạn."}
          description={
            id
              ? `Người tạo lớp: ${data.owner}`
              : "Tạo lớp, kết nối và trao đổi phản hồi bài làm."
          }
          actions={
            !id ? (
              <>
                <Btn
                  onClick={() =>
                    setEdit({
                      title: "Tham gia lớp",
                      fields: [
                        { name: "invite", label: "Mã mời", isRequired: true },
                      ],
                      path: "classes/",
                      method: "POST",
                    })
                  }
                >
                  Tham gia lớp
                </Btn>
                <Btn
                  primary
                  onClick={() =>
                    setEdit({
                      title: "Tạo lớp học",
                      fields: [
                        { name: "title", label: "Tên lớp", isRequired: true },
                      ],
                      path: "classes/",
                      method: "POST",
                    })
                  }
                >
                  Tạo lớp
                </Btn>
              </>
            ) : data.manage ? (
              <Btn
                onClick={() =>
                  setEdit({
                    title: "Đổi tên lớp",
                    fields: [
                      { name: "title", label: "Tên lớp", isRequired: true },
                    ],
                    initial: data,
                    path: `classes/${id}/`,
                    method: "PATCH",
                  })
                }
              >
                Đổi tên lớp
              </Btn>
            ) : null
          }
        />
        {!id ? (
          <div className="deck-grid">
            {data.classes.map((c) => (
              <Link key={c.id} to={`/${lang}/classes/${c.id}`}>
                <Glass className="deck-tile">
                  <Icon name="class" size={30} />
                  <h2>{c.title}</h2>
                  <p>
                    {c.manage ? "Lớp bạn quản lý" : `Người tạo: ${c.owner}`}
                  </p>
                  <Icon name="arrow" />
                </Glass>
              </Link>
            ))}
            {!data.classes.length && (
              <Status>
                Bạn chưa có lớp học. Tạo một lớp hoặc nhập mã mời để bắt đầu.
              </Status>
            )}
          </div>
        ) : (
          <>
            {data.manage && (
              <Glass>
                <h3>Mời người học</h3>
                <p className="invite-code">{data.invite}</p>
                <Btn
                  onClick={() =>
                    action.run(() => navigator.clipboard.writeText(data.invite))
                  }
                >
                  Sao chép mã mời
                </Btn>
                <h3>Thành viên</h3>
                {data.members.map((m) => (
                  <div className="history-row" key={m.id}>
                    {m.username}
                    <Btn onClick={() => setRemove(m)}>Xóa khỏi lớp</Btn>
                  </div>
                ))}
              </Glass>
            )}
            <h2>Bài làm liên quan đến bạn</h2>
            {data.reviews.map((r) => (
              <ReviewRow key={r.id} {...{ r, lang }} />
            ))}
            {!data.reviews.length && (
              <Status>Chưa có bài gửi chấm trong lớp này.</Status>
            )}
          </>
        )}
        <Status error={action.error} />
        {edit && (
          <Editor
            {...edit}
            onClose={() => setEdit(null)}
            onSave={async (v, s) => {
              await api(edit.path, edit.method, v, s);
              reload();
            }}
          />
        )}
        {remove && (
          <Confirm
            title={`Xóa ${remove.username} khỏi lớp?`}
            description="Người học có thể tham gia lại bằng mã mời."
            onClose={() => setRemove(null)}
            onConfirm={async (s) => {
              await api(
                `classes/${id}/`,
                "PATCH",
                { remove_member: remove.id },
                s,
              );
              reload();
            }}
          />
        )}
      </Page>
    );
  return (
    <Page>
      <Heading
        eyebrow="PHẢN HỒI GIÚP TIẾN BỘ"
        title={id ? data.title : "Bài chấm."}
        description={
          id
            ? `${data.student} → ${data.reviewer}`
            : "Các bài bạn đã gửi và được giao chấm."
        }
      />
      {!id ? (
        <>
          {data.reviews.map((r) => (
            <ReviewRow key={r.id} {...{ r, lang }} />
          ))}
          {!data.reviews.length && (
            <Status>Chưa có bài gửi hoặc nhận chấm.</Status>
          )}
        </>
      ) : (
        <>
          <Glass>
            <h2>
              {data.score === null ? "Chưa có điểm" : `${data.score} / 10`}
            </h2>
            <p>{data.feedback}</p>
            {data.can_grade && (
              <Btn
                primary
                onClick={() =>
                  setEdit({
                    title: "Chấm bài",
                    fields: [
                      {
                        name: "score",
                        label: "Điểm (0–10)",
                        type: "number",
                        min: 0,
                        max: 10,
                        step: 0.01,
                        isRequired: true,
                      },
                      { name: "feedback", label: "Nhận xét", multiline: true },
                    ],
                    initial: data,
                  })
                }
              >
                Nhập điểm và nhận xét
              </Btn>
            )}
          </Glass>
          {data.answers.map((a, i) => (
            <Glass key={i}>
              <p>{a.prompt}</p>
              <strong>{a.answer}</strong>
            </Glass>
          ))}
        </>
      )}
      {edit && (
        <Editor
          {...edit}
          onClose={() => setEdit(null)}
          onSave={async (v, s) => {
            await api(`reviews/${id}/`, "PATCH", v, s);
            reload();
          }}
        />
      )}
    </Page>
  );
}
function ReviewRow({ r, lang }) {
  return (
    <Link className="history-row" to={`/${lang}/reviews/${r.id}`}>
      <span>
        <strong>{r.title}</strong>
        <small>
          {r.student} → {r.reviewer}
        </small>
      </span>
      <span>{r.score === null ? "Chờ chấm" : `${r.score}/10`} →</span>
    </Link>
  );
}
export function Settings({ lang, prefs, setPrefs }) {
  const resource = useResource(endpoint(lang, "settings/"));
  return (
    <Loading resource={resource}>
      {(data) => <SettingsContent {...{ lang, prefs, setPrefs, data }} />}
    </Loading>
  );
}
function SettingsContent({ lang, prefs, setPrefs, data }) {
  const [values, setValues] = useState(data),
    [saved, setSaved] = useState(false);
  const action = useAction();
  return (
    <Page>
      <Heading
        eyebrow="THEO CÁCH CỦA BẠN"
        title="Nhịp học riêng."
        description="Một không gian vừa mắt, vừa tai và vừa sức."
      />
      <div className="grid two">
        <Glass>
          <h2>Hiển thị & âm thanh</h2>
          <label className="range-label">
            Cỡ chữ thẻ <strong>{prefs.font}px</strong>
            <input
              type="range"
              min="24"
              max="60"
              step="2"
              value={prefs.font}
              onChange={(e) =>
                setPrefs({ ...prefs, font: Number(e.target.value) })
              }
            />
          </label>
          <p className="font-preview" style={{ fontSize: prefs.font }}>
            Aa · Học mỗi ngày
          </p>
          <label className="check-line">
            <input
              type="checkbox"
              checked={prefs.sound}
              onChange={(e) => setPrefs({ ...prefs, sound: e.target.checked })}
            />
            Âm thanh tương tác nhẹ
          </label>
          <Select
            label="Phông nền"
            value={prefs.background}
            onChange={(background) => setPrefs({ ...prefs, background })}
          >
            <option value="mist">Sương sớm</option>
            <option value="paper">Giấy sáng</option>
            <option value="night">Đêm yên tĩnh</option>
          </Select>
          <p>
            Cài đặt hiển thị được lưu trên thiết bị, riêng cho tài khoản và ngôn
            ngữ này.
          </p>
        </Glass>
        <Glass>
          <h2>Tùy chọn học tập</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              action.run(async (s) => {
                await request(endpoint(lang, "settings/"), "PATCH", values, s);
                setSaved(true);
              });
            }}
          >
            {Object.entries({
              autoplay: "Tự động đọc từ khi học",
              ignore_case: "Bỏ qua chữ hoa / thường",
              ignore_punctuation: "Bỏ qua dấu câu",
              ...(lang === "de"
                ? { transliteration: "Chấp nhận ae / oe / ue / ss" }
                : {}),
            }).map(([key, label]) => (
              <label className="check-line" key={key}>
                <input
                  type="checkbox"
                  checked={values[key]}
                  onChange={(e) => {
                    setValues({ ...values, [key]: e.target.checked });
                    setSaved(false);
                  }}
                />
                {label}
              </label>
            ))}
            <Field
              label="Thẻ mới mỗi ngày"
              type="number"
              min="0"
              max="200"
              value={values.new_cards_per_day}
              onChange={(v) => {
                setValues({ ...values, new_cards_per_day: v });
                setSaved(false);
              }}
            />
            <Field
              label="Thời lượng buổi học (phút)"
              type="number"
              min="1"
              max="120"
              value={values.session_minutes}
              onChange={(v) => {
                setValues({ ...values, session_minutes: v });
                setSaved(false);
              }}
            />
            <Btn primary type="submit" isLoading={action.pending}>
              Lưu cài đặt học
            </Btn>
            <Status error={action.error}>
              {saved ? "Đã lưu cài đặt." : null}
            </Status>
          </form>
        </Glass>
      </div>
    </Page>
  );
}

export function BookMedia({ resources = [], assets = {} }) {
  return (
    <div className="book-media">
      {resources.map((r, i) => {
        const asset = assets[r.file];
        return asset ? (
          r.type === "audio" ? (
            <audio key={i} controls preload="none" src={asset.url} />
          ) : (
            <img
              key={i}
              src={asset.url}
              alt={
                asset.description || r.description || "Hình minh họa bài tập"
              }
              loading="lazy"
            />
          )
        ) : (
          <div className="media-placeholder" key={i}>
            {r.type === "audio" ? "Âm thanh" : "Hình minh họa"} đang chờ cập
            nhật: {r.file}
          </div>
        );
      })}
    </div>
  );
}
export function Theory({ value, assets }) {
  if (!value.explanation && !value.rules?.length && !value.examples?.length)
    return null;
  return (
    <Glass className="theory-panel">
      <span className="eyebrow">GÓC KIẾN THỨC</span>
      <p className="context-text">{value.explanation}</p>
      {value.rules?.length > 0 && (
        <ul>
          {value.rules.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
      {value.tables?.map((t, i) => (
        <div className="theory-table" key={i}>
          <h3>{t.title}</h3>
          <table>
            <thead>
              <tr>
                {t.headers?.map((h, j) => (
                  <th key={j}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.rows?.map((r, j) => (
                <tr key={j}>
                  {r.map((c, k) => (
                    <td key={k}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {value.examples?.length > 0 && (
        <details>
          <summary>Ví dụ minh họa</summary>
          {value.examples.map((x, i) => (
            <p key={i}>{typeof x === "string" ? x : x.text}</p>
          ))}
        </details>
      )}
      {value.usage_notes?.map((n, i) => (
        <p key={i}>{n}</p>
      ))}
      <BookMedia resources={value.resources} assets={assets} />
    </Glass>
  );
}
