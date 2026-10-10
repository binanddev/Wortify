import { useChoiceOrder } from "./use-choice-order.js";
import { ChoiceLab } from "./choice-lab.jsx";
import { SentenceBuilder } from "./sentence-builder.jsx";
export { SentenceBuilder } from "./sentence-builder.jsx";
import { Icon } from "../../components/ui/ui.jsx";
import { PracticeRichText } from "./practice-rich-text.jsx";
import { MovableGap } from "./movable-gap.jsx";
import { useState, useEffect, useRef, useContext, useMemo } from "react";
import { ModalLayerContext, modalRoot } from "../../components/modal/modal.jsx";
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/react";
import { motion } from "framer-motion";
import { shuffled } from "../../lib/core.js";
import { modeOf } from "./exercise-types.js";
export function AutoTextarea({ label, value = "", onChange, ...props }) {
  const ref = useRef();
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  }, [value]);
  return (
    <label className="work-field">
      <span>{label}</span>
      <textarea
        ref={ref}
        rows={1}
        className="writing-answer"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...props}
      />
    </label>
  );
}
export function AudioPlayer({ src, initialSpeed = 1 }) {
  const ref = useRef(),
    [playing, setPlaying] = useState(false),
    [time, setTime] = useState(0),
    [duration, setDuration] = useState(0),
    [speed, setSpeed] = useState(initialSpeed),
    [error, setError] = useState("");
  useEffect(() => {
    setTime(0);
    setPlaying(false);
    setError("");
    setSpeed(initialSpeed);
    if (ref.current) ref.current.playbackRate = initialSpeed;
  }, [src, initialSpeed]);
  const stamp = (t) =>
    `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
  return (
    <div className="dictation-player">
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onTimeUpdate={() => setTime(ref.current.currentTime)}
        onLoadedMetadata={() => setDuration(ref.current.duration)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() =>
          setError("Unable to load audio. Check the file path.")
        }
      />
      <button
        type="button"
        className="audio-play"
        aria-label={playing ? "Pause" : "Play audio"}
        disabled={!src || !!error}
        onClick={async () => {
          try {
            playing ? ref.current.pause() : await ref.current.play();
          } catch {
            setError("Unable to play audio.");
          }
        }}
      >
        {playing ? "Ⅱ" : "▶"}
      </button>
      <div className="audio-track">
        <input
          aria-label="Playback position"
          type="range"
          min="0"
          max={Number.isFinite(duration) ? duration : 0}
          step="0.1"
          value={time}
          onChange={(e) => {
            ref.current.currentTime = Number(e.target.value);
            setTime(Number(e.target.value));
          }}
        />
        <span>
          {stamp(time)} / {stamp(Number.isFinite(duration) ? duration : 0)}
        </span>
      </div>
      <button
        type="button"
        className="speed-toggle"
        aria-label="Playback speed"
        onClick={() => {
          const v = speed === 1 ? 0.75 : 1;
          setSpeed(v);
          ref.current.playbackRate = v;
        }}
      >
        {speed}×
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
function Chip({
  children,
  value,
  onClick,
  disabled,
  selected = false,
  draggable = true,
  result,
}) {
  return (
    <motion.button
      layout
      type="button"
      className={`word-chip ${selected ? "selected" : ""} ${result === false ? "is-wrong" : result === true ? "is-right" : ""}`}
      aria-invalid={result === false || undefined}
      disabled={disabled}
      aria-pressed={selected}
      draggable={!disabled && draggable}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", String(value))}
      onClick={onClick}
    >
      {children}
    </motion.button>
  );
}
function InlineMenu({ value, options, onChange, disabled, label, invalid }) {
  const [open, setOpen] = useState(false);
  const inModal = useContext(ModalLayerContext);
  return (
    <Popover
      isOpen={open}
      onOpenChange={setOpen}
      placement="bottom"
      showArrow
      portalContainer={inModal ? modalRoot() : undefined}
      style={inModal ? { zIndex: 100003 } : undefined}
    >
      <PopoverTrigger>
        <button
          type="button"
          className={`inline-choice ${value ? "filled" : ""}`}
          disabled={disabled}
          aria-label={label}
          aria-invalid={invalid}
        >
          {value || "\u00a0"}
          <Icon name="chevron_down" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="inline-menu">
        <div role="group" aria-label="Select a word">
          {options.map((o, i) => (
            <button
              autoFocus={i === 0}
              type="button"
              key={i}
              onClick={() => {
                onChange(o);
                setOpen(false);
              }}
            >
              {o}
              {o === value ? " ✓" : ""}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
export function GapPassage({
  q,
  mode,
  answers,
  onAnswer,
  disabled,
  rows = [],
  assets = {},
  uiStyle,
}) {
  const pool = q.presentation?.word_bank || q.presentation?.distractors || [];
  const [chips, setChips] = useState(() =>
    shuffled(pool.map((text, i) => ({ id: String(i), text }))),
  );
  const serializedOptions = JSON.stringify(q.blank_options || q.blanks?.map((b) => b.options || []) || []);
  const options = useMemo(() => JSON.parse(serializedOptions).map(list => shuffled(list)), [q.id, q.prompt, serializedOptions]);
  const [activeBlank, setActiveBlank] = useState(null);
  useEffect(() => {
    setActiveBlank(null);
    setChips(shuffled(pool.map((text, i) => ({ id: String(i), text }))));
  }, [q.id]);
  const text = q.prompt.split(/(\{\{\d+\}\})/g);
  const fill = (key, text) => {
    if (disabled || !text) return;
    onAnswer(key, text);
    setActiveBlank(null);
  };
  const fillNext = (word) => {
    const next =
      activeBlank ??
      Array.from({ length: q.blank_count || q.blanks?.length || 0 }, (_, i) => [
        i,
        answers[`${q.id}_${i}`],
      ]).find(([, value]) => !value)?.[0];
    if (next !== undefined && next !== null) fill(`${q.id}_${next}`, word);
  };
  if (mode !== "inline_selection" && pool.length)
    return (
      <MovableGap
        key={q.id}
        {...{ q, chips, answers, onAnswer, disabled, rows, uiStyle }}
      />
    );
  return (
    <div className="gap-work">
      <div className="fluid-passage">
        {text.map((t, i) => {
          const m = t.match(/^\{\{(\d+)\}\}$/);
          if (!m)
            return (
              <span key={i}>
                <PracticeRichText>{t}</PracticeRichText>
              </span>
            );
          const n = Number(m[1]) - 1,
            key = `${q.id}_${n}`,
            row = rows.find((r) => r.key === key);
          return (
            <span
              className={`gap-token ${row?.correct === true ? "is-right" : row?.correct === false ? "is-wrong" : ""}`}
              key={i}
            >
              {mode === "inline_selection" ? (
                ["pill_toggle", "fall_away"].includes(uiStyle) ? (
                  <span
                    className={`inline-pills ${uiStyle === "fall_away" ? "fall-away-choices" : ""}`}
                    role="group"
                    aria-label={`Gap ${n + 1}`}
                  >
                    {(options[n] || []).map((option) => (
                      <button
                        key={option}
                        type="button"
                        disabled={disabled}
                        aria-pressed={answers[key] === option}
                        className={`${answers[key] === option ? "selected" : ""} ${uiStyle === "fall_away" && row?.correct === true ? answers[key] === option ? "revealed-word" : "fallen-word" : ""}`}
                        onClick={() => fill(key, option)}
                      >
                        {option}
                      </button>
                    ))}
                  </span>
                ) : (
                  <InlineMenu
                    label={`Gap ${n + 1}`}
                    value={answers[key] || ""}
                    options={options[n] || q.options || []}
                    onChange={(v) => fill(key, v)}
                    disabled={disabled}
                  />
                )
              ) : pool.length ? (
                <button
                  type="button"
                  className={`gap-drop ${answers[key] ? "filled" : ""} ${activeBlank === n ? "is-active" : ""}`}
                  disabled={disabled}
                  aria-label={`Gap ${n + 1}${answers[key] ? ": " + answers[key] : ""}`}
                  aria-pressed={activeBlank === n}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    fill(
                      key,
                      chips.find(
                        (c) => c.id === e.dataTransfer.getData("text/plain"),
                      )?.text,
                    );
                  }}
                  onClick={() =>
                    setActiveBlank((current) => (current === n ? null : n))
                  }
                >
                  {answers[key] || <span aria-hidden="true">{"\u00a0"}</span>}
                </button>
              ) : (
                <input
                  aria-label={`Gap ${n + 1}`}
                  className="gap-input"
                  disabled={disabled}
                  value={answers[key] || ""}
                  onChange={(e) => onAnswer(key, e.target.value)}
                />
              )}
            </span>
          );
        })}
      </div>
      {mode !== "inline_selection" && chips.length > 0 && (
        <div className="word-bank" aria-label="Word bank">
          {chips.map((c) => (
            <Chip
              key={c.id}
              value={c.id}
              onClick={() => fillNext(c.text)}
              disabled={disabled}
              draggable={uiStyle !== "tap_fill"}
            >
              {c.text}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
export function ErrorTokens({ q, value = [], onChange, disabled, uiStyle }) {
  const tokens = q.presentation?.tokens || [];
  const toggle = (id) =>
    onChange(
      value.includes(id) ? value.filter((v) => v !== id) : [...value, id],
    );
  return (
    <div
      className={`clickable-passage ${uiStyle === "cross_out" ? "is-cross-out" : ""}`}
    >
      {q.prompt.split(/(\{\{[^}]+\}\})/g).map((t, i) => {
        const m = t.match(/^\{\{([^}]+)\}\}$/),
          token = m && tokens.find((x) => x.id === m[1]);
        return token ? (
          <button
            type="button"
            key={i}
            aria-pressed={value.includes(token.id)}
            className={value.includes(token.id) ? "marked-word" : ""}
            disabled={disabled}
            onClick={() => toggle(token.id)}
          >
            {token.text}
          </button>
        ) : (
          <span key={i}>
            <PracticeRichText>{t}</PracticeRichText>
          </span>
        );
      })}
    </div>
  );
}
export function OptionCards({
  q,
  value,
  onChange,
  multiple = false,
  disabled,
  rows = [],
}) {
  return (
    <div
      className="answer-cards"
      role={multiple ? "group" : "radiogroup"}
      aria-label={`Answer questions ${q.position}`}
    >
      {q.options.map((text, i) => {
        const selected = multiple
          ? (value || []).includes(text)
          : value === text;
        return (
          <button
            type="button"
            role={multiple ? "checkbox" : "radio"}
            aria-checked={selected}
            key={i}
            disabled={disabled}
            className={selected ? "selected" : ""}
            onClick={() =>
              onChange(
                multiple
                  ? selected
                    ? value.filter((v) => v !== text)
                    : [...(value || []), text]
                  : text,
              )
            }
          >
            <span className="option-letter">{String.fromCharCode(65 + i)}</span>
            <span>{text}</span>
            <span className="option-tick">{selected ? "✓" : ""}</span>
          </button>
        );
      })}
    </div>
  );
}
export function Categories({
  questions,
  answers,
  onAnswer,
  disabled,
  exercise,
  rows = [],
}) {
  const [picked, setPicked] = useState(null);
  const groups =
    exercise.presentation?.categories || questions[0]?.options || [];
  const move = (category, id = picked) => {
    if (disabled || !id || !questions.some((q) => String(q.id) === id)) return;
    onAnswer(id, category);
    setPicked(null);
  };
  return (
    <div className="sorting-work">
      <div
        className="category-columns"
        style={{ "--group-count": Math.min(groups.length, 3) }}
      >
        {groups.map((group) => (
          <section
            className="category-bin"
            key={group}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              move(group, e.dataTransfer.getData("text/plain"));
            }}
          >
            <button
              className="category-head"
              type="button"
              disabled={disabled}
              onClick={() => move(group)}
            >
              {group}
              <span>
                {
                  questions.filter((q) => answers[String(q.id)] === group)
                    .length
                }
              </span>
            </button>
            <div>
              {questions
                .filter((q) => answers[String(q.id)] === group)
                .map((q) => (
                  <Chip
                    key={q.id}
                    value={q.id}
                    result={
                      rows.find((row) => row.key === String(q.id))?.correct
                    }
                    disabled={disabled}
                    onClick={() => onAnswer(String(q.id), "")}
                  >
                    <PracticeRichText>{q.prompt}</PracticeRichText>
                  </Chip>
                ))}
            </div>
          </section>
        ))}
      </div>
      <div className="word-bank">
        {questions
          .filter((q) => !answers[String(q.id)])
          .map((q) => (
            <Chip
              key={q.id}
              value={q.id}
              selected={picked === String(q.id)}
              disabled={disabled}
              onClick={() => setPicked(String(q.id))}
            >
              <PracticeRichText>{q.prompt}</PracticeRichText>
            </Chip>
          ))}
      </div>
    </div>
  );
}
export { MatchPairs } from "./match-pairs.jsx";
function CorrectSentence({ q, value, onChange, disabled, uiStyle, revealed }) {
  const original = q.prompt.split(/\s+/);
  const [words, setWords] = useState(() => original);
  const [active, setActive] = useState(null);
  const [draft, setDraft] = useState("");
  useEffect(() => {
    setWords(original);
    setActive(null);
  }, [q.id]);
  const apply = (index, text) => {
    if (disabled) return;
    const next = [...words];
    next[index] = text;
    setWords(next);
    onChange(next.filter(Boolean).join(" "));
    setActive(null);
  };
  return (
    <div className="correction-work">
      <p className="exercise-instruction">
        {uiStyle === "cross_out"
          ? "Tap extra words to cross them out."
          : "Tap a word, enter the correction, then apply it."}
      </p>
      <div className="clickable-passage">
        {original.map((word, i) => (
          <button
            type="button"
            key={i}
            disabled={disabled}
            className={`${words[i] !== word ? "corrected-word" : ""} ${words[i] === "" ? "struck-word" : ""}`}
            aria-pressed={active === i || words[i] !== word}
            onClick={() => {
              if (uiStyle === "cross_out")
                apply(i, words[i] === "" ? word : "");
              else {
                setActive(i);
                setDraft(words[i]);
              }
            }}
          >
            {words[i] || word}
          </button>
        ))}
      </div>
      {active !== null && (
        <div className="correction-editor">
          <label>
            Replacement word
            <input
              autoFocus
              value={draft}
              disabled={disabled}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (draft.trim()) apply(active, draft.trim());
                }
                if (e.key === "Escape") setActive(null);
              }}
            />
          </label>
          <button
            type="button"
            disabled={disabled || !draft.trim()}
            onClick={() => apply(active, draft.trim())}
          >
            Apply
          </button>
          <button type="button" onClick={() => setActive(null)}>
            Cancel
          </button>
        </div>
      )}
      {value && !revealed && (
        <p className="corrected-preview" aria-live="polite">
          Your sentence: {value}
        </p>
      )}
    </div>
  );
}
export function TypeQuestion({
  exercise,
  q,
  answers,
  onAnswer,
  disabled,
  revealed,
  rows = [],
  assets = {},
  uiStyle,
}) {
  const mode = modeOf(exercise),
    key = String(q.id),
    value = answers[key];
  const choiceOptions = useChoiceOrder(`${q.id}:${q.prompt}`, q.options, mode === "multiple_choice");
  q = { ...q, options: choiceOptions };
  if (q.kind !== "multi" && exercise.kind !== "multi" && ["dialogue_reply", "elimination", "evidence_judge"].includes(uiStyle))
    return <ChoiceLab key={q.id} q={q} value={value} onChange={v => onAnswer(key,v)} disabled={disabled} style={uiStyle} />;
  if (mode === "error_correction")
    return (
      <CorrectSentence
        {...{ q, value, disabled, uiStyle, revealed }}
        onChange={(v) => onAnswer(key, v)}
      />
    );
  if (
    mode === "short_answer" &&
    uiStyle === "partial_input" &&
    q.presentation?.prefix
  ) {
    const prefix = q.presentation.prefix;
    return (
      <label className="partial-rewrite">
        <span>{prefix}</span>
        <input
          aria-label="Complete the sentence"
          disabled={disabled}
          value={
            value?.startsWith(prefix)
              ? value.slice(prefix.length).trimStart()
              : value || ""
          }
          onChange={(event) =>
            onAnswer(
              key,
              event.target.value.trim()
                ? `${prefix} ${event.target.value}`
                : "",
            )
          }
        />
      </label>
    );
  }
  if (mode === "inline_selection" || q.blank_count)
    return (
      <GapPassage
        {...{ q, mode, answers, onAnswer, disabled, rows, uiStyle }}
      />
    );
  if (mode === "inline_error_identification")
    return (
      <ErrorTokens
        q={q}
        value={value}
        onChange={(v) => onAnswer(key, v)}
        disabled={disabled}
        uiStyle={uiStyle}
      />
    );
  if (mode === "sentence_building" || q.kind === "order")
    return (
      <SentenceBuilder
        q={q}
        value={value}
        onChange={(v) => onAnswer(key, v)}
        disabled={disabled}
        uiStyle={uiStyle}
      />
    );
  if (mode === "true_false_not_given")
    if (uiStyle === "inline_select")
      return (
        <label className="inline-answer-select">
          <span>Choose an answer</span>
          <select
            value={value || ""}
            disabled={disabled}
            onChange={(event) => onAnswer(key, event.target.value)}
          >
            <option value="" disabled>
              Choose an answer…
            </option>
            <option value="TRUE">True</option>
            <option value="FALSE">False</option>
            <option value="NOT_GIVEN">Not given</option>
          </select>
        </label>
      );
  if (mode === "true_false_not_given")
    return (
      <div
        className="truth-controls"
        role="radiogroup"
        aria-label={`Statement ${q.position}`}
      >
        {[
          ["TRUE", "True"],
          ["FALSE", "False"],
          ["NOT_GIVEN", "Not given"],
        ].map(([v, t]) => (
          <button
            type="button"
            role="radio"
            aria-checked={value === v}
            className={value === v ? "selected" : ""}
            key={v}
            disabled={disabled}
            onClick={() => onAnswer(key, v)}
          >
            {t}
          </button>
        ))}
      </div>
    );
  if (mode === "multiple_choice" && uiStyle === "inline_select")
    return (
      <label className="inline-answer-select">
        <span>Choose an answer</span>
        <select
          value={value || ""}
          disabled={disabled}
          onChange={(event) => onAnswer(key, event.target.value)}
        >
          <option value="" disabled>
            Choose an answer…
          </option>
          {q.options.map((option, index) => (
            <option key={`${option}-${index}`} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  if (q.options?.length)
    return (
      <OptionCards
        q={q}
        value={value}
        onChange={(v) => onAnswer(key, v)}
        multiple={q.kind === "multi"}
        disabled={disabled}
      />
    );
  return (
    <>
      {mode === "audio_dictation" && (
        <AudioPlayer
          src={assets[q.presentation?.audio]?.url || q.presentation?.audio}
          initialSpeed={uiStyle === "listen_repeat" ? 0.75 : 1}
        />
      )}
      <AutoTextarea
        label={
          mode === "audio_dictation" ? "Recognized speech" : "Answer"
        }
        value={value || ""}
        disabled={disabled}
        onChange={(v) => onAnswer(key, v)}
      />
    </>
  );
}
