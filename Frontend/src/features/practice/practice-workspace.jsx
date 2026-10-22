import { useState } from "react";
import { t as tr, useLocale } from "../../i18n/index.js";
import { FolderTree } from "../flashcards/flashcard-navigation.jsx";
import { practiceFolders } from "./practice-navigation.js";
import { useNavigate } from "../../lib/core.js";
import { ModalContent, ModalHeader, ModalBody } from "@heroui/react";
import { Modal } from "../../components/modal/modal.jsx";
import { Icon, Link } from "../../components/ui/ui.jsx";

function PracticeCloseButton(props) {
  useLocale();
  return <button {...props} type="button" aria-label={tr("Close")}><Icon name="close" size={18}/></button>;
}

export function PracticeModal({
  title,
  children,
  onClose,
  pending = false,
  size = "3xl",
  className = "",
}) {
  useLocale();
  return (
    <Modal
      isOpen
      closeButton={<PracticeCloseButton/>}
      onClose={onClose}
      isDismissable={!pending}
      isKeyboardDismissDisabled={pending}
      hideCloseButton={pending}
      size={size}
      scrollBehavior="inside"
      classNames={{ base: `glass practice-modal ${className}` }}
    >
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalBody>{children}</ModalBody>
      </ModalContent>
    </Modal>
  );
}

export function PracticeTree({ nodes, base, currentId, query = "", renderActions, rootActions, rootLabel = "My Exercise Library", onMove, pending = false }) {
  useLocale();
  const navigate = useNavigate();
  const [hover, setHover] = useState(null);
  const current = nodes.find(node => String(node.id) === String(currentId));
  const selected = current?.kind === "folder" ? current.id : current?.parent;
  const folders = practiceFolders(nodes, query);
  const dropProps = target => ({
    "data-drop-active": hover === target ? true : undefined,
    onDragLeave: event => { if (!event.currentTarget.contains(event.relatedTarget)) setHover(null); },
    onDragOver: event => {
      if (!pending && onMove && event.dataTransfer.types.includes("application/x-practice-nodes")) {
        event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = "move"; setHover(target);
      }
    },
    onDrop: event => {
      setHover(null);
      if (pending || !onMove) return;
      try {
        const ids = JSON.parse(event.dataTransfer.getData("application/x-practice-nodes"));
        if (!Array.isArray(ids) || !ids.length || !ids.every(id => nodes.some(node => node.id === id && node.can_edit)) || ids.includes(target)) return;
        event.preventDefault(); event.stopPropagation(); onMove(ids, target);
      } catch {}
    },
  });
  return <nav className="flash-nav practice-folder-nav" aria-label={tr("Content tree")}>
    <div className="flash-folder-list">
      <div className="flash-tree-row flash-root-row">
        <button className="flash-root-folder" aria-current={!selected ? "page" : undefined} onClick={() => navigate(`${base}/all`)}>
          <Icon name="home" size={18}/><span>{tr(rootLabel)}</span><small>{nodes.filter(node => node.kind !== "folder").length}</small>
        </button>
        {rootActions}
      </div>
      <FolderTree expandAll={Boolean(query.trim())} folders={folders} selected={String(selected ?? "")} onSelect={id => navigate(`${base}/${id}`)} renderActions={folder => renderActions?.(nodes.find(node => node.id === folder.id))} dropProps={dropProps}/>
    </div>
  </nav>;
}

export function PracticeContentCard({ node, base }) {
  useLocale();
  return <Link className="catalog-card practice-content-card" data-kind={node.kind} to={`${base}/${node.id}`}>
    <span className="practice-content-icon"><Icon name={node.kind === "folder" ? "folder" : node.kind === "exercise" ? "exercise" : "book"} size={24}/></span>
    <h3>{node.title}</h3>
    <span className="practice-content-meta"><small>{tr(node.kind === "folder" ? "Folder" : node.kind === "exercise" ? "Exercises" : "Reading content")}</small><Icon name="arrow" size={20}/></span>
  </Link>;
}
