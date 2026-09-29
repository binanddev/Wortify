import { createPortal } from "react-dom";
import { useEffect, useRef, useState, useId } from "react";
import {
  Button,
  Card,
  CardBody,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/react";
import { motion } from "framer-motion";
import { navigate, useAction } from "./core";
export function Icon({ name = "cards", size = 20 }) {
  const paths = {
    skip: "M4 4l10 8-10 8V4z M18 4v16",
    image: "M3 3h18v18H3z M3 17l6-6 4 4 3-3 5 5 M8 7h.01",
    history: "M3 11a9 9 0 1 1 2 7 M3 4v7h7 M12 7v6l4 2",
    eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
    grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    list: "M3 5h2 M9 5h12 M3 12h2 M9 12h12 M3 19h2 M9 19h12",
    more: "M4 12h1 M11 12h1 M18 12h1",
    close: "m6 6 12 12 M6 18 18 6",
    undo: "M8 4 3 9l5 5 M3 9h10a7 7 0 0 1 0 14",
    upload: "M12 16V3 m-5 5 5-5 5 5 M4 15v6h16v-6",
    download: "M12 3v13 m-5-5 5 5 5-5 M4 17v4h16v-4",
    copy: "M8 8h13v13H8z M16 8V3H3v13h5",
    save: "M4 3h13l4 4v14H3V3z M7 3v6h9V3 M7 21v-7h10v7",
    trash: "M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7",
    refresh: "M20 8a9 9 0 1 0 1 7 M21 3v6h-6",
    play: "m7 3 14 9-14 9z",
    pause: "M6 3h3v18H6z M15 3h3v18h-3z",
    print: "M7 8V3h10v5 M7 17H3V8h18v9h-4 M7 14h10v7H7z",
    chevron_right: "m9 5 7 7-7 7",
    chevron_down: "m5 9 7 7 7-7",
    chevron_left: "m15 5-7 7 7 7",
    cards: "M8 4h12v14H8z M4 8v13h12",
    exercise:
      "M8 4H5v17h14V4h-3 M9 2h6v4H9z M8 11l1 1 2-2 M13 11h3 M8 16l1 1 2-2 M13 16h3",
    book: "M12 5C8 2 3 3 3 3v16s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 2v16",
    folder: "M3 6h7l2 3h9v11H3z",
    edit: "m15 4 5 5 M4 20l5-1L21 7l-5-5L4 14z",
    home: "m3 11 9-8 9 8 M5 10v11h14V10 M10 21v-7h4v7",
    user: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-3c0-6 16-6 16 0v3",
    settings: "M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6",
    plus: "M12 4v16 M4 12h16",
    arrow: "M5 12h14 m-6-6 6 6-6 6",
    search: "M17 17l5 5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    sound: "M4 9h4l5-4v14l-5-4H4z M17 8q5 4 0 8 M20 4q8 8 0 16",
    spark: "m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z",
    check: "m5 12 4 4L20 5",
    class: "M4 3h16v13H4z M8 21l4-5 4 5",
    logout: "M10 3H3v18h7 M8 12h13 m-5-5 5 5-5 5",
    shuffle:
      "M3 5h3c5 0 7 14 12 14h3 m-4-4 4 4-4 4 M3 19h3c2 0 3-2 4-4 M14 9c1-2 2-4 4-4h3 m-4-4 4 4-4 4",
    flip: "M3 8a9 9 0 0 1 16-3l2 3 M21 3v5h-5 M21 16a9 9 0 0 1-16 3l-2-3 M3 21v-5h5",
    star: "m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z",
  };
  return (
    <svg
      data-icon={name}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.cards} />
    </svg>
  );
}
export function Btn({ children, primary = false, onClick, icon, ...props }) {
  return (
    <Button
      className={primary ? "btn primary" : "btn"}
      color={primary ? "primary" : "default"}
      variant={primary ? "solid" : "light"}
      onPress={onClick}
      {...(icon
        ? {
            isIconOnly: true,
            title: typeof children === "string" ? children : undefined,
            "aria-label": typeof children === "string" ? children : undefined,
          }
        : {})}
      {...props}
    >
      {icon ? <Icon name={icon} /> : children}
    </Button>
  );
}
export function Link({ to, children, className = "", onClick, ...props }) {
  return (
    <a
      href={to}
      className={className}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
          e.preventDefault();
          navigate(to);
        }
      }}
      {...props}
    >
      {children}
    </a>
  );
}
export function Glass({ children, className = "", ...props }) {
  return (
    <Card isBlurred shadow="none" className={`glass ${className}`} {...props}>
      <CardBody className="glass-body">{children}</CardBody>
    </Card>
  );
}
export function Page({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="page"
    >
      {children}
    </motion.div>
  );
}
export function Heading({
  eyebrow,
  title,
  description,
  contentDescription = false,
  actions,
}) {
  return (
    <div className="heading">
      <div>
        <h1>{title}</h1>
      </div>
      {actions && (
        <SidebarTools>
          <div className="toolbar">{actions}</div>
        </SidebarTools>
      )}
    </div>
  );
}
export function Status({ error, children }) {
  return error ? (
    <div className="feedback error" role="alert">
      {error}
    </div>
  ) : children ? (
    <div className="feedback" role="status">
      {children}
    </div>
  ) : null;
}
export function ExerciseTypeBadge({ type, label }) {
  return (
    <span
      className="pill exercise-type"
      aria-label={`Dạng bài: ${label || type}`}
    >
      {label || type}
    </span>
  );
}
export function Loading({ resource, children }) {
  if (resource.loading)
    return (
      <div className="loading" role="status">
        <span className="loader" />
        Đang mở không gian học…
      </div>
    );
  if (resource.error)
    return (
      <Glass>
        <Status error={resource.error} />
        <Btn icon="refresh" onClick={resource.reload}>
          Thử lại
        </Btn>
      </Glass>
    );
  return children(resource.data);
}
export function SidebarTools({ children, navOnly = false }) {
  const [target, setTarget] = useState(null);
  useEffect(() => {
    setTarget(document.getElementById("workspace-tools"));
  }, []);
  return target ? (
    createPortal(<div className="sidebar-tools-group">{children}</div>, target)
  ) : navOnly ? null : (
    <div className="sidebar-tools-group">{children}</div>
  );
}
export function Field({
  label,
  value,
  onChange,
  multiline = false,
  isRequired,
  isDisabled,
  isInvalid,
  errorMessage,
  description,
  startContent,
  endContent,
  classNames,
  className = "",
  ...props
}) {
  const id = useId();
  const Component = multiline ? "textarea" : "input";
  return (
    <label className={`field native-field ${className}`} htmlFor={id}>
      {label && (
        <span className="field-label">
          {label}
          {isRequired ? " *" : ""}
        </span>
      )}
      <span className="native-field-wrap">
        {startContent}
        <Component
          {...props}
          id={id}
          required={isRequired}
          disabled={isDisabled}
          aria-invalid={isInvalid || undefined}
          aria-describedby={
            description || errorMessage ? `${id}-help` : undefined
          }
          value={String(value ?? "")}
          onChange={(e) => onChange?.(e.target.value)}
        />
        {endContent}
      </span>
      {(description || errorMessage) && (
        <small id={`${id}-help`}>
          {isInvalid ? errorMessage : description}
        </small>
      )}
    </label>
  );
}
export function Select({ label, value, onChange, children, ...props }) {
  return (
    <label className="select-field">
      <span>{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}
export function Editor({
  title,
  fields,
  initial = {},
  onSave,
  onClose,
  children,
}) {
  const [values, set] = useState(initial),
    action = useAction();
  const input = (field) => (
    <Field
      key={field.name}
      {...field}
      value={values[field.name]}
      onChange={(v) => set({ ...values, [field.name]: v })}
    />
  );
  return (
    <Modal
      isOpen
      onClose={onClose}
      size="2xl"
      scrollBehavior="inside"
      classNames={{ base: "glass dialog" }}
    >
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalBody>
          <form
            id="editor-form"
            onSubmit={(e) => {
              e.preventDefault();
              action.run(async (signal) => {
                const close = await onSave(values, signal);
                if (close !== false) onClose();
              });
            }}
          >
            {fields.filter((f) => !f.advanced).map(input)}
            {fields.some((f) => f.advanced) && (
              <details>
                <summary>Thông tin bổ sung</summary>
                {fields.filter((f) => f.advanced).map(input)}
              </details>
            )}
            {typeof children === "function" ? children(values, set) : children}
            <Status error={action.error} />
          </form>
        </ModalBody>
        <ModalFooter>
          <Btn onClick={onClose} isDisabled={action.pending}>
            Hủy
          </Btn>
          <Btn
            primary
            type="submit"
            form="editor-form"
            isLoading={action.pending}
          >
            Lưu thay đổi
          </Btn>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
export function Confirm({ title, description, onConfirm, onClose }) {
  const action = useAction();
  return (
    <Modal isOpen onClose={onClose} classNames={{ base: "glass dialog" }}>
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalBody>
          <p>{description}</p>
          <Status error={action.error} />
        </ModalBody>
        <ModalFooter>
          <Btn onClick={onClose}>Giữ lại</Btn>
          <Btn
            primary
            isLoading={action.pending}
            onClick={() =>
              action.run(async (signal) => {
                await onConfirm(signal);
                onClose();
              })
            }
          >
            Xác nhận xóa
          </Btn>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
export function useSound(enabled, language) {
  const audio = useRef(null);
  useEffect(
    () => () => {
      audio.current?.close();
      window.speechSynthesis?.cancel();
    },
    [],
  );
  return {
    tick: () => {
      if (!enabled) return;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        audio.current ??= new Ctx();
        const c = audio.current;
        c.resume();
        const o = c.createOscillator(),
          g = c.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(620, c.currentTime);
        o.frequency.exponentialRampToValueAtTime(440, c.currentTime + 0.07);
        g.gain.setValueAtTime(0.035, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);
        o.connect(g);
        g.connect(c.destination);
        o.start();
        o.stop(c.currentTime + 0.11);
      } catch {}
    },
    feedback: (correct) => {
      if (!enabled) return;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        audio.current ??= new Ctx();
        const c = audio.current;
        c.resume();
        const notes = correct ? [660, 880] : [220, 165];
        notes.forEach((frequency, index) => {
          const o = c.createOscillator(),
            g = c.createGain();
          o.type = correct ? "sine" : "triangle";
          o.frequency.setValueAtTime(frequency, c.currentTime + index * 0.08);
          g.gain.setValueAtTime(0.03, c.currentTime + index * 0.08);
          g.gain.exponentialRampToValueAtTime(
            0.001,
            c.currentTime + index * 0.08 + 0.12,
          );
          o.connect(g);
          g.connect(c.destination);
          o.start(c.currentTime + index * 0.08);
          o.stop(c.currentTime + index * 0.08 + 0.13);
        });
      } catch {}
    },
    applause: () => {
      if (!enabled) return;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        audio.current ??= new Ctx();
        const c = audio.current;
        c.resume();
        [523, 659, 784, 1047].forEach((frequency, index) => {
          const o = c.createOscillator();
          const g = c.createGain();
          const start = c.currentTime + index * 0.1;
          o.type = "sine";
          o.frequency.setValueAtTime(frequency, start);
          g.gain.setValueAtTime(0.035, start);
          g.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
          o.connect(g);
          g.connect(c.destination);
          o.start(start);
          o.stop(start + 0.24);
        });
      } catch {}
    },
    speak: (text) => {
      if (!window.speechSynthesis)
        throw new Error("Trình duyệt không hỗ trợ giọng đọc.");
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = language === "de" ? "de-DE" : "en-US";
      u.rate = 0.85;
      window.speechSynthesis.speak(u);
    },
  };
}
export function FlipCard({ front, back, example, flipped, setFlipped }) {
  return (
    <button
      type="button"
      className="flip-stage"
      onClick={() => setFlipped(!flipped)}
      aria-label={flipped ? "Lật về từ vựng" : "Lật thẻ xem nghĩa"}
      aria-pressed={flipped}
    >
      <span className={`flip-inner ${flipped ? "flipped" : ""}`}>
        <span className="flip-face" aria-hidden={flipped}>
          <span className="eyebrow">TỪ VỰNG</span>
          <strong>{front}</strong>
        </span>
        <span className="flip-face flip-back" aria-hidden={!flipped}>
          <span className="eyebrow">Ý NGHĨA</span>
          <strong>{back}</strong>
          {example && <span className="example">{example}</span>}
        </span>
      </span>
    </button>
  );
}
export function Choice({
  options,
  value,
  onChange,
  multiple = false,
  disabled = false,
  label = "Chọn đáp án",
  graded = false,
  correctAnswer,
}) {
  const group = useId();
  return (
    <fieldset className="choices" disabled={disabled}>
      <legend className="sr-only">{label}</legend>
      {options.map((text, i) => (
        <label
          className={`choice ${(multiple ? value?.includes(text) : value === text) ? "selected" : ""} ${graded ? (text === correctAnswer ? "answer-correct" : value === text ? "answer-wrong" : "") : ""}`}
          key={text}
        >
          <input
            type={multiple ? "checkbox" : "radio"}
            name={group}
            checked={multiple ? !!value?.includes(text) : value === text}
            onChange={() =>
              onChange(
                multiple
                  ? value?.includes(text)
                    ? value.filter((v) => v !== text)
                    : [...(value || []), text]
                  : text,
              )
            }
          />
          <span className="choice-index">{String.fromCharCode(65 + i)}</span>
          <span>{text}</span>
        </label>
      ))}
    </fieldset>
  );
}
export function WordOrder({ items, value = [], onChange, disabled }) {
  return (
    <div>
      <div className="word-answer" aria-label="Câu đã sắp xếp">
        {value.length ? (
          value.map((id, i) => (
            <Btn
              key={id}
              isDisabled={disabled}
              onClick={() => onChange(value.filter((v) => v !== id))}
            >
              {i + 1}. {items.find((w) => w.id === id)?.text} ×
            </Btn>
          ))
        ) : (
          <span>Chọn các từ bên dưới theo thứ tự…</span>
        )}
      </div>
      <div className="toolbar">
        {items
          .filter((w) => !value.includes(w.id))
          .map((w) => (
            <Btn
              key={w.id}
              isDisabled={disabled}
              onClick={() => onChange([...value, w.id])}
            >
              {w.text}
            </Btn>
          ))}
      </div>
    </div>
  );
}
export function Matching({ left, right, value = {}, onChange, disabled }) {
  const [selected, set] = useState(null);
  return (
    <div className="matching">
      <div>
        {left.map((w, i) => (
          <Btn
            key={w.id}
            isDisabled={disabled}
            className={`match-item ${selected === w.id ? "selected" : ""}`}
            onClick={() => set(w.id)}
          >
            {i + 1}. {w.text}
            {value[w.id] !== undefined ? " ✓" : ""}
          </Btn>
        ))}
      </div>
      <div>
        {right.map((w) => {
          const paired = left.findIndex((l) => value[l.id] === w.id);
          return (
            <Btn
              key={w.id}
              isDisabled={disabled || selected === null}
              className="match-item"
              onClick={() => {
                const next = Object.fromEntries(
                  Object.entries(value).filter(
                    ([k, v]) => k !== selected && v !== w.id,
                  ),
                );
                onChange({ ...next, [selected]: w.id });
                set(null);
              }}
            >
              {paired >= 0 ? `${paired + 1}. ` : ""}
              {w.text}
            </Btn>
          );
        })}
      </div>
    </div>
  );
}
export function Feedback({ row }) {
  const correct = row?.is_correct ?? row?.correct;
  return row ? (
    <motion.div
      className={`feedback ${correct === true ? "feedback-correct" : correct === false ? "feedback-incorrect" : ""}`}
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28 }}
      role="status"
    >
      {row.skipped
        ? "Đã xem đáp án · Cần ôn lại"
        : row.is_correct === undefined
          ? row.correct === null
            ? "Đã lưu • Chờ người chấm"
            : row.correct
              ? "✓ Chính xác"
              : "↻ Cần luyện thêm"
          : row.is_correct
            ? "✓ Đã ghi nhớ"
            : "↻ Cần luyện thêm"}
      {row.target && (
        <>
          <br />
          {row.target} — {row.card?.vietnamese_meaning}
        </>
      )}
      {row.expected?.length > 0 && (
        <>
          <br />
          Đáp án: {row.expected.join(" / ")}
        </>
      )}
    </motion.div>
  ) : null;
}
