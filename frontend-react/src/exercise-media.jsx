import { useState } from "react";
import { Btn, Icon, Status } from "./ui";
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
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const upload = async (files) => {
    if (busy || disabled || !files.length) return;
    setError("");
    try {
      validateMediaSelection(items, files);
      setBusy(true);
      onBusy?.(true);
      let next = [...items];
      for (const file of files) {
        const data = new FormData();
        data.append("file", file);
        const result = await request(
          endpoint(lang, "practice-hub/media/"),
          "POST",
          data,
        );
        next = [...next, result.media];
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
      {busy && <p role="status">Đang tải tệp lên…</p>}
      <Status error={error} />
      {items.map((item) => (
        <div key={item.id} className="flex min-w-0 items-center gap-2">
          <Icon name={item.type === "audio/mpeg" ? "sound" : "image"} />
          <span className="min-w-0 flex-1 truncate" title={item.name}>
            {item.name}
          </span>
          <small>{(item.size / 1024 / 1024).toFixed(1)} MB</small>
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
      {!!items.length && <ExerciseMedia items={items} />}
    </div>
  );
}
