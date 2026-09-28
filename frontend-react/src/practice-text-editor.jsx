import { MediaEditor } from "./exercise-media";
import { PracticeModal } from "./practice-workspace";
import { useState } from "react";
import { Btn, Field, Select, Status, SidebarTools, Icon } from "./ui";
import {
  EXERCISE_TYPES,
  exerciseStylesOf,
  previewData,
} from "./exercise-types";
import {
  textTemplate,
  parsePracticeText,
  exerciseToText,
} from "./practice-text";
import { PracticeActivity } from "./practice-activity";

export function PracticeTextEditor({
  onApply,
  exercise,
  pending = false,
  lang = "en",
}) {
  const [media, setMedia] = useState({ existing: exercise?.attachments || [] });
  const [mediaBusy, setMediaBusy] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(null);
  const keyFor = (node, index) =>
    exercise ? "existing" : `${index}:${node.title}`;
  const withMedia = (node, index) => ({
    ...node,
    payload: { ...node.payload, attachments: media[keyFor(node, index)] || [] },
  });
  const [toolsOpen, setToolsOpen] = useState(!exercise);
  const [mode, setMode] = useState("cloze_drag_drop");
  const [style, setStyle] = useState("drag_drop");
  const [text, setText] = useState(() =>
    exercise?.questions?.some((q) => q.prompt) ? exerciseToText(exercise) : "",
  );
  const [checked, setChecked] = useState(null);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [files, setFiles] = useState([]);
  const update = (value) => {
    setText(value);
    setChecked(null);
    setError("");
  };
  const loadFiles = async (incoming) => {
    if (reading || pending || mediaBusy) return;
    setReading(true);
    setChecked(null);
    setError("");
    try {
      const selected = [...incoming];
      if (!selected.length) return;
      if (selected.some((file) => !/\.txt$/i.test(file.name)))
        throw new Error("Chỉ nhận tệp .txt, mã hóa UTF-8.");
      if (selected.reduce((sum, file) => sum + file.size, 0) > 2000000)
        throw new Error("Tổng tệp tối đa 2 MB.");
      const combined = (await Promise.all(selected.map((file) => file.text())))
        .map((s) => s.replace(/^\uFEFF/, ""))
        .join("\n\n");
      update(combined);
      setFiles(selected.map((file) => file.name));
      setToolsOpen(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setReading(false);
    }
  };
  return (
    <section className="practice-text-editor studio-content">
      <SidebarTools navOnly>
        <h3 className="context-section-title">
          {exercise ? "Chỉnh sửa bài" : "Tạo bài tập"}
        </h3>
        <Btn icon="upload" onClick={() => setToolsOpen(true)}>
          Nhập tệp / chọn mẫu
        </Btn>
        <Status error={error} />
        <Btn
          icon="eye"
          isDisabled={!text.trim() || reading || pending || mediaBusy}
          onClick={() => {
            try {
              const data = parsePracticeText(text);
              if (exercise && data.nodes.length !== 1)
                throw new Error(
                  "Khi sửa, tệp cần đúng một bài. Dùng nhập mới để tạo nhiều bài.",
                );
              setChecked(data);
              setPreviewIndex(0);
              setError("");
            } catch (e) {
              setChecked(null);
              setError(e.message);
            }
          }}
        >
          Kiểm tra và xem trước
        </Btn>
        {checked && (
          <>
            <p role="status">
              {checked.nodes.length} bài hợp lệ, sẵn sàng lưu.
            </p>
            <Btn
              primary
              isLoading={pending}
              isDisabled={pending || mediaBusy}
              onClick={() => onApply(checked.nodes.map(withMedia))}
            >
              {exercise ? "Lưu thay đổi" : `Tạo ${checked.nodes.length} bài`}
            </Btn>
          </>
        )}
      </SidebarTools>
      {toolsOpen && (
        <PracticeModal
          title={exercise ? "Chỉnh sửa bài tập" : "Nhập bài tập .txt"}
          pending={pending || reading || mediaBusy}
          onClose={() => setToolsOpen(false)}
        >
          <div className="studio-import-tools">
            <Status error={error} />
            <h3>{exercise ? "Chỉnh sửa bài tập" : "Nhập bài tập .txt"}</h3>
            <a
              href={`/${lang}/create/guide`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Quy tắc và mẫu .txt ↗
            </a>
            <label
              className="practice-file-drop"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                loadFiles(event.dataTransfer.files);
              }}
            >
              <span aria-hidden="true">📄</span>
              <strong>Chọn hoặc thả tệp .txt</strong>
              <small>UTF-8 · tối đa 2 MB · có thể chọn nhiều tệp</small>
              <input
                aria-label="Chọn tệp .txt"
                type="file"
                accept=".txt,text/plain"
                multiple={!exercise}
                disabled={pending || reading || mediaBusy}
                onChange={(event) => loadFiles(event.target.files || [])}
              />
            </label>
            {files.length > 0 && <p>{files.join(" · ")}</p>}
            <details>
              <summary>Mẫu cho 7 dạng bài</summary>
              <Select
                label="Dạng bài mẫu"
                value={mode}
                disabled={pending || reading || mediaBusy}
                onChange={(value) => {
                  setMode(value);
                  setStyle(exerciseStylesOf(value)[0][0]);
                }}
              >
                {EXERCISE_TYPES.map(([key, title]) => (
                  <option key={key} value={key}>
                    {title}
                  </option>
                ))}
              </Select>
              <Select
                label="Style có sẵn"
                value={style}
                disabled={pending || reading || mediaBusy}
                onChange={setStyle}
              >
                {exerciseStylesOf(mode).map(([key, title]) => (
                  <option key={key} value={key}>
                    {title}
                  </option>
                ))}
              </Select>
              <a
                className="btn"
                download={`${mode}-${style}.txt`}
                href={`data:text/plain;charset=utf-8,${encodeURIComponent(textTemplate(mode, style))}`}
              >
                Tải tệp mẫu
              </a>
              <Btn
                isDisabled={pending || reading || mediaBusy}
                onClick={() => {
                  update(textTemplate(mode, style));
                  setToolsOpen(false);
                }}
              >
                Mở nội dung mẫu
              </Btn>
            </details>
            <a
              className="btn"
              download="bai-tap.txt"
              href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`}
            >
              Tải nội dung đang soạn
            </a>
          </div>
        </PracticeModal>
      )}
      <h1>{exercise ? exercise.title : "Nội dung bài tập"}</h1>
      <Field
        label="Bản soạn .txt"
        description="Nội dung tệp xuất hiện ở đây. Các công cụ kiểm tra, lưu và tải mẫu nằm ở thanh bên."
        multiline
        rows={24}
        value={text}
        onChange={update}
        isDisabled={pending || reading || mediaBusy}
      />
      {checked && (
        <section className="studio-preview-content">
          {checked.nodes.map((node, i) => (
            <article key={keyFor(node, i)} className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{node.title}</h2>
                <Btn
                  isIconOnly
                  title="Xem trước"
                  aria-label={`Xem trước ${node.title}`}
                  onClick={() => setPreviewIndex(i)}
                >
                  <Icon name="eye" />
                </Btn>
              </div>
              <MediaEditor
                lang={lang}
                items={media[keyFor(node, i)] || []}
                disabled={pending || mediaBusy}
                onBusy={setMediaBusy}
                onChange={(items) =>
                  setMedia((previous) => ({
                    ...previous,
                    [keyFor(node, i)]: items,
                  }))
                }
              />
            </article>
          ))}
        </section>
      )}
      {checked && previewIndex !== null && checked.nodes[previewIndex] && (
        <PracticeModal
          title="Xem trước bản soạn"
          onClose={() => setPreviewIndex(null)}
        >
          {checked.nodes.length > 1 && (
            <Select
              label="Bài tập"
              value={previewIndex}
              onChange={(value) => setPreviewIndex(Number(value))}
            >
              {checked.nodes.map((node, i) => (
                <option key={i} value={i}>
                  {i + 1}. {node.title}
                </option>
              ))}
            </Select>
          )}
          <h3>{checked.nodes[previewIndex].title}</h3>
          <PracticeActivity
            key={`${text}:${previewIndex}`}
            data={previewData(
              withMedia(checked.nodes[previewIndex], previewIndex).payload,
            )}
            preview
          />
        </PracticeModal>
      )}
    </section>
  );
}
