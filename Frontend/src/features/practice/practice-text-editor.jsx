import {FormattingHelp} from "./formatting-help.jsx";
import { remapQuestionMedia } from "./exercise-media-utils.js";
import { MediaEditor } from "./exercise-media.jsx";
import { PracticeModal } from "./practice-workspace.jsx";
import { useRef, useState } from "react";
import { Btn, Field, Select, Status, SidebarTools, Icon } from "../../components/ui/ui.jsx";
import {
  EXERCISE_TYPES,
  exerciseStylesOf,
  previewData,
} from "./exercise-types.js";
import {
  textTemplate,
  parsePracticeText,
  exerciseToText,
} from "./practice-text.js";
import { PracticeActivity } from "./practice-activity.jsx";

export function PracticeTextEditor({
  onApply,
  exercise,
  pending = false,
  lang = "en",
}) {
  const [media, setMedia] = useState({ existing: exercise?.attachments || [] });
  const [mediaBusy, setMediaBusy] = useState(false);
  const [activeDraft, setActiveDraft] = useState(0);
  const [mediaIndex, setMediaIndex] = useState(null);
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
  const [checked, setChecked] = useState(() =>
    exercise
      ? {
          nodes: [
            { kind: "exercise", title: exercise.title, payload: exercise },
          ],
        }
      : null,
  );
  const previousNodes = useRef(checked?.nodes || []);
  const [mediaNotice, setMediaNotice] = useState("");
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
        throw new Error("Only UTF-8 .txt files are supported.");
      if (selected.reduce((sum, file) => sum + file.size, 0) > 2000000)
        throw new Error("Combined files must not exceed 2 MB.");
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
  const validateDraft = (target) => {
    try {
      const data = parsePracticeText(text);
      if (exercise && data.nodes.length !== 1)
        throw new Error(
          "When editing, the file must contain exactly one exercise. Use import to create multiple exercises.",
        );
      const nextMedia = { ...media };
      let detached = false;
      data.nodes.forEach((node, i) => {
        const key = keyFor(node, i);
        const before = previousNodes.current.find(
          (old, j) => keyFor(old, j) === key,
        );
        if (before) {
          const items = media[key] || [];
          nextMedia[key] = remapQuestionMedia(
            items,
            before.payload.questions,
            node.payload.questions,
          );
          detached ||= nextMedia[key].some(
            (item, j) => items[j].question && !item.question,
          );
        }
      });
      setMedia(nextMedia);
      previousNodes.current = data.nodes;
      setMediaNotice(
        detached
          ? "Some questions changed or were deleted. Their files now belong to the entire exercise; review Media before saving."
          : "",
      );
      setChecked(data);
      if (target === "media")
        setMediaIndex(Math.min(activeDraft, data.nodes.length - 1));
      else setPreviewIndex(Math.min(activeDraft, data.nodes.length - 1));
      setError("");
    } catch (e) {
      setChecked(null);
      setError(e.message);
    }
  };
  return (
    <section className="practice-text-editor studio-content">
      <SidebarTools navOnly>
        <h3 className="context-section-title">
          {exercise ? "Edit exercise" : "Create exercise"}
        </h3>
        <Btn icon="upload" onClick={() => setToolsOpen(true)}>
          Import file / choose template
        </Btn>
        <Status error={error} />
        <Btn
          icon="eye"
          isDisabled={!text.trim() || reading || pending || mediaBusy}
          onClick={() => validateDraft("preview")}
        >
          Check and preview
        </Btn>
        <Btn
          icon="image"
          isDisabled={!text.trim() || reading || pending || mediaBusy}
          onClick={() => validateDraft("media")}
        >
          Media · MP3 and images
        </Btn>
        {checked?.nodes.length > 1 && (
          <Select
            label="Exercise draft"
            value={activeDraft}
            onChange={(value) => setActiveDraft(Number(value))}
          >
            {checked.nodes.map((node, i) => (
              <option key={i} value={i}>
                {i + 1}. {node.title}
              </option>
            ))}
          </Select>
        )}
        {checked && (
          <>
            <p role="status">
              {checked.nodes.length} valid exercises ready to save.
            </p>
            <Btn
              primary
              isLoading={pending}
              isDisabled={pending || mediaBusy}
              onClick={() => onApply(checked.nodes.map(withMedia))}
            >
              {exercise ? "Save changes" : `Create ${checked.nodes.length} exercises`}
            </Btn>
          </>
        )}
      </SidebarTools>
      {toolsOpen && (
        <PracticeModal
          title={exercise ? "Edit exercise" : "Import .txt exercises"}
          pending={pending || reading || mediaBusy}
          onClose={() => setToolsOpen(false)}
        >
          <div className="studio-import-tools">
            <Status error={error} />
            <h3>{exercise ? "Edit exercise" : "Import .txt exercises"}</h3>
            <a
              href={`/${lang}/create/guide`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Text format rules and templates ↗
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
              <strong>Choose or drop a .txt file</strong>
              <small>UTF-8 · max 2 MB · multiple files allowed</small>
              <input
                aria-label="Choose a .txt file"
                type="file"
                accept=".txt,text/plain"
                multiple={!exercise}
                disabled={pending || reading || mediaBusy}
                onChange={(event) => loadFiles(event.target.files || [])}
              />
            </label>
            {files.length > 0 && <p>{files.join(" · ")}</p>}
            <details>
              <summary>Templates for 7 exercise types</summary>
              <Select
                label="Sample exercise type"
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
                label="Available styles"
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
                Download sample file
              </a>
              <Btn
                isDisabled={pending || reading || mediaBusy}
                onClick={() => {
                  update(textTemplate(mode, style));
                  setToolsOpen(false);
                }}
              >
                Open sample content
              </Btn>
            </details>
            <a
              className="btn"
              download="bai-tap.txt"
              href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`}
            >
              Download draft
            </a>
          </div>
        </PracticeModal>
      )}
      <h1>{exercise ? exercise.title : "Exercise content"}</h1>
      <FormattingHelp/>
      {mediaNotice && <p role="status">{mediaNotice}</p>}
      <Field
        label="Text draft"
        description="File content appears here. Review, save and download templates using the sidebar."
        multiline
        rows={24}
        value={text}
        onChange={update}
        isDisabled={pending || reading || mediaBusy}
      />
      {checked && mediaIndex !== null && checked.nodes[mediaIndex] && (
        <PracticeModal
          title={`Media · ${checked.nodes[mediaIndex].title}`}
          pending={mediaBusy}
          onClose={() => setMediaIndex(null)}
        >
          {checked.nodes.length > 1 && (
            <Select
              label="Exercises"
              value={mediaIndex}
              disabled={mediaBusy}
              onChange={(value) => {
                setMediaIndex(Number(value));
                setActiveDraft(Number(value));
              }}
            >
              {checked.nodes.map((node, i) => (
                <option key={i} value={i}>
                  {i + 1}. {node.title}
                </option>
              ))}
            </Select>
          )}
          <MediaEditor
            key={keyFor(checked.nodes[mediaIndex], mediaIndex)}
            questions={checked.nodes[mediaIndex].payload.questions}
            lang={lang}
            items={media[keyFor(checked.nodes[mediaIndex], mediaIndex)] || []}
            disabled={pending || mediaBusy}
            onBusy={setMediaBusy}
            onChange={(items) =>
              setMedia((previous) => ({
                ...previous,
                [keyFor(checked.nodes[mediaIndex], mediaIndex)]: items,
              }))
            }
          />
        </PracticeModal>
      )}
      {checked && previewIndex !== null && checked.nodes[previewIndex] && (
        <PracticeModal
          title="Preview draft"
          onClose={() => setPreviewIndex(null)}
        >
          {checked.nodes.length > 1 && (
            <Select
              label="Exercises"
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
