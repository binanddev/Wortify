import { t as tr, useLocale } from "../../i18n/index.js";
import {FormattingHelp} from "./formatting-help.jsx";
import { questionWordBank } from "./gap-bank.js";
import { useRef, useState } from "react";
import { Btn, Icon, Select } from "../../components/ui/ui.jsx";
import { AutoTextarea } from "./exercise-interactions.jsx";
import { newQuestion, modeOf } from "./exercise-types.js";
export function AField({ label, value = "", onChange, ...props }) {
  useLocale();
  return (
    <label className="author-field">
      <span>{tr(label)}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...props}
      />
    </label>
  );
}
function Lines({ label, value = [], onChange }) {
  useLocale();
  return (
    <AutoTextarea
      label={tr(label)}
      value={value.join("\n")}
      onChange={(v) => onChange(v.split("\n"))}
    />
  );
}
export function prepareExercise(exercise) {
  const e = structuredClone(exercise),
    mode = modeOf(e);
  e.presentation = { ...e.presentation, interaction: mode, type: e.kind };
  e.questions = e.questions.map((q) => ({
    ...q,
    kind: mode === "reading" && q.accepted_answers.filter(v => v.trim()).length > 1 ? "multi" : e.kind,
    presentation: { ...q.presentation },
    accepted_answers: q.accepted_answers.filter((v) => v.trim()),
    options: q.options.map((v) => v.trim()),
    blanks: q.blanks.map((b) => ({
      ...b,
      answers: b.answers.filter((v) => v.trim()),
      options: b.options?.filter((v) => v.trim()),
    })),
  }));
  if (mode === "cloze_drag_drop")
    e.questions.forEach((q) => {
      q.presentation.word_bank = questionWordBank(q);
    });
  if (mode === "matching") {
    const all = e.questions.map((q) => q.accepted_answers[0]).filter(Boolean);
    e.questions.forEach((q) => (q.options = [...new Set(all)]));
  }
  if (mode === "categorization")
    e.questions.forEach((q) => (q.options = e.presentation.categories));
  return e;
}
export function ExerciseForm({ exercise: e, onChange, onUpload }) {
  useLocale();
  const mode = modeOf(e);
  const update = (i, patch) =>
    onChange({
      questions: e.questions.map((q, j) => (i === j ? { ...q, ...patch } : q)),
    });
  return (
    <section className="author-panel">
      <FormattingHelp/>
      <AutoTextarea label={tr("Exercise comment · shown after a correct answer or reveal")} value={e.presentation?.comment || ""} onChange={comment=>onChange({presentation:{...e.presentation,comment}})}/>
      <AField
        label={tr("Exercise title")}
        value={e.title}
        onChange={(title) => onChange({ title })}
      />
      <AField
        label={tr("Request")}
        value={e.instruction}
        onChange={(instruction) => onChange({ instruction })}
      />
      {["cloze_drag_drop", "inline_selection"].includes(mode) && (
        <div className="form-columns">
          <Select
            label={tr("Fill method")}
            value={mode}
            onChange={(interaction) =>
              onChange({ presentation: { ...e.presentation, interaction } })
            }
          >
            <option value="cloze_drag_drop">{tr("Drag / select words")}</option>
            <option value="inline_selection">{tr("Select within the sentence")}</option>
          </Select>
        </div>
      )}
      {mode === "cloze_drag_drop" && <Select label={tr("Word bank")} value={e.presentation?.bank_scope || "exercise"} onChange={(bank_scope) => onChange({presentation:{...e.presentation,bank_scope}})}>
        <option value="question">{tr("Separate choices for each question")}</option>
        <option value="exercise">{tr("Shared choices for the whole exercise")}</option>
      </Select>}
      {mode === "multiple_choice" && (
        <Select
          label={tr("Correct answers")}
          value={e.kind}
          onChange={(kind) => { if (kind !== "multi" || !["dialogue_reply", "elimination"].includes(e.presentation?.style || "dialogue_reply")) onChange({ kind }); }}
        >
          <option value="choice">{tr("Single answer")}</option>
          {e.kind === "multi" && ["dialogue_reply","elimination"].includes(e.presentation?.style || "dialogue_reply") && <option value="multi" disabled>{tr("Choose Single answer for this style")}</option>}
          {!["dialogue_reply","elimination"].includes(e.presentation?.style || "dialogue_reply") && <option value="multi">{tr("Multiple answers")}</option>}
        </Select>
      )}
      {mode === "categorization" && (
        <div className="author-groups">
          <h3>{tr("Categories")}</h3>
          {(e.presentation.categories || []).map((name, i) => (
            <div className="form-row" key={i}>
              <AField
                label={tr("Group {v0}", { v0: i + 1 })}
                value={name}
                onChange={(v) =>
                  onChange({
                    presentation: {
                      ...e.presentation,
                      categories: e.presentation.categories.map((g, j) =>
                        i === j ? v : g,
                      ),
                    },
                    questions: e.questions.map((q) => ({
                      ...q,
                      accepted_answers: q.accepted_answers.map((a) =>
                        a === name ? v : a,
                      ),
                    })),
                  })
                }
              />
              <Btn
                aria-label={tr("Delete group {v0}", { v0: i + 1 })}
                onClick={() =>
                  onChange({
                    presentation: {
                      ...e.presentation,
                      categories: e.presentation.categories.filter(
                        (_, j) => i !== j,
                      ),
                    },
                  })
                }
              >
                <Icon name="close" />
              </Btn>
            </div>
          ))}
          <Btn
            onClick={() =>
              onChange({
                presentation: {
                  ...e.presentation,
                  categories: [
                    ...(e.presentation.categories || []),
                    tr("Group {v0}", { v0: e.presentation.categories.length + 1 }),
                  ],
                },
              })
            }
          >
            <Icon name="plus" />{tr(" Group")}</Btn>
        </div>
      )}
      {["true_false_not_given", "reading"].includes(mode) && (
        <AutoTextarea
          label={tr("Reading")}
          value={e.context || ""}
          onChange={(context) => onChange({ context })}
        />
      )}
      {mode === "reading" && <Select label={tr("Passage format")} value={e.presentation.context_format || "markdown"} onChange={context_format => onChange({presentation:{...e.presentation,context_format}})}><option value="markdown">{tr("Lesson markup")}</option><option value="html">{tr("Safe HTML")}</option></Select>}
      {["short_answer", "audio_dictation"].includes(mode) && (
        <label className="author-switch">
          <input
            type="checkbox"
            checked={e.ignore_case !== false}
            onChange={(x) =>
              onChange({
                ignore_case: x.target.checked,
                ignore_punctuation: x.target.checked,
              })
            }
          />{tr("Ignore case and punctuation")}</label>
      )}
      <div className="author-question-list">
        {e.questions.map((q, i) => (
          <section className="author-question" key={i}>
            <header>
              <h3>
                {mode === "matching"
                  ? tr("Pair")
                  : mode === "categorization"
                    ? tr("Word")
                    : tr("Question")}{" "}
                {i + 1}
              </h3>
              {e.questions.length > 1 && (
                <Btn
                  aria-label={tr("Delete question {v0}", { v0: i + 1 })}
                  onClick={() =>
                    onChange({
                      questions: e.questions.filter((_, j) => i !== j),
                    })
                  }
                >
                  <Icon name="close" />
                </Btn>
              )}
            </header>
            <QuestionForm
              mode={mode}
              kind={e.kind}
              question={q}
              onChange={(p) => update(i, p)}
              categories={e.presentation.categories || []}
              onUpload={onUpload}
            />
            <AutoTextarea label={tr("Explanation / comment · shown after this answer")} value={q.presentation?.explanation || ""} onChange={explanation=>update(i,{presentation:{...q.presentation,explanation}})}/>
          </section>
        ))}
      </div>
      <Btn
        onClick={() =>
          onChange({ questions: [...e.questions, newQuestion(mode)] })
        }
      >
        <Icon name="plus" />{" "}
        {mode === "matching"
          ? tr("Add pair")
          : mode === "categorization"
            ? tr("Add word")
            : tr("Add question")}
      </Btn>
    </section>
  );
}
function QuestionForm({
  mode,
  kind,
  question: q,
  onChange,
  categories,
  onUpload,
}) {
  useLocale();
  if (
    [
      "cloze_drag_drop",
      "inline_selection",
      "inline_error_identification",
    ].includes(mode)
  )
    return <TokenAuthor {...{ mode, q, onChange }} />;
  if (mode === "matching")
    return (
      <div className="pair-author-row">
        <AField
          label={tr("Column A")}
          value={q.prompt}
          onChange={(prompt) => onChange({ prompt })}
        />
        <span>↔</span>
        <AField
          label={tr("Column B")}
          value={q.accepted_answers[0] || ""}
          onChange={(v) => onChange({ accepted_answers: [v] })}
        />
      </div>
    );
  if (mode === "categorization")
    return (
      <div className="form-columns">
        <AField
          label={tr("Word / phrase")}
          value={q.prompt}
          onChange={(prompt) => onChange({ prompt })}
        />
        <Select
          label={tr("Category")}
          value={q.accepted_answers[0] || ""}
          onChange={(v) => onChange({ accepted_answers: [v] })}
        >
          <option value="">{tr("Choose a category")}</option>
          {categories.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </Select>
      </div>
    );
  if (mode === "sentence_building")
    return <SentenceAuthor q={q} onChange={onChange} />;
  return (
    <>
      {mode !== "audio_dictation" && (
        <AutoTextarea
          label={mode === "true_false_not_given" ? tr("Statement") : tr("Prompt")}
          value={q.prompt}
          onChange={(prompt) => onChange({ prompt })}
        />
      )}
      {mode === "audio_dictation" && (
        <>
          <AField
            label={tr("Audio title")}
            value={q.prompt}
            onChange={(prompt) => onChange({ prompt })}
          />
          <div className="form-row">
            <AField
              label={tr("Audio URL")}
              value={q.presentation?.audio || ""}
              placeholder="https://…"
              onChange={(audio) =>
                onChange({ presentation: { ...q.presentation, audio } })
              }
            />
            <label className="file-button">{tr("Download file")}<input
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  if (e.target.files[0])
                    onUpload(e.target.files[0], (audio) =>
                      onChange({ presentation: { ...q.presentation, audio } }),
                    );
                }}
              />
            </label>
          </div>
        </>
      )}
      {["multiple_choice", "reading"].includes(mode) ? (
        <div className="options-editor">
          <h4>{tr("Answer choices")}</h4>
          <p>{tr("Select the letter beside the correct answer. Choices are shuffled during practice; correctness is saved by answer text.")}</p>
          {q.options.map((option, i) => (
            <div className="option-editor-row" key={i}>
              <button
                type="button"
                aria-label={tr("Set answer {v0} correct", { v0: String.fromCharCode(65 + i) })}
                aria-pressed={!!option && q.accepted_answers.includes(option)}
                className={
                  option && q.accepted_answers.includes(option)
                    ? "correct-option"
                    : ""
                }
                onClick={() => {
                  if (option)
                    onChange({
                      accepted_answers:
                        (kind === "multi" || mode === "reading")
                          ? q.accepted_answers.includes(option)
                            ? q.accepted_answers.filter((a) => a !== option)
                            : [...q.accepted_answers, option]
                          : [option],
                    });
                }}
              >
                {option && q.accepted_answers.includes(option)
                  ? "✓"
                  : String.fromCharCode(65 + i)}
              </button>
              <AField
                label={tr("Option {v0}", { v0: String.fromCharCode(65 + i) })}
                value={option}
                onChange={(v) =>
                  onChange({
                    options: q.options.map((o, j) => (i === j ? v : o)),
                    accepted_answers: q.accepted_answers.map((a) =>
                      a === option ? v : a,
                    ),
                  })
                }
              />
              <button
                type="button"
                aria-label={tr("Delete option {v0}", { v0: i + 1 })}
                onClick={() =>
                  onChange({
                    options: q.options.filter((_, j) => i !== j),
                    accepted_answers: q.accepted_answers.filter(
                      (a) => a !== option,
                    ),
                  })
                }
              >
                <Icon name="close" />
              </button>
            </div>
          ))}
          <Btn onClick={() => onChange({ options: [...q.options, ""] })}>
            <Icon name="plus" />{tr(" Option")}</Btn>

        </div>
      ) : mode === "true_false_not_given" ? (
        <Select
          label={tr("Correct answer")}
          value={q.accepted_answers[0] || ""}
          onChange={(v) =>
            onChange({
              accepted_answers: [v],
              options: ["TRUE", "FALSE", "NOT_GIVEN"],
            })
          }
        >
          <option value="">{tr("Choose an answer")}</option>
          <option value="TRUE">{tr("True")}</option>
          <option value="FALSE">{tr("False")}</option>
          <option value="NOT_GIVEN">{tr("Not given")}</option>
        </Select>
      ) : (
        <Lines
          label={
            mode === "audio_dictation"
              ? tr("Reference transcript")
              : mode === "short_answer"
                ? tr("Required answer · one alternative per line")
                : tr("Accepted answers · one variation per line")
          }
          value={q.accepted_answers}
          onChange={(accepted_answers) => onChange({ accepted_answers })}
        />
      )}
    </>
  );
}
function TokenAuthor({ mode, q, onChange }) {
  useLocale();
  const ref = useRef(),
    [selection, setSelection] = useState(null);
  const errorMode = mode === "inline_error_identification";
  const mark = () => {
    if (!selection) return;
    let { start, end } = selection;
    while (start < end && /\s/.test(q.prompt[start])) start++;
    while (end > start && /\s/.test(q.prompt[end - 1])) end--;
    const word = q.prompt.slice(start, end);
    if (!word.trim() || word.includes("{{")) return;
    const id = errorMode
        ? `t${(q.presentation?.tokens?.length || 0) + 1}`
        : String(q.blanks.length + 1),
      prompt =
        q.prompt.slice(0, start) + "{{" + id + "}}" + q.prompt.slice(end);
    if (errorMode)
      onChange({
        prompt,
        presentation: {
          ...q.presentation,
          tokens: [...(q.presentation?.tokens || []), { id, text: word }],
        },
        options: [...q.options, id],
      });
    else
      onChange({
        prompt,
        blanks: [...q.blanks, { answers: [word], options: [word, ""] }],
      });
    setSelection(null);
  };
  return (
    <>
      <label className="work-field">
        <span>{tr("Text")}</span>
        <textarea
          ref={ref}
          rows={6}
          value={q.prompt}
          onChange={(e) => onChange({ prompt: e.target.value })}
          onSelect={(e) => {
            const { selectionStart: start, selectionEnd: end } = e.target;
            setSelection(end > start ? { start, end } : null);
          }}
        />
      </label>
      <div className="selection-toolbar">
        <span>{tr("Highlight words in the text")}</span>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          disabled={!selection}
          onClick={mark}
        >
          {errorMode
            ? tr("Mark words")
            : mode === "inline_selection"
              ? tr("Create options")
              : tr("Create a gap")}
        </button>
      </div>
      {errorMode ? (
        <div className="token-answer-list">
          {(q.presentation?.tokens || []).map((t) => (
            <label key={t.id}>
              <input
                type="checkbox"
                checked={q.accepted_answers.includes(t.id)}
                onChange={(e) =>
                  onChange({
                    accepted_answers: e.target.checked
                      ? [...q.accepted_answers, t.id]
                      : q.accepted_answers.filter((a) => a !== t.id),
                  })
                }
              />
              <strong>{t.text}</strong>
              <span>{tr("Correct answer")}</span>
            </label>
          ))}
        </div>
      ) : (
        q.blanks.map((b, i) => (
          <div className="gap-editor" key={i}>
            <span className="gap-number">{i + 1}</span>
            <AField
              label={tr("Answer")}
              value={b.answers.join(" | ")}
              onChange={(v) =>
                onChange({
                  blanks: q.blanks.map((x, j) =>
                    j === i
                      ? {
                          ...x,
                          answers: v.split("|").map((a) => a.trim()),
                          options:
                            mode === "inline_selection"
                              ? [v, ...(x.options || []).slice(1)]
                              : x.options,
                        }
                      : x,
                  ),
                })
              }
            />
            {mode === "inline_selection" && (
              <AField
                label="Distractors · separated by |"
                value={(b.options || []).slice(1).join(" | ")}
                onChange={(v) =>
                  onChange({
                    blanks: q.blanks.map((x, j) =>
                      j === i
                        ? {
                            ...x,
                            options: [
                              x.answers[0],
                              ...v.split("|").map((a) => a.trim()),
                            ],
                          }
                        : x,
                    ),
                  })
                }
              />
            )}
            <button
              type="button"
              aria-label={tr("Remove gap {v0}", { v0: i + 1 })}
              onClick={() =>
                onChange({
                  prompt: q.prompt.replace(/\{\{(\d+)\}\}/g, (m, n) =>
                    Number(n) === i + 1
                      ? b.answers[0]
                      : `{{${Number(n) > i + 1 ? Number(n) - 1 : n}}}`,
                  ),
                  blanks: q.blanks.filter((_, j) => j !== i),
                })
              }
            >
              <Icon name="close" />
            </button>
          </div>
        ))
      )}
      {mode === "cloze_drag_drop" && (
        <AField
          label={tr("Word bank · separated by commas")}
          value={(q.presentation?.word_bank || q.presentation?.distractors || []).join(", ")}
          onChange={(v) =>
            onChange({
              presentation: {
                ...q.presentation,
                word_bank: v.split(",").map((x) => x.trim()),
                distractors: [],
              },
            })
          }
        />
      )}
    </>
  );
}
function SentenceAuthor({ q, onChange }) {
  useLocale();
  const [sentence, setSentence] = useState(() =>
      q.accepted_answers
        .map((id) => q.presentation?.tokens?.find((t) => t.id === id)?.text)
        .filter(Boolean)
        .join(" "),
    ),
    [noise, setNoise] = useState("");
  const tokens = q.presentation?.tokens || [],
    ordered = q.accepted_answers
      .map((id) => tokens.find((t) => t.id === id))
      .filter(Boolean);
  const create = () => {
    const t = sentence
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((text, i) => ({ id: `w${i}`, text }));
    onChange({
      prompt: q.prompt || "Arrange into a sentence.",
      presentation: { ...q.presentation, tokens: t },
      accepted_answers: t.map((t) => t.id),
    });
  };
  return (
    <>
      <AutoTextarea
        label={tr("Complete sentence")}
        value={sentence}
        onChange={setSentence}
      />
      <Btn onClick={create}>{tr("Split into words")}</Btn>
      <div className="sentence-token-editor">
        {ordered.map((t, i) => (
          <span key={t.id}>
            <strong>{t.text}</strong>
            {i < ordered.length - 1 && (
              <button
                type="button"
                aria-label={tr("Match {v0} with the next word", { v0: t.text })}
                onClick={() => {
                  const next = ordered[i + 1];
                  onChange({
                    presentation: {
                      ...q.presentation,
                      tokens: tokens
                        .filter((x) => x.id !== next.id)
                        .map((x) =>
                          x.id === t.id
                            ? { ...x, text: t.text + " " + next.text }
                            : x,
                        ),
                    },
                    accepted_answers: q.accepted_answers.filter(
                      (id) => id !== next.id,
                    ),
                  });
                }}
              >
                <Icon name="plus" />
              </button>
            )}
          </span>
        ))}
      </div>
      <AField
        label={tr("Hint / translation")}
        value={q.prompt}
        onChange={(prompt) => onChange({ prompt })}
      />
      <div className="form-row">
        <AField label={tr("Distractors")} value={noise} onChange={setNoise} />
        <Btn
          isDisabled={!noise.trim()}
          onClick={() => {
            onChange({
              presentation: {
                ...q.presentation,
                tokens: [
                  ...tokens,
                  { id: crypto.randomUUID(), text: noise.trim() },
                ],
              },
            });
            setNoise("");
          }}
        >{tr("Add")}</Btn>
      </div>
      {tokens
        .filter((t) => !q.accepted_answers.includes(t.id))
        .map((t) => (
          <button
            type="button"
            className="word-chip"
            key={t.id}
            onClick={() =>
              onChange({
                presentation: {
                  ...q.presentation,
                  tokens: tokens.filter((x) => x.id !== t.id),
                },
              })
            }
          >
            {t.text} <Icon name="close" />
          </button>
        ))}
    </>
  );
}
