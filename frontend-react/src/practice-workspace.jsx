import { useState } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody } from "@heroui/react";
import { Icon, Link } from "./ui";

export function PracticeModal({ title, children, onClose, pending = false }) {
  return (
    <Modal
      isOpen
      onClose={onClose}
      isDismissable={!pending}
      isKeyboardDismissDisabled={pending}
      hideCloseButton={pending}
      size="3xl"
      scrollBehavior="inside"
      classNames={{ base: "glass practice-modal" }}
    >
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalBody>{children}</ModalBody>
      </ModalContent>
    </Modal>
  );
}

export function PracticeTree({
  nodes,
  base,
  currentId,
  onSettings,
  onMove,
  pending = false,
  query = "",
}) {
  const [expanded, setExpanded] = useState({});
  const [hover, setHover] = useState(null);
  const needle = query.trim().toLocaleLowerCase();
  const matches = new Set(
    nodes
      .filter((n) => n.title.toLocaleLowerCase().includes(needle))
      .map((n) => n.id),
  );
  const ancestors = new Set();
  for (const node of nodes.filter(
    (n) => (needle && matches.has(n.id)) || String(n.id) === String(currentId),
  )) {
    let parent = node.parent;
    const seen = new Set();
    while (parent != null && !seen.has(parent)) {
      seen.add(parent);
      ancestors.add(parent);
      parent = nodes.find((n) => n.id === parent)?.parent;
    }
  }
  const branch = (parent = null, depth = 0) =>
    depth > 3
      ? null
      : nodes
          .filter((n) =>
            parent === null
              ? n.parent == null || !nodes.some((p) => p.id === n.parent)
              : n.parent === parent,
          )
          .filter((n) => !needle || matches.has(n.id) || ancestors.has(n.id))
          .sort((a, b) => a.position - b.position || a.id - b.id)
          .map((node) => {
            const folder = node.kind === "folder";
            const open = needle
              ? true
              : (expanded[node.id] ?? ancestors.has(node.id));
            return (
              <li key={node.id}>
                <div
                  className={`practice-tree-row ${String(node.id) === String(currentId) ? "active" : ""} ${hover === node.id ? "drop-target" : ""}`}
                  style={{ paddingLeft: 6 + depth * 14 }}
                  draggable={Boolean(onMove && !pending)}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      "application/x-practice-nodes",
                      JSON.stringify([node.id]),
                    );
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    if (
                      folder &&
                      onMove &&
                      !pending &&
                      e.dataTransfer.types.includes(
                        "application/x-practice-nodes",
                      )
                    ) {
                      e.preventDefault();
                      setHover(node.id);
                    }
                  }}
                  onDragLeave={() => setHover(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setHover(null);
                    if (!folder || !onMove || pending) return;
                    try {
                      const ids = JSON.parse(
                        e.dataTransfer.getData("application/x-practice-nodes"),
                      );
                      if (
                        Array.isArray(ids) &&
                        ids.length &&
                        !ids.includes(node.id) &&
                        ids.every((id) => nodes.some((n) => n.id === id))
                      )
                        onMove(ids, node.id);
                    } catch {}
                  }}
                >
                  {folder ? (
                    <button
                      type="button"
                      className="tree-icon"
                      aria-label={`${open ? "Thu gọn" : "Mở"} ${node.title}`}
                      aria-expanded={open}
                      onClick={() =>
                        setExpanded((v) => ({ ...v, [node.id]: !open }))
                      }
                    >
                      {open ? "⌄" : "›"}
                    </button>
                  ) : (
                    <span className="tree-spacer" />
                  )}
                  <Icon
                    name={
                      folder
                        ? "folder"
                        : node.kind === "theory"
                          ? "book"
                          : "cards"
                    }
                    size={15}
                  />
                  <Link
                    to={`${base}/${node.id}`}
                    className="tree-title"
                    title={node.title}
                    aria-current={
                      String(node.id) === String(currentId) ? "page" : undefined
                    }
                  >
                    {node.title}
                  </Link>
                  {onSettings ? (
                    <button
                      type="button"
                      className="tree-icon tree-settings"
                      aria-label={`Tùy chọn ${node.title}`}
                      disabled={pending}
                      onClick={() => onSettings(node)}
                    >
                      <Icon name="settings" size={14} />
                    </button>
                  ) : (
                    node.kind === "exercise" && (
                      <small title="Số câu đã hoàn thành">
                        {node.progress?.completed?.length || 0}
                      </small>
                    )
                  )}
                </div>
                {folder && open && <ul>{branch(node.id, depth + 1)}</ul>}
              </li>
            );
          });
  return (
    <nav className="practice-tree" aria-label="Cây nội dung">
      <ul>{branch()}</ul>
      {!nodes.length && <p>Chưa có nội dung.</p>}
    </nav>
  );
}
