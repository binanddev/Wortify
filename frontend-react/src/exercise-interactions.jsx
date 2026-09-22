import { useState, useEffect, useRef } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/react";
import { motion } from "framer-motion";
import { shuffled } from "./core";
import { modeOf } from "./exercise-types";
export function AutoTextarea({ label, value = "", onChange, ...props }) {
  const ref = useRef();
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = `${Math.max(88, ref.current.scrollHeight)}px`;
    }
  }, [value]);
  return (
    <label className="work-field">
      <span>{label}</span>
      <textarea
        ref={ref}
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...props}
      />
    </label>
  );
}
export function AudioPlayer({ src }) {
  const ref = useRef(),
    [playing, setPlaying] = useState(false),
    [time, setTime] = useState(0),
    [duration, setDuration] = useState(0),
    [speed, setSpeed] = useState(1),
    [error, setError] = useState("");
  useEffect(() => {
    setTime(0);
    setPlaying(false);
    setError("");
  }, [src]);
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
          setError("Không tải được âm thanh. Kiểm tra đường dẫn tệp.")
        }
      />
      <button
        type="button"
        className="audio-play"
        aria-label={playing ? "Tạm dừng" : "Phát âm thanh"}
        disabled={!src || !!error}
        onClick={async () => {
          try {
            playing ? ref.current.pause() : await ref.current.play();
          } catch {
            setError("Không phát được âm thanh.");
          }
        }}
      >
        {playing ? "Ⅱ" : "▶"}
      </button>
      <div className="audio-track">
        <input
          aria-label="Vị trí phát"
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
        aria-label="Tốc độ phát"
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
function Chip({ children, value, onClick, disabled, selected = false }) {
  return (
    <motion.button
      layout
      type="button"
      className={`word-chip ${selected ? "selected" : ""}`}
      disabled={disabled}
      aria-pressed={selected}
      draggable={!disabled}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", String(value))}
      onClick={onClick}
    >
      {children}
    </motion.button>
  );
}
function InlineMenu({ value, options, onChange, disabled, label, invalid }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover isOpen={open} onOpenChange={setOpen} placement="bottom" showArrow>
      <PopoverTrigger>
        <button
          type="button"
          className={`inline-choice ${value ? "filled" : ""}`}
          disabled={disabled}
          aria-label={label}
          aria-invalid={invalid}
        >
          {value || "······"}
          <span aria-hidden="true">⌄</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="inline-menu">
        <div role="group" aria-label="Chọn từ">
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
}) {
  const [picked, setPicked] = useState(null);
  const pool = q.presentation?.word_bank || q.presentation?.distractors || [];
  const [chips] = useState(() =>
    shuffled(pool.map((text, i) => ({ id: String(i), text }))),
  );
  const options =
    q.blank_options || q.blanks?.map((b) => b.options || []) || [];
  const text = q.prompt.split(/(\{\{\d+\}\})/g);
  const fill = (key, text) => {
    if (!text) return;
    onAnswer(key, text);
    setPicked(null);
  };
  return (
    <div className="gap-work">
      <div className="fluid-passage">
        {text.map((t, i) => {
          const m = t.match(/^\{\{(\d+)\}\}$/);
          if (!m) return <span key={i}>{t}</span>;
          const n = Number(m[1]) - 1,
            key = `${q.id}_${n}`,
            row = rows.find((r) => r.key === key);
          return (
            <span
              className={`gap-token ${row?.correct === true ? "is-right" : row?.correct === false ? "is-wrong" : ""}`}
              key={i}
            >
              {mode === "inline_selection" ? (
                <InlineMenu
                  label={`Ô ${n + 1}`}
                  value={answers[key] || ""}
                  options={options[n] || q.options || []}
                  onChange={(v) => fill(key, v)}
                  disabled={disabled}
                />
              ) : pool.length ? (
                <button
                  type="button"
                  className={`gap-drop ${answers[key] ? "filled" : ""}`}
                  disabled={disabled}
                  aria-label={`Ô ${n + 1}${answers[key] ? ": " + answers[key] : ""}`}
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
                    picked ? fill(key, picked.text) : onAnswer(key, "")
                  }
                >
                  {answers[key] || <span>{n + 1}</span>}
                </button>
              ) : (
                <input
                  aria-label={`Ô ${n + 1}`}
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
        <div className="word-bank" aria-label="Từ cho sẵn">
          {chips.map((c) => (
            <Chip
              key={c.id}
              value={c.id}
              selected={picked?.id === c.id}
              onClick={() => setPicked(c)}
              disabled={disabled}
            >
              {c.text}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
export function SentenceBuilder({ q, value = [], onChange, disabled }) {
  const tokens = q.presentation?.tokens || [];
  const [order] = useState(() => shuffled(tokens));
  const add = (id) => {
    if (tokens.some((t) => t.id === id) && !value.includes(id))
      onChange([...value, id]);
  };
  return (
    <div className="sentence-builder">
      <div
        className="sentence-target"
        aria-label="Câu đã xếp"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          add(e.dataTransfer.getData("text/plain"));
        }}
      >
        {value.length ? (
          value.map((id, i) => (
            <span className="placed-token" key={id}>
              <Chip
                value={id}
                onClick={() => onChange(value.filter((v) => v !== id))}
                disabled={disabled}
              >
                {tokens.find((t) => t.id === id)?.text} <small>×</small>
              </Chip>
              <button
                type="button"
                className="move-token"
                aria-label={`Chuyển ${tokens.find((t) => t.id === id)?.text} sang trái`}
                disabled={disabled || i === 0}
                onClick={() => {
                  const n = [...value];
                  [n[i - 1], n[i]] = [n[i], n[i - 1]];
                  onChange(n);
                }}
              >
                ←
              </button>
            </span>
          ))
        ) : (
          <span className="drop-placeholder">Xếp từ vào đây</span>
        )}
      </div>
      <div className="word-bank">
        {order
          .filter((t) => !value.includes(t.id))
          .map((t) => (
            <Chip
              key={t.id}
              value={t.id}
              onClick={() => add(t.id)}
              disabled={disabled}
            >
              {t.text}
            </Chip>
          ))}
      </div>
    </div>
  );
}
export function ErrorTokens({ q, value = [], onChange, disabled }) {
  const tokens = q.presentation?.tokens || [];
  const toggle = (id) =>
    onChange(
      value.includes(id) ? value.filter((v) => v !== id) : [...value, id],
    );
  return (
    <div className="clickable-passage">
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
          <span key={i}>{t}</span>
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
      aria-label={`Đáp án câu ${q.position}`}
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
}) {
  const [picked, setPicked] = useState(null);
  const groups =
    exercise.presentation?.categories || questions[0]?.options || [];
  const move = (category, id = picked) => {
    if (!id || !questions.some((q) => String(q.id) === id)) return;
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
                    disabled={disabled}
                    onClick={() => onAnswer(String(q.id), "")}
                  >
                    {q.prompt} ×
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
              {q.prompt}
            </Chip>
          ))}
      </div>
    </div>
  );
}
export function MatchPairs({ questions, answers, onAnswer, disabled }) {
  const [picked, setPicked] = useState(null);
  const [right] = useState(() =>
    shuffled([...new Set(questions.flatMap((q) => q.options))]),
  );
  return (
    <div className="pairing-work">
      <div className="pair-column">
        <h3>A</h3>
        {questions.map((q, i) => (
          <button
            type="button"
            className={`pair-card ${picked === String(q.id) ? "selected" : ""} ${answers[q.id] ? "paired" : ""}`}
            aria-pressed={picked === String(q.id)}
            key={q.id}
            disabled={disabled}
            onClick={() => setPicked(String(q.id))}
          >
            <b>{i + 1}</b>
            <span>
              {q.prompt}
              {answers[q.id] && <small>↔ {answers[q.id]}</small>}
            </span>
          </button>
        ))}
      </div>
      <div className="pair-column">
        <h3>B</h3>
        {right.map((text, i) => {
          const linked = questions.findIndex((q) => answers[q.id] === text);
          return (
            <button
              type="button"
              key={text}
              className={`pair-card ${linked >= 0 ? "paired" : ""}`}
              disabled={disabled || picked === null}
              onClick={() => {
                const previous = questions.find((q) => answers[q.id] === text);
                if (previous && String(previous.id) !== picked)
                  onAnswer(String(previous.id), "");
                onAnswer(picked, text);
                setPicked(null);
              }}
            >
              <b>{linked >= 0 ? linked + 1 : String.fromCharCode(65 + i)}</b>
              <span>{text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
export function TypeQuestion({
  exercise,
  q,
  answers,
  onAnswer,
  disabled,
  rows = [],
  assets = {},
}) {
  const mode = modeOf(exercise),
    key = String(q.id),
    value = answers[key];
  if (mode === "inline_selection" || q.blank_count)
    return <GapPassage {...{ q, mode, answers, onAnswer, disabled, rows }} />;
  if (mode === "inline_error_identification")
    return (
      <ErrorTokens
        q={q}
        value={value}
        onChange={(v) => onAnswer(key, v)}
        disabled={disabled}
      />
    );
  if (mode === "sentence_building" || q.kind === "order")
    return (
      <SentenceBuilder
        q={q}
        value={value}
        onChange={(v) => onAnswer(key, v)}
        disabled={disabled}
      />
    );
  if (mode === "true_false_not_given")
    return (
      <div
        className="truth-controls"
        role="radiogroup"
        aria-label={`Nhận định ${q.position}`}
      >
        {[
          ["TRUE", "Đúng"],
          ["FALSE", "Sai"],
          ["NOT_GIVEN", "Không có thông tin"],
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
        />
      )}
      <AutoTextarea
        label={
          mode === "audio_dictation" ? "Nội dung nghe được" : "Câu trả lời"
        }
        value={value || ""}
        disabled={disabled}
        onChange={(v) => onAnswer(key, v)}
      />
    </>
  );
}
