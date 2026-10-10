import {FormattingHelp} from "./formatting-help.jsx";
import { useState } from "react";
import { PracticeModal } from "./practice-workspace.jsx";
import { Page, Heading, Link, SidebarTools, Select, Btn, Icon } from "../../components/ui/ui.jsx";
import { EXERCISE_TYPES, exerciseStylesOf } from "./exercise-types.js";
import {
  TEXT_GUIDE,
  textTemplate,
  completePracticeGuide,
} from "./practice-text.js";
import { PracticeRichText, TEXT_COLORS } from "./practice-rich-text.jsx";

const panel =
  "glass rounded-3xl border border-(--line) bg-(--surface) p-5 sm:p-7 backdrop-blur-xl shadow-sm";
function Download({ text, name, label }) {
  return (
    <a
      className="btn"
      title={label}
      aria-label={label}
      download={name}
      href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`}
    >
      <Icon name="download" />
    </a>
  );
}
export function PracticeGuide({ lang }) {
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState(null);
  const [mode, setMode] = useState("cloze_drag_drop");
  const [style, setStyle] = useState("drag_drop");
  const [color, setColor] = useState("blue");
  const fullGuide = completePracticeGuide();
  const template = textTemplate(mode, style);
  const colorExample = `[color=${color}]Your text[/color]`;
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Copied.");
    } catch {
      setNotice("Copy failed. Select the text manually or download the file.");
    }
  };
  const code = (text) => (
    <pre
      className="my-3 max-h-[55vh] overflow-auto whitespace-pre-wrap wrap-anywhere rounded-2xl border border-(--line) bg-transparent p-4 text-sm leading-7"
      tabIndex={0}
    >
      {text}
    </pre>
  );
  return (
    <Page><FormattingHelp/>
      <SidebarTools navOnly>
        <div className="flex flex-wrap gap-2">
          <Link
            className="btn"
            to={`/${lang}/create`}
            title="My Exercise Library"
            aria-label="My Exercise Library"
          >
            <Icon name="home" />
          </Link>
          <Link
            className="btn"
            to={`/${lang}/create/new`}
            title="Create exercise"
            aria-label="Create exercise"
          >
            <Icon name="plus" />
          </Link>
          <Btn icon="download" onClick={() => setDialog("full")}>
            Instructions and all templates
          </Btn>
        </div>
      </SidebarTools>
      <div className="mx-auto grid w-full max-w-5xl gap-6 text-(--ink)">
        <Heading title="Exercise authoring guide" />
        <div className="grid gap-4 md:grid-cols-3">
          {[
            [
              "01",
              "Choose a template",
              "7 exercise types, 11 styles. Choose a template to get started.",
            ],
            [
              "02",
              "Write content",
              "Save the .txt file as UTF-8. Add EXERCISE: to include multiple exercises in one file.",
            ],
            [
              "03",
              "Preview & save",
              "Import the file into a folder in Create, review it and save. You can add images and MP3 files.",
            ],
          ].map(([n, title, body]) => (
            <article key={n} className={panel}>
              <span className="text-sm font-bold text-(--accent)">{n}</span>
              <h2 className="my-2 text-lg font-semibold">{title}</h2>
              <p className="leading-7">{body}</p>
            </article>
          ))}
        </div>
        <section className={panel}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Template library</h2>
            <Btn icon="download" onClick={() => setDialog("full")}>
              Download all instructions and templates
            </Btn>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {EXERCISE_TYPES.map(([key, title, number]) => (
              <button
                type="button"
                key={key}
                className="flex items-center gap-4 rounded-2xl border border-(--line) bg-transparent p-4 text-left transition-transform hover:scale-[1.01] focus-visible:outline-2 focus-visible:outline-(--accent)"
                onClick={() => {
                  setMode(key);
                  setStyle(exerciseStylesOf(key)[0][0]);
                  setDialog("template");
                }}
              >
                <span className="font-bold text-(--accent)">{number}</span>
                <span className="flex-1 font-semibold">{title}</span>
                <Icon name="arrow" />
              </button>
            ))}
          </div>
        </section>
        <section className={panel}>
          <h2 className="text-xl font-semibold">Content format</h2>
          <p className="mt-2 leading-7">
            Use in instructions, reading passages, explanations and questions. Keep answers and interactive words in plain text.
          </p>
          <div className="my-4 grid gap-3 sm:grid-cols-2">
            {["**Bold text**", "*Italic text*"].map((text) => (
              <div
                key={text}
                className="flex items-center justify-between gap-3 rounded-2xl border border-(--line) p-4"
              >
                <div>
                  <code className="text-sm">{text}</code>
                  <p className="mt-2">
                    <PracticeRichText>{text}</PracticeRichText>
                  </p>
                </div>
                <Btn icon="copy" onClick={() => copy(text)}>
                  Copy syntax
                </Btn>
              </div>
            ))}
          </div>
          <div
            className="grid grid-cols-5 gap-2 sm:grid-cols-10"
            role="group"
            aria-label="20 text colors"
          >
            {Object.entries(TEXT_COLORS).map(([name, hex]) => (
              <button
                key={name}
                type="button"
                aria-pressed={color === name}
                title={name}
                aria-label={`Color ${name}`}
                onClick={() => setColor(name)}
                className={`grid justify-items-center gap-2 rounded-xl border p-2 text-xs ${color === name ? "border-(--accent)" : "border-transparent"}`}
              >
                <span
                  className="h-5 w-5 rounded-full ring-1 ring-current"
                  style={{ backgroundColor: hex }}
                />
                {name}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--line) p-4">
            <div>
              <code className="text-sm">{colorExample}</code>
              <p className="mt-2">
                <PracticeRichText>{colorExample}</PracticeRichText>
              </p>
            </div>
            <Btn icon="copy" onClick={() => copy(colorExample)}>
              Copy selected color
            </Btn>
          </div>
          <p className="mt-4 text-sm leading-7">
            End formatting before each gap. For correction exercises, keep questions in plain text so learners can edit words. Choose colors that contrast with the lesson background.
          </p>
        </section>
        <section className={panel}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Rules & documentation</h2>
            <div className="flex gap-2">
              <Btn icon="copy" onClick={() => copy(fullGuide)}>
                Copy all instructions and templates
              </Btn>
              <Download
                text={fullGuide}
                name="practice-complete-guide.txt"
                label="Download all instructions and templates"
              />
              <Btn icon="eye" onClick={() => setDialog("rules")}>
                Read the rules
              </Btn>
            </div>
          </div>
          <p className="mt-3 leading-7">
            Keywords and syntax are in English; content can use any language. Up to 100 exercises per import, 100 questions per exercise and 2 MB of text.
          </p>
          <p className="mt-2 leading-7">
            Images and MP3 files are optional, up to 200 MB per exercise. Attach them to the entire exercise or individual questions in Media; attachments are not included in .txt files.
          </p>
        </section>
        <p role="status" className="text-sm">
          {notice}
        </p>
      </div>
      {dialog && (
        <PracticeModal
          title={
            dialog === "template"
              ? "Exercise template"
              : dialog === "rules"
                ? "Text format rules"
                : "Full guide"
          }
          onClose={() => setDialog(null)}
        >
          {dialog === "template" && (
            <Select label="Style" value={style} onChange={setStyle}>
              {exerciseStylesOf(mode).map(([key, title]) => (
                <option key={key} value={key}>
                  {title}
                </option>
              ))}
            </Select>
          )}
          <div className="flex gap-2">
            <Btn
              icon="copy"
              onClick={() =>
                copy(
                  dialog === "template"
                    ? template
                    : dialog === "rules"
                      ? TEXT_GUIDE
                      : fullGuide,
                )
              }
            >
              Copy content
            </Btn>
            <Download
              text={dialog === "template" ? template : fullGuide}
              name={
                dialog === "template"
                  ? `${mode}-${style}.txt`
                  : "practice-complete-guide.txt"
              }
              label="Download .txt file"
            />
          </div>
          <p role="status" className="text-sm">
            {notice}
          </p>
          {code(
            dialog === "template"
              ? template
              : dialog === "rules"
                ? TEXT_GUIDE
                : fullGuide,
          )}
        </PracticeModal>
      )}
    </Page>
  );
}
