import { useEffect, useRef, useState } from "react";
import { endpoint, request, useResource } from "./core";
import { useLearningSync, pendingLearning } from "./learning-sync";
import { useAnswerClock } from "./use-answer-clock";
import { Btn, Icon, Status, Field, SidebarTools } from "./ui";
import { PracticeModal } from "./practice-workspace";
const labels = ["Chưa nhớ", "Khó", "Nhớ", "Dễ"];
const icons = ["refresh", "history", "check", "spark"];
function delay(date) {
  const minutes = Math.max(
    1,
    Math.round((new Date(date) - Date.now()) / 60000),
  );
  return minutes < 60
    ? `${minutes} phút`
    : minutes < 1440
      ? `${Math.round(minutes / 60)} giờ`
      : minutes < 43200
        ? `${Math.round(minutes / 1440)} ngày`
        : `${Math.round(minutes / 43200)} tháng`;
}
export default function SpacedReview({ lang, id, userId }) {
  const resource = useResource(endpoint(lang, `decks/${id}/review/`));
  const sync = useLearningSync(userId, lang);
  const [reviewed, setReviewed] = useState(() =>
    pendingLearning(userId, lang)
      .filter(
        (e) => e.kind === "review" && Number(e.payload.deck) === Number(id),
      )
      .map((e) => e.payload.card),
  );
  const [revealed, setRevealed] = useState(false),
    [settings, setSettings] = useState(false),
    [stats, setStats] = useState(false),
    [error, setError] = useState("");
  const card = resource.data?.cards.find((c) => !reviewed.includes(c.id));
  const rated = useRef(new Set());
  const [nextDue, setNextDue] = useState(null);
  const timer = useAnswerClock(card?.id);
  const duration = useRef(null);
  const data = resource.data;
  useEffect(() => {
    sync.flush().then(() => resource.reload());
  }, []);
  useEffect(() => {
    setRevealed(false);
    duration.current = null;
  }, [card?.id]);
  return (
    <section className="mx-auto grid w-full max-w-3xl gap-5">
      <SidebarTools navOnly>
        <div className="flash-icon-row">
          <Btn icon="settings" onClick={() => setSettings(true)}>
            Tùy chọn ôn cách quãng
          </Btn>
          <Btn icon="history" onClick={() => setStats(true)}>
            Lịch ôn và thẻ khó
          </Btn>
          <Btn
            icon="refresh"
            onClick={() => {
              sync.flush().then(() => {
                setReviewed(
                  pendingLearning(userId, lang)
                    .filter(
                      (e) =>
                        e.kind === "review" &&
                        Number(e.payload.deck) === Number(id),
                    )
                    .map((e) => e.payload.card),
                );
                rated.current.clear();
                resource.reload();
              });
            }}
          >
            Cập nhật lịch ôn
          </Btn>
        </div>
      </SidebarTools>
      <Status error={error || resource.error || sync.error} />
      {sync.pending > 0 && (
        <p className="text-sm text-(--muted)">Đang chờ đồng bộ lượt học.</p>
      )}
      {data && (
        <p className="text-center text-sm text-(--muted)">
          {data.due} đến hạn · {data.new} thẻ mới · {data.reviewed_today} đã ôn
          hôm nay
        </p>
      )}
      {resource.loading ? (
        <Status>Đang mở lịch ôn…</Status>
      ) : card ? (
        <>
          <div
            ref={timer.root}
            className="grid min-h-72 place-content-center gap-6 rounded-3xl border border-(--line) bg-(--surface) p-8 text-center"
          >
            <h2 className="text-3xl font-bold">{card.front}</h2>
            {revealed ? (
              <>
                <p className="text-2xl">{card.back}</p>
                {card.example && <p>{card.example}</p>}
              </>
            ) : (
              <Btn
                icon="eye"
                primary
                onClick={() => {
                  duration.current = timer.read();
                  setRevealed(true);
                }}
              >
                Hiện đáp án
              </Btn>
            )}
          </div>
          {revealed && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {labels.map((label, index) => (
                <Btn
                  key={label}
                  className="btn flex h-auto flex-col gap-2 py-4"
                  onClick={() => {
                    if (rated.current.has(card.id)) return;
                    rated.current.add(card.id);
                    setNextDue(card.choices[String(index + 1)]);
                    sync.enqueue("review", {
                      deck: Number(id),
                      card: card.id,
                      type: "flash",
                      correct: index !== 0,
                      rating: index + 1,
                      response_ms: duration.current,
                      goal: "comprehensive",
                    });
                    setReviewed((previous) => [...previous, card.id]);
                    sync.flush();
                  }}
                >
                  <Icon name={icons[index]} />
                  <span>{label}</span>
                  <small>{delay(card.choices[String(index + 1)])}</small>
                </Btn>
              ))}
            </div>
          )}
        </>
      ) : (
        data && (
          <div className="rounded-3xl border border-(--line) p-10 text-center">
            <Icon name="check" size={32} />
            <h2 className="mt-4 text-xl font-bold">Đã xong lượt ôn này</h2>
            <p className="mt-2 text-(--muted)">
              {nextDue || data.next_due
                ? `Lượt tiếp theo: ${new Date(nextDue || data.next_due).toLocaleString("vi-VN")}`
                : "Bạn có thể tiếp tục với các chế độ học khác."}
            </p>
          </div>
        )
      )}
      {settings && data && (
        <PracticeModal
          title="Ôn cách quãng"
          size="lg"
          onClose={() => setSettings(false)}
        >
          <ReviewSettings
            config={data.config}
            onSave={async (config) => {
              await request(
                endpoint(lang, `decks/${id}/review/`),
                "PATCH",
                config,
              );
              resource.reload();
              setSettings(false);
            }}
          />
        </PracticeModal>
      )}
      {stats && data && (
        <PracticeModal title="Lịch ôn" onClose={() => setStats(false)}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {data.forecast.map((day) => (
              <div
                key={day.date}
                className="rounded-xl border border-(--line) p-3"
              >
                <small>{day.date}</small>
                <p className="text-xl font-bold">{day.count}</p>
              </div>
            ))}
          </div>
          <h3 className="mt-4 font-semibold">Cần luyện thêm</h3>
          {data.difficult.length ? (
            data.difficult.map((c) => (
              <p key={c.id}>
                {c.title} · {c.lapses} lần chưa nhớ
              </p>
            ))
          ) : (
            <p>Chưa có thẻ thường xuyên quên.</p>
          )}
          <p className="text-sm text-(--muted)">
            Lịch dự kiến thay đổi theo mỗi lần ôn. Thẻ quá hạn được ưu tiên;
            không cần học dồn.
          </p>
        </PracticeModal>
      )}
    </section>
  );
}
function ReviewSettings({ config, onSave }) {
  const [error, setError] = useState("");
  const [value, setValue] = useState(config),
    [saving, setSaving] = useState(false);
  return (
    <div className="grid gap-4">
      <Status error={error} />
      <Field
        label="Mục tiêu ghi nhớ (%)"
        type="number"
        min={80}
        max={97}
        value={Math.round(value.retention * 100)}
        onChange={(v) => setValue({ ...value, retention: Number(v) / 100 })}
      />
      {[
        ["new_limit", "Thẻ mới mỗi ngày"],
        ["review_limit", "Giới hạn ôn mỗi ngày"],
      ].map(([key, label]) => (
        <Field
          key={key}
          label={label}
          type="number"
          min={0}
          max={500}
          value={value[key]}
          onChange={(v) => setValue({ ...value, [key]: Number(v) })}
        />
      ))}
      <label className="check-line">
        <input
          type="checkbox"
          checked={value.adapt_time}
          onChange={(e) => setValue({ ...value, adapt_time: e.target.checked })}
        />
        Dùng thời gian phản hồi để hỗ trợ đánh giá
      </label>
      <p className="text-sm text-(--muted)">
        Đúng/sai và lịch sử nhớ là chính. Trả lời chậm bất thường chỉ được cân
        nhắc khi đã có đủ dữ liệu cùng dạng câu hỏi. Bạn luôn tự chọn mức nhớ
        trong chế độ này.
      </p>
      <Btn
        icon="save"
        primary
        isLoading={saving}
        onClick={async () => {
          setSaving(true);
          try {
            setError("");
            await onSave(value);
          } catch (error) {
            setError(error.message);
          } finally {
            setSaving(false);
          }
        }}
      >
        Lưu tùy chọn
      </Btn>
    </div>
  );
}
