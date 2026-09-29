import { PracticeRichText } from "./practice-rich-text";
import { useRef, useState, useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { motion, LayoutGroup, useReducedMotion } from "framer-motion";
import { allocateGapTokens, gapMove } from "./gap-tokens";

export function MovableGap({
  q,
  chips,
  answers,
  onAnswer,
  disabled,
  rows,
  uiStyle,
}) {
  const root = useRef(null);
  const gesture = useRef(null);
  const [drag, setDrag] = useState(null);
  const [active, setActive] = useState(null);
  const group = useId();
  const reduced = useReducedMotion();
  const count = q.blank_count || q.blanks?.length || 0;
  const { slots, bank } = allocateGapTokens(chips, answers, q.id, count);
  useEffect(() => {
    gesture.current = null;
    setDrag(null);
    setActive(null);
  }, [q.id, disabled]);
  const move = (token, target) => {
    if (disabled) return;
    for (const [key, value] of gapMove(q.id, slots, token, target))
      onAnswer(key, value);
    setActive(null);
  };
  const tap = (token) => {
    const source = slots.findIndex((c) => c?.id === token.id);
    const target = active ?? slots.findIndex((c) => !c);
    if (source >= 0) move(token, null);
    else if (target >= 0) move(token, target);
  };
  const start = (event, token) => {
    if (disabled || uiStyle === "tap_fill" || event.button !== 0) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const value = {
      token,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      dx: event.clientX - rect.left,
      dy: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      moved: false,
    };
    gesture.current = value;
    root.current.setPointerCapture(event.pointerId);
    setDrag(value);
  };
  const cancel = () => {
    gesture.current = null;
    setDrag(null);
    setActive(null);
  };
  const targetAt = (event) => {
    const element = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest("[data-gap-index]");
    return element && root.current.contains(element)
      ? Number(element.dataset.gapIndex)
      : null;
  };
  const tokenView = (token) => (
    <motion.span
      layoutId={`${group}-${token.id}`}
      className="movable-token"
      transition={
        reduced
          ? { duration: 0 }
          : { type: "spring", stiffness: 480, damping: 34 }
      }
    >
      {token.text}
    </motion.span>
  );
  return (
    <LayoutGroup id={group}>
      <div
        ref={root}
        className="gap-work movable-gap"
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
          setActive(targetAt(event));
        }}
        onPointerUp={(event) => {
          const current = gesture.current;
          if (!current || current.pointerId !== event.pointerId) return;
          const target = targetAt(event);
          const element = document.elementFromPoint(
            event.clientX,
            event.clientY,
          );
          cancel();
          if (!current.moved) tap(current.token);
          else if (target !== null) move(current.token, target);
          else if (
            element?.closest("[data-gap-bank]") ===
            root.current.querySelector("[data-gap-bank]")
          )
            move(current.token, null);
          setActive(null);
        }}
        onPointerCancel={cancel}
        onLostPointerCapture={cancel}
      >
        <div className="fluid-passage">
          {q.prompt.split(/(\{\{\d+\}\})/g).map((part, i) => {
            const match = part.match(/^\{\{(\d+)\}\}$/);
            if (!match)
              return (
                <span key={i}>
                  <PracticeRichText>{part}</PracticeRichText>
                </span>
              );
            const index = Number(match[1]) - 1;
            const token = slots[index];
            const held = token && drag?.token.id === token.id;
            const row = rows.find((r) => r.key === `${q.id}_${index}`);
            return (
              <span
                key={i}
                className={`gap-token ${row?.correct === true ? "is-right" : row?.correct === false ? "is-wrong" : ""}`}
              >
                <button
                  type="button"
                  data-gap-index={index}
                  disabled={disabled}
                  className={`gap-drop ${token && !held ? "filled" : ""} ${active === index ? "is-active" : ""}`}
                  aria-label={`Ô ${index + 1}${token ? `: ${token.text}. Bấm để trả từ về khay` : ""}`}
                  onPointerDown={(event) => token && start(event, token)}
                  onClick={(event) => {
                    if (event.detail === 0 || uiStyle === "tap_fill" || !token)
                      token ? tap(token) : setActive(index);
                  }}
                >
                  {token && !held ? tokenView(token) : <span>{index + 1}</span>}
                </button>
              </span>
            );
          })}
        </div>
        <div
          className="word-bank"
          data-gap-bank
          aria-label="Khay từ; kéo từ về đây để bỏ khỏi ô"
        >
          {bank
            .filter((token) => token.id !== drag?.token.id)
            .map((token) => (
              <button
                key={token.id}
                type="button"
                className="gap-bank-token"
                disabled={disabled}
                onPointerDown={(event) => start(event, token)}
                onClick={(event) => {
                  if (event.detail === 0 || uiStyle === "tap_fill") tap(token);
                }}
              >
                {tokenView(token)}
              </button>
            ))}
        </div>
        {drag &&
          createPortal(
            <div
              className="gap-held-token"
              aria-hidden="true"
              style={{
                left: drag.x - drag.dx,
                top: drag.y - drag.dy,
                width: drag.width,
                height: drag.height,
              }}
            >
              {drag.token.text}
            </div>,
            document.body,
          )}
      </div>
    </LayoutGroup>
  );
}
