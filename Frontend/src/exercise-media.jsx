import { useState } from "react";
import { Btn, Icon, Status, Select } from "./ui";
import { PracticeModal } from "./practice-workspace";
import { endpoint, request } from "./core";
import { validateMediaSelection } from "./exercise-media-utils";
export function ExerciseMedia({ items = [] }) {
  const [image, setImage] = useState(null);
  if (!items.length) return null;
  return (
    <section className="grid w-full min-w-0 gap-3" aria-label="Tệp đính kèm">
      <div className="flex flex-wrap gap-3">
        {items
          .filter((item) => item.type?.startsWith("image/"))
          .map((item) => (
            <button
              key={item.id}
              type="button"
              className="overflow-hidden rounded-xl border border-(--line)"
              title={item.name}
              aria-label={`Xem hình ${item.name}`}
              onClick={() => setImage(item)}
            >
              <img
                src={item.url}
                alt={item.name}
                loading="lazy"
                className="h-40 max-w-full object-contain"
              />
            </button>
          ))}
      </div>
      {items
        .filter((item) => item.type === "audio/mpeg")
        .map((item) => (
          <figure
            key={item.id}
            className="min-w-0 rounded-xl bg-(--surface) p-3"
          >
            <figcaption className="mb-2 truncate text-sm" title={item.name}>
              {item.name}
            </figcaption>
            <audio
              controls
              preload="metadata"
              src={item.url}
              className="w-full"
              aria-label={item.name}
            />
          </figure>
        ))}
      {image && (
        <PracticeModal title={image.name} onClose={() => setImage(null)}>
          <img
            src={image.url}
            alt={image.name}
            className="max-h-[70dvh] w-full object-contain"
          />
        </PracticeModal>
      )}
    </section>
  );
}
export function MediaEditor({
  items = [],
  onChange,
  lang,
  disabled = false,
  onBusy,
  questions = [],
}) {
  const [scope, setScope] = useState("");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const upload = async (files) => {
    if (busy || disabled || !files.length) return;
    setError("");
    try {
      validateMediaSelection(items, files);
      if (scope === "sequence" && files.length > questions.length)
        throw new Error("Số tệp vượt số câu. Chọn lại hoặc gắn cho cả bài.");
      setBusy(true);
      onBusy?.(true);
      let next = [...items];
      for (const [fileIndex, file] of files.entries()) {
        const data = new FormData();
        data.append("file", file);
        const result = await request(
          endpoint(lang, "practice-hub/media/"),
          "POST",
          data,
        );
        next = [
          ...next,
          {
            ...result.media,
            ...(scope
              ? {
                  question:
                    scope === "sequence"
                      ? String(questions[fileIndex].id || fileIndex + 1)
                      : scope,
                }
              : {}),
          },
        ];
        onChange(next);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  };
  return (
    <div className="grid gap-3 rounded-xl border border-(--line) p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-(--muted)">
          MP3 / hình ảnh · tùy chọn · tổng tối đa 200 MB
        </span>
        <label
          className="studio-nav-icon cursor-pointer"
          title="Thêm MP3 hoặc hình ảnh"
        >
          <Icon name="upload" />
          <input
            className="sr-only"
            type="file"
            aria-label="Thêm MP3 hoặc hình ảnh"
            accept=".mp3,.png,.jpg,.jpeg,.webp,.gif"
            multiple
            disabled={disabled || busy}
            onChange={(event) => {
              upload(Array.from(event.target.files || []));
              event.target.value = "";
            }}
          />
        </label>
      </div>
      <Select
        label="Thêm tệp cho"
        value={scope}
        disabled={busy || disabled}
        onChange={setScope}
      >
        <option value="">Cả bài</option>
        {questions.length > 1 && (
          <option value="sequence">Mỗi tệp một câu · theo thứ tự chọn</option>
        )}
        {questions.map((q, i) => (
          <option key={q.id || i + 1} value={String(q.id || i + 1)}>
            Câu {i + 1} · {q.prompt.slice(0, 70)}
          </option>
        ))}
      </Select>
      {scope === "sequence" && (
        <p className="text-sm text-(--muted)">
          Tệp đầu → câu 1, tệp tiếp → câu 2. Kiểm tra và đổi câu trong danh sách
          sau khi tải.
        </p>
      )}
      <p className="text-sm text-(--muted)">
        {items.length} tệp ·{" "}
        {(items.reduce((n, item) => n + item.size, 0) / 1024 / 1024).toFixed(1)}{" "}
        / 200 MB
      </p>
      {busy && <p role="status">Đang tải tệp lên…</p>}
      <Status error={error} />
      {items.map((item) => (
        <div
          key={item.id}
          className="flex min-w-0 flex-wrap items-center gap-2"
        >
          <Icon name={item.type === "audio/mpeg" ? "sound" : "image"} />
          <span className="min-w-0 flex-1 truncate" title={item.name}>
            {item.name}
          </span>
          <Select
            aria-label={`Gắn ${item.name} vào`}
            value={item.question || ""}
            disabled={disabled || busy}
            onChange={(question) =>
              onChange(
                items.map((row) =>
                  row.id === item.id ? { ...row, question } : row,
                ),
              )
            }
          >
            <option value="">Cả bài</option>
            {questions.map((q, i) => (
              <option key={q.id || i + 1} value={String(q.id || i + 1)}>
                Câu {i + 1} · {q.prompt.slice(0, 50)}
              </option>
            ))}
          </Select>
          <Btn icon="eye" onClick={() => setPreview(item)}>
            Xem tệp
          </Btn>
          <Btn
            isIconOnly
            title="Gỡ tệp"
            aria-label={`Gỡ ${item.name}`}
            isDisabled={disabled || busy}
            onClick={() => onChange(items.filter((row) => row.id !== item.id))}
          >
            <Icon name="close" />
          </Btn>
        </div>
      ))}
      {preview && (
        <PracticeModal title={preview.name} onClose={() => setPreview(null)}>
          <ExerciseMedia items={[preview]} />
        </PracticeModal>
      )}
    </div>
  );
}

export function ExerciseMediaDialog({ node, lang, onClose, onSaved }) {
  const [items, setItems] = useState(node.payload.attachments || []);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return (
    <PracticeModal
      title={`Media · ${node.title}`}
      pending={busy || saving}
      onClose={onClose}
    >
      <Status error={error} />
      <MediaEditor
        items={items}
        questions={node.payload.questions || []}
        lang={lang}
        onChange={setItems}
        disabled={saving}
        onBusy={setBusy}
      />
      <div className="flex justify-end">
        <Btn
          icon="save"
          primary
          isDisabled={busy || saving}
          isLoading={saving}
          onClick={async () => {
            setSaving(true);
            setError("");
            try {
              await request(
                endpoint(lang, `practice-hub/nodes/${node.id}/`),
                "PATCH",
                { payload: { ...node.payload, attachments: items } },
              );
              onSaved();
              onClose();
            } catch (error) {
              setError(error.message);
            } finally {
              setSaving(false);
            }
          }}
        >
          Lưu media
        </Btn>
      </div>
    </PracticeModal>
  );
}
