import CardImage, {ImageCredit} from "../../features/flashcards/card-image.jsx";
import { t as tr, useLocale } from "../../i18n/index.js";
import { useInterface } from "../../themes/use-interface.js";
import { THEME_ICONS } from "../../themes/icons.js";
import { ICON_COMPONENTS } from "./icon-catalog.js";
import { createPortal } from "react-dom";
import { useContext, useEffect, useRef, useState, useId } from "react";
import {
  Button,
  Card,
  CardBody,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/react";
import { Modal } from "../modal/modal.jsx";
import { motion } from "framer-motion";
import { useNavigate, WindowContext, useAction } from "../../lib/core.js";
export function Icon({ name = "cards", size = 26 }) {
  const theme = useInterface();
  const pixels = Math.max(12, Math.min(96, Number(size) || 26));
  const Glyph = ICON_COMPONENTS[name] || ICON_COMPONENTS.help;
  const props = {className:"app-icon", "data-icon":name, "data-icon-theme":theme,
    width:pixels,height:pixels,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",
    strokeWidth:2.25,strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":true,focusable:false};
  if(theme==="retro"&&["star","heart","trophy"].includes(name)) return <svg {...props}>
    <foreignObject x="0" y="0" width="24" height="24"><div className="flex h-6 w-6 items-center justify-center leading-none"><i className={`nes-icon ${name} is-small`} aria-hidden="true"/></div></foreignObject>
  </svg>;
  const path=THEME_ICONS[theme]?.[name];
  return path ? <svg {...props}><path d={path}/></svg> : <Glyph {...props}/>;
}
export function Btn({ children, primary = false, onClick, icon, ...props }) {
  useLocale();
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
  useLocale();
  const navigate = useNavigate();
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
  useLocale();
  return (
    <Card isBlurred shadow="none" className={`glass ${className}`} {...props}>
      <CardBody className="glass-body">{children}</CardBody>
    </Card>
  );
}
export function Page({ children, className = "" }) {
  useLocale();
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className={`page ${className}`}
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
  useLocale();
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
  useLocale();
  return error ? (
    <div className="feedback error" role="alert">
      {tr(error)}
    </div>
  ) : children ? (
    <div className="feedback" role="status">
      {children}
    </div>
  ) : null;
}
export function ExerciseTypeBadge({ type, label }) {
  useLocale();
  return (
    <span
      className="pill exercise-type"
      aria-label={tr("Exercise type: {v0}", { v0: tr(label || type) })}
    >
      {tr(label || type)}
    </span>
  );
}
export function Loading({
  resource,
  children,
  label = "Opening your learning space…",
}) {
  useLocale();
  if (resource.loading)
    return (
      <div className="loading" role="status">
        <span className="loader" />
        {tr(label)}
      </div>
    );
  if (resource.error)
    return (
      <Glass>
        <Status error={resource.error} />
        <Btn icon="refresh" onClick={resource.reload}>{tr("Retry")}</Btn>
      </Glass>
    );
  return children(resource.data);
}
export function SidebarTools({ children, navOnly = false }) {
  useLocale();
  const scope = useContext(WindowContext);
  const [target, setTarget] = useState(null);
  useEffect(() => {
    setTarget(
      scope ? scope.toolsTarget : document.getElementById("workspace-tools"),
    );
  }, [scope?.toolsTarget]);
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
  useLocale();
  const id = useId();
  const Component = multiline ? "textarea" : "input";
  return (
    <label className={`field native-field ${className}`} htmlFor={id}>
      {label && (
        <span className="field-label">
          {tr(label)}
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
  useLocale();
  return (
    <label className="select-field">
      <span>{tr(label)}</span>
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
  submitLabel = "Save changes",
  fields,
  initial = {},
  onSave,
  onClose,
  children,
}) {
  useLocale();
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
      isDismissable={!action.pending}
      isKeyboardDismissDisabled={action.pending}
      hideCloseButton={action.pending}
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
                <summary>{tr("Additional details")}</summary>
                {fields.filter((f) => f.advanced).map(input)}
              </details>
            )}
            {typeof children === "function" ? children(values, set) : children}
            <Status error={action.error} />
          </form>
        </ModalBody>
        <ModalFooter>
          <Btn onClick={onClose} isDisabled={action.pending}>{tr("Cancel")}</Btn>
          <Btn
            primary
            type="submit"
            form="editor-form"
            isLoading={action.pending}
          >
            {tr(submitLabel)}
          </Btn>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
export function Confirm({
  title,
  description,
  onConfirm,
  onClose,
  confirmLabel = "Confirm deletion",
  cancelLabel = "Keep",
}) {
  useLocale();
  const action = useAction();
  return (
    <Modal isOpen onClose={onClose} isDismissable={!action.pending} isKeyboardDismissDisabled={action.pending} hideCloseButton={action.pending} classNames={{ base: "glass dialog" }}>
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalBody>
          <p>{description}</p>
          <Status error={action.error} />
        </ModalBody>
        <ModalFooter>
          <Btn onClick={onClose} isDisabled={action.pending}>{tr(cancelLabel)}</Btn>
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
            {tr(confirmLabel)}
          </Btn>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
export function useSound(enabled, language) {
  const audio = useRef(null);
  const speech = useRef(null);
  useEffect(
    () => () => {
      audio.current?.close();
      if (speech.current && window.speechSynthesis?.speaking) window.speechSynthesis.cancel();
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
        throw new Error("This browser does not support speech synthesis.");
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = language === "de" ? "de-DE" : "en-US";
      u.rate = 0.85;
      speech.current = u;
      u.onend = u.onerror = () => { if (speech.current === u) speech.current = null; };
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(u);
    },
  };
}
export function FlipCard({ front, back, example, image, flipped, setFlipped }) {
  useLocale();
  const [failedImage,setFailedImage]=useState("");
  const illustration=image?.image_url!==failedImage?image:null;
  return (
    <><button
      type="button"
      className="flip-stage"
      onClick={() => setFlipped(!flipped)}
      aria-label={flipped ? tr("Flip back to the term") : tr("Flip card to see the meaning")}
      aria-pressed={flipped}
    >
      <span className={`flip-inner ${flipped ? "flipped" : ""}`}>
        <span className="flip-face" aria-hidden={flipped}>
          <span className="eyebrow">{tr("VOCABULARY")}</span>
          <strong>{front}</strong>
        </span>
        <span className="flip-face flip-back" aria-hidden={!flipped}>
          <span className="eyebrow">{tr("MEANING")}</span>
          <strong>{back}</strong>
          <CardImage card={illustration} credit={false} onError={()=>setFailedImage(image.image_url)}/>
          {example && <span className="example">{example}</span>}
        </span>
      </span>
    </button>{flipped && <ImageCredit card={illustration}/>}</>
  );
}
export function Choice({
  options,
  value,
  onChange,
  multiple = false,
  disabled = false,
  label = "Choose an answer",
  graded = false,
  correctAnswer,
}) {
  useLocale();
  const group = useId();
  return (
    <fieldset className="choices" disabled={disabled}>
      <legend className="sr-only">{tr(label)}</legend>
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
  useLocale();
  return (
    <div>
      <div className="word-answer" aria-label={tr("Assembled sentence")}>
        {value.length ? (
          value.map((id, i) => (
            <Btn
              key={id}
              isDisabled={disabled}
              onClick={() => onChange(value.filter((v) => v !== id))}
            >
              {i + 1}. {items.find((w) => w.id === id)?.text}{" "}
              <Icon name="close" />
            </Btn>
          ))
        ) : (
          <span>{tr("Select the words below in order…")}</span>
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
  useLocale();
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
  useLocale();
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
        ? tr("Answer revealed · Review again")
        : row.is_correct === undefined
          ? row.correct === null
            ? tr("Saved • Awaiting review")
            : row.correct
              ? tr("✓ Correct")
              : tr("↻ Needs practice")
          : row.is_correct
            ? tr("✓ Remembered")
            : tr("↻ Needs practice")}
      {row.target && (
        <>
          <br />
          {row.target} — {row.card?.vietnamese_meaning}
        </>
      )}
      {row.expected?.length > 0 && (
        <>
          <br />{tr("Answer: ")}{row.expected.join(" / ")}
        </>
      )}
    </motion.div>
  ) : null;
}
