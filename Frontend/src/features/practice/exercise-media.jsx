import { useState } from "react";
import { Btn, Icon, Status, Select } from "../../components/ui/ui.jsx";
import { PracticeModal } from "./practice-workspace.jsx";
import { endpoint, request } from "../../lib/core.js";
import { validateMediaSelection } from "./exercise-media-utils.js";
export function ExerciseMedia({ items = [] }) {
  const [image, setImage] = useState(null);
  if (!items.length) return null;
  return (
    <section className="grid w-full min-w-0 gap-3" aria-label="Attachments">
      <div className="flex flex-wrap gap-3">
        {items
          .filter((item) => item.type?.startsWith("image/"))
          .map((item) => (
            <button
              key={item.id}
              type="button"
              className="overflow-hidden rounded-xl border border-(--line)"
              title={item.name}
              aria-label={`View image ${item.name}`}
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
  uploadUrl,
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
        throw new Error("There are more files than questions. Choose fewer files or attach them to the entire exercise.");
      setBusy(true);
      onBusy?.(true);
      let next = [...items];
      for (const [fileIndex, file] of files.entries()) {
        const data = new FormData();
        data.append("file", file);
        const result = await request(
          uploadUrl || endpoint(lang, "practice-hub/media/"),
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
          MP3 / images · optional · 200 MB total maximum
        </span>
        <label
          className="studio-nav-icon cursor-pointer"
          title="Add MP3 or images"
        >
          <Icon name="upload" />
          <input
            className="sr-only"
            type="file"
            aria-label="Add MP3 or images"
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
        label="Add files to"
        value={scope}
        disabled={busy || disabled}
        onChange={setScope}
      >
        <option value="">Entire exercise</option>
        {questions.length > 1 && (
          <option value="sequence">One question per file · selection order</option>
        )}
        {questions.map((q, i) => (
          <option key={q.id || i + 1} value={String(q.id || i + 1)}>
            Question {i + 1} · {q.prompt.slice(0, 70)}
          </option>
        ))}
      </Select>
      {scope === "sequence" && (
        <p className="text-sm text-(--muted)">
          First file → question 1, next file → question 2. Review and change assignments after uploading.
        </p>
      )}
      <p className="text-sm text-(--muted)">
        {items.length} files ·{" "}
        {(items.reduce((n, item) => n + item.size, 0) / 1024 / 1024).toFixed(1)}{" "}
        / 200 MB
      </p>
      {busy && <p role="status">Uploading files…</p>}
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
            aria-label={`Attach ${item.name} into`}
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
            <option value="">Entire exercise</option>
            {questions.map((q, i) => (
              <option key={q.id || i + 1} value={String(q.id || i + 1)}>
                Question {i + 1} · {q.prompt.slice(0, 50)}
              </option>
            ))}
          </Select>
          <Btn icon="eye" onClick={() => setPreview(item)}>
            View file
          </Btn>
          <Btn
            isIconOnly
            title="Remove file"
            aria-label={`Remove ${item.name}`}
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
          Save media
        </Btn>
      </div>
    </PracticeModal>
  );
}
