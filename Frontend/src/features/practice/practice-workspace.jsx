import { t as tr, useLocale } from "../../i18n/index.js";
import { treeWindow } from "../../components/navigation/tree-window.js";
import { useState } from "react";
import { ModalContent, ModalHeader, ModalBody } from "@heroui/react";
import { Modal } from "../../components/modal/modal.jsx";
import { Icon, Link } from "../../components/ui/ui.jsx";

export function PracticeModal({
  title,
  children,
  onClose,
  pending = false,
  size = "3xl",
}) {
  useLocale();
  return (
    <Modal
      isOpen
      onClose={onClose}
      isDismissable={!pending}
      isKeyboardDismissDisabled={pending}
      hideCloseButton={pending}
      size={size}
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
  compact = true,
}) {
  useLocale();
  const [longBranches, setLongBranches] = useState({});
  const [expanded, setExpanded] = useState({});
  const [hover, setHover] = useState(null);
  const byId = new Map(nodes.map(node => [node.id,node]));
  const children = new Map();
  for (const node of nodes) {
    const parent = byId.has(node.parent) ? node.parent : null;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(node);
  }
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
      parent = byId.get(parent)?.parent;
    }
  }
  const branch = (parent = null, depth = 0) => {
    if (depth > 10) return null;
    const siblings = (children.get(parent) || [])
      .filter(
        (node) => !needle || matches.has(node.id) || ancestors.has(node.id),
      )
      .sort((a, b) => a.position - b.position || a.id - b.id);
    const activeIds = new Set([
      ...ancestors,
      nodes.find((node) => String(node.id) === String(currentId))?.id,
    ]);
    const visible = treeWindow(
      siblings,
      activeIds,
      Boolean(!compact || needle || longBranches[parent]),
    );
    return (
      <>
        {visible.map((node) => {
          const folder = node.kind === "folder";
          const open = needle
            ? true
            : (expanded[node.id] ?? ancestors.has(node.id));
          return (
            <li key={node.id}>
              <div
                className={`practice-tree-row ${String(node.id) === String(currentId) ? "active" : ""} ${hover === node.id ? "drop-target" : ""}`}
                style={{ paddingLeft: 6 + Math.min(depth, 5) * 10 }}
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
                    aria-label={`${open ? "Collapse" : "Open"} ${node.title}`}
                    aria-expanded={open}
                    onClick={() =>
                      setExpanded((v) => ({ ...v, [node.id]: !open }))
                    }
                  >
                    <Icon
                      name={open ? "chevron_down" : "chevron_right"}
                      size={15}
                    />
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
                        : "exercise"
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
                    aria-label={tr("Options {v0}", { v0: node.title })}
                    disabled={pending}
                    onClick={() => onSettings(node)}
                  >
                    <Icon name="more" size={14} />
                  </button>
                ) : (
                  node.kind === "exercise" && (
                    <small title={tr("Completed questions")}>
                      {node.progress?.completed?.length || 0}
                    </small>
                  )
                )}
              </div>
              {folder && open && <ul>{branch(node.id, depth + 1)}</ul>}
            </li>
          );
        })}
        {compact && !needle && siblings.length > 8 && (
          <li>
            <button
              type="button"
              className="tree-overflow"
              title={
                longBranches[parent]
                  ? tr("Collapse branch")
                  : `Show more ${siblings.length - visible.length} items`
              }
              aria-label={
                longBranches[parent]
                  ? tr("Collapse branch")
                  : `Show more ${siblings.length - visible.length} items`
              }
              aria-expanded={Boolean(longBranches[parent])}
              onClick={() =>
                setLongBranches((value) => ({
                  ...value,
                  [parent]: !value[parent],
                }))
              }
            >
              <Icon
                name={longBranches[parent] ? "chevron_down" : "more"}
                size={18}
              />
              <span>
                {longBranches[parent]
                  ? tr("Collapse")
                  : `+${siblings.length - visible.length}`}
              </span>
            </button>
          </li>
        )}
      </>
    );
  };
  return (
    <nav className="practice-tree" aria-label={tr("Content tree")}>
      <ul>{branch()}</ul>
      {!nodes.length && <p>{tr("No content yet.")}</p>}
    </nav>
  );
}
