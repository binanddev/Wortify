import { Modal as HeroModal } from "@heroui/react";
import { createContext } from "react";

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
  return (
    <ModalLayerContext.Provider value={true}>
      <HeroModal
        scrollBehavior="inside"
        {...props}
        portalContainer={modalRoot()}
        classNames={{
          ...classNames,
          base: `app-modal ${classNames.base || ""}`,
          body: `app-modal-body ${classNames.body || ""}`,
          backdrop: `app-modal-backdrop z-[100001]! ${classNames.backdrop || ""}`,
          wrapper: `app-modal-wrapper z-[100002]! ${classNames.wrapper || ""}`,
        }}
      />
    </ModalLayerContext.Provider>
  );
}
