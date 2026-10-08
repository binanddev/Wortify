import { WindowContext } from "../../lib/core.js";
import { Modal as HeroModal } from "@heroui/react";
import { createContext, useContext, useEffect, useId } from "react";

export const ModalLayerContext = createContext(false);

export function modalRoot() {
  let root = document.getElementById("modal-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "modal-root";
    document.body.appendChild(root);
  }
  return root;
}

// All dialogs share an isolated body layer above navigation and drag previews.
export function Modal({ classNames = {}, ...props }) {
  const owner = useContext(WindowContext);
  const marker = "child-window-" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const windows = !!owner;
  useEffect(() => {
    if (!windows || !props.isOpen) return;
    owner.activate?.();
    let drag = null;
    const down = (event) => {
      const box = event.target.closest("." + marker);
      if (
        !box ||
        !event.target.closest("header") ||
        event.target.closest("button,a,input") ||
        event.button !== 0
      )
        return;
      const rect = box.getBoundingClientRect();
      drag = {
        box,
        rect,
        x: event.clientX,
        y: event.clientY,
        dx: Number(box.dataset.dragX) || 0,
        dy: Number(box.dataset.dragY) || 0,
      };
      event.preventDefault();
    };
    const move = (event) => {
      if (!drag) return;
      const { box, rect, x, y, dx, dy } = drag;
      const nextX =
        dx +
        Math.max(
          40 - rect.right,
          Math.min(innerWidth - 40 - rect.left, event.clientX - x),
        );
      const nextY =
        dy +
        Math.max(
          -rect.top,
          Math.min(innerHeight - 80 - rect.top, event.clientY - y),
        );
      box.style.translate = `${nextX}px ${nextY}px`;
      box.dataset.dragX = nextX;
      box.dataset.dragY = nextY;
    };
    const stop = () => {
      drag = null;
    };
    document.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      document.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [windows, props.isOpen, marker]);
  return (
    <ModalLayerContext.Provider value={true}>
      <HeroModal
        scrollBehavior="inside"
        {...props}
        portalContainer={modalRoot()}
        classNames={{
          ...classNames,
          base: `app-modal ${marker} ${classNames.base || ""}`,
          body: `app-modal-body ${classNames.body || ""}`,
          backdrop: `app-modal-backdrop z-[100001]! ${classNames.backdrop || ""}`,
          wrapper: `app-modal-wrapper z-[100002]! ${classNames.wrapper || ""}`,
        }}
      />
    </ModalLayerContext.Provider>
  );
}
