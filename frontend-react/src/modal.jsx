import { Modal as HeroModal } from "@heroui/react";
import { createContext } from "react";

export const ModalLayerContext = createContext(false);

// A body portal avoids the navigation's transformed stacking contexts.
export function Modal({ classNames = {}, ...props }) {
  return <ModalLayerContext.Provider value={true}><HeroModal {...props} portalContainer={document.body} classNames={{
    ...classNames,
    backdrop: `z-[100001]! ${classNames.backdrop || ""}`,
    wrapper: `z-[100002]! ${classNames.wrapper || ""}`,
  }} /></ModalLayerContext.Provider>;
}
