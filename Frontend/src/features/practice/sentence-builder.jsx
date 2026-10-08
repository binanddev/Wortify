import { useRef, useState, useContext, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { shuffled } from "../../lib/core.js";
import { ModalLayerContext, modalRoot } from "../../components/modal/modal.jsx";
import { placeSentenceToken, sentenceInsertionIndex } from "./sentence-tokens.js";

export function SentenceBuilder({
  q,
  value = [],
  onChange,
  disabled,
  uiStyle,
}) {
  const tokens = q.presentation?.tokens || [];
  const [order] = useState(() => shuffled(tokens));
  const root = useRef(null),
    gesture = useRef(null);
  const [drag, setDrag] = useState(null),
    [target, setTarget] = useState(null);
  const reduced = useReducedMotion(),
    inModal = useContext(ModalLayerContext);
  const moving = drag?.moved ? drag.id : null;
  const placed = value.filter(
    (id) => id !== moving && tokens.some((token) => token.id === id),
  );
  const move = (id, index) => {
    if (!disabled) onChange(placeSentenceToken(tokens, value, id, index));
  };
  const tap = (id) => move(id, value.includes(id) ? null : value.length);
  const destination = (event) => {
    const element = document.elementFromPoint(event.clientX, event.clientY);
    if (!element || !root.current?.contains(element)) return null;
    if (element.closest("[data-sentence-bank]")) return { bank: true };
    if (!element.closest("[data-sentence-target]")) return null;
    const marker = element.closest("[data-insertion-index]");
    if (marker) return { index: Number(marker.dataset.insertionIndex) };
    const rects = [...root.current.querySelectorAll("[data-sentence-token]")]
      .filter((node) => node.dataset.sentenceToken !== gesture.current?.id)
      .map((node) => node.getBoundingClientRect());
    return {
      index: sentenceInsertionIndex(
        { x: event.clientX, y: event.clientY },
        rects,
      ),
    };
  };
  const start = (event, id) => {
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const next = {
      id,
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      dx: event.clientX - rect.left,
      dy: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      pointerId: event.pointerId,
      moved: false,
    };
    gesture.current = next;
    root.current.setPointerCapture(event.pointerId);
    setDrag(next);
  };
  const cancel = () => {
    gesture.current = null;
    setDrag(null);
    setTarget(null);
  };
  useEffect(() => {
    if (disabled) cancel();
  }, [disabled]);
  const tokenButton = (token, inSentence = false) => (
    <motion.button
      layout={!reduced}
      transition={
        reduced
          ? { duration: 0 }
          : { type: "spring", stiffness: 500, damping: 36 }
      }
      key={token.id}
      type="button"
      className={`word-chip sentence-word ${inSentence ? "in-sentence" : ""}`}
      data-sentence-token={inSentence ? token.id : undefined}
      disabled={disabled}
      aria-label={`${token.text}. ${inSentence ? "Click to return to the bank; use left/right arrows to reorder" : "Click to add to the sentence"}`}
      onPointerDown={(event) => start(event, token.id)}
      onClick={(event) => {
        if (event.detail === 0) tap(token.id);
      }}
      onKeyDown={(event) => {
        if (!inSentence || disabled) return;
        const index = value.indexOf(token.id);
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          move(token.id, index + (event.key === "ArrowLeft" ? -1 : 1));
        } else if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          move(token.id, null);
        }
      }}
    >
      {token.text}
    </motion.button>
  );
  const marker = (index) =>
    moving &&
    target?.index === index && (
      <span
        key="insertion"
        className="sentence-insertion"
        data-insertion-index={index}
        aria-hidden="true"
        style={{ width: Math.min(drag.width, 200), height: drag.height }}
      />
    );
  return (
    <div
      ref={root}
      className="sentence-builder"
      data-ui-style={uiStyle}
      onPointerMove={(event) => {
        const current = gesture.current;
        if (!current || current.pointerId !== event.pointerId) return;
        const next = {
          ...current,
          x: event.clientX,
          y: event.clientY,
          moved:
            current.moved ||
            Math.hypot(
              event.clientX - current.startX,
              event.clientY - current.startY,
            ) > 5,
        };
        gesture.current = next;
        setDrag(next);
        if (next.moved) setTarget(destination(event));
      }}
      onPointerUp={(event) => {
        const current = gesture.current;
        if (!current || current.pointerId !== event.pointerId) return;
        const dest = current.moved ? destination(event) : null;
        cancel();
        if (root.current.hasPointerCapture(event.pointerId))
          root.current.releasePointerCapture(event.pointerId);
        if (!current.moved) tap(current.id);
        else if (dest) move(current.id, dest.bank ? null : dest.index);
      }}
      onPointerCancel={cancel}
      onLostPointerCapture={cancel}
    >
      <div
        className="sentence-target"
        data-sentence-target
        aria-label="Assembled sentence"
      >
        {placed.flatMap((id, index) => [
          marker(index),
          tokenButton(
            tokens.find((token) => token.id === id),
            true,
          ),
        ])}
        {marker(placed.length)}
        {!placed.length && target?.index === undefined && (
          <span className="drop-placeholder">Place words here</span>
        )}
      </div>
      <div
        className={`word-bank sentence-bank ${target?.bank ? "is-drag-over" : ""}`}
        data-sentence-bank
        aria-label="Word bank; drop a word here to remove it from the sentence"
      >
        {order
          .filter((token) => !value.includes(token.id) && token.id !== moving)
          .map((token) => tokenButton(token))}
      </div>
      {drag?.moved &&
        createPortal(
          <div
            className="sentence-held-token"
            aria-hidden="true"
            style={{
              left: drag.x - drag.dx,
              top: drag.y - drag.dy,
              width: drag.width,
              height: drag.height,
            }}
          >
            {tokens.find((token) => token.id === drag.id)?.text}
          </div>,
          inModal ? modalRoot() : document.body,
        )}
    </div>
  );
}
