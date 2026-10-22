import ActionMenu from "../../components/ui/action-menu.jsx";
import { t as tr, useLocale } from "../../i18n/index.js";
import { useEffect, useState } from "react";
import { PracticeModal } from "./practice-workspace.jsx";
import { Btn, Link, Icon, Status, Field } from "../../components/ui/ui.jsx";

export function DestinationPicker({ nodes, ids, onChoose, onClose, pending }) {
  useLocale();
  const excluded = new Set(ids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes)
      if (excluded.has(node.parent) && !excluded.has(node.id)) {
        excluded.add(node.id);
        changed = true;
      }
  }
  const path = (node) => {
    const names = [node.title];
    const seen = new Set([node.id]);
    let parent = nodes.find((n) => n.id === node.parent);
    while (parent && !seen.has(parent.id)) {
      seen.add(parent.id);
      names.unshift(parent.title);
      parent = nodes.find((n) => n.id === parent.parent);
    }
    return names.join(" / ");
  };
  return (
    <div
      className="destination-picker"
      aria-label={tr("Choose an exercise location")}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      {!ids.some(
        (id) => nodes.find((node) => node.id === id)?.kind === "exercise",
      ) && (
        <button type="button" disabled={pending} onClick={() => onChoose(null)}>{tr("My Exercise Library")}</button>
      )}
      {nodes
        .filter((n) => n.kind === "folder" && n.can_edit && !excluded.has(n.id))
        .map((node) => (
          <button
            type="button"
            key={node.id}
            disabled={pending}
            onClick={() => onChoose(node.id)}
          >
            <span className="create-type-icon folder">
              <Icon name="folder" />
            </span>{" "}
            {path(node)}
          </button>
        ))}
    </div>
  );
}

export function PracticeLibrary({
  items,
  nodes,
  lang,
  parent,
  onOrganize,
  onRename,
  onEdit,
  onCreate,
  onPreview,
  onOpen,
  extraMenuItems,
  view = "grid",
  onSettings,
  pending,
  error,
  searching,
  routeBase = "create",
}) {
  useLocale();
  const [groupName, setGroupName] = useState("New folder");
  const [grouping, setGrouping] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [selected, setSelected] = useState([]);
  const [destination, setDestination] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [title, setTitle] = useState("");
  const [hover, setHover] = useState(null);
  const [undo, setUndo] = useState(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    setSelected([]);
    setDestination(false);
    setUndo(null);
  }, [parent]);
  const availableIds = items.map((node) => node.id).join(",");
  useEffect(() => {
    const available = new Set(availableIds.split(",").map(Number));
    setSelected((previous) => previous.filter((id) => available.has(id)));
  }, [availableIds]);
  const toggle = (id) =>
    setSelected((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  const move = async (ids, target, action = "move") => {
    if (pending) return;
    const placements = ids.map((id) => {
      const n = nodes.find((n) => n.id === id);
      return { id, parent: n.parent, position: n.position };
    });
    const ok = await onOrganize({
      action,
      ids,
      parent: target,
      ...(action === "group" ? { title: groupName.trim() || "New folder" } : {}),
    });
    if (ok) {
      setUndo(placements);
      setSelected([]);
      setDestination(false);
      setMessage(action === "group" ? "Folder created." : "Moved.");
    }
    return ok;
  };
  const reorder = async (node, offset) => {
    const siblings = nodes
      .filter((n) => n.can_edit && n.parent === node.parent)
      .sort((a, b) => a.position - b.position || a.id - b.id);
    const index = siblings.findIndex((n) => n.id === node.id);
    const next = index + offset;
    if (next < 0 || next >= siblings.length) return;
    [siblings[index], siblings[next]] = [siblings[next], siblings[index]];
    if (await onOrganize({ action: "reorder", ids: siblings.map((n) => n.id) }))
      setMessage("Exercise order updated.");
  };
  return (
    <section className="practice-library" aria-label={tr("Folder contents")}>
      {(selected.length > 0 || undo) && (
        <div className="deck-management-bar">
          <div
            role="toolbar"
            className="practice-selection-tools"
            aria-label={tr("Selected item tools")}
          >
            {selected.length > 0 && (
              <>
                <p className="mb-3 text-sm font-semibold">{tr("Selected ")}{selected.length}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Btn
                    isIconOnly
                    title={tr("Move")}
                    aria-label={tr("Move selected item")}
                    isDisabled={pending}
                    onClick={() => setDestination(true)}
                  >
                    <Icon name="move" />
                  </Btn>
                  <Btn
                    isIconOnly
                    title={tr("Group into a folder")}
                    aria-label={tr("Group into a folder")}
                    isDisabled={pending}
                    onClick={() => setGrouping(true)}
                  >
                    <Icon name="folder" />
                  </Btn>
                  <Btn isDisabled={pending} onClick={() => setDeleting([...selected])}>
                    <Icon name="trash" />{tr(" Delete selected (")}{selected.length})
                  </Btn>
                  <Btn
                    isIconOnly
                    title={tr("Deselect")}
                    aria-label={tr("Deselect all")}
                    isDisabled={pending}
                    onClick={() => setSelected([])}
                  >
                    <Icon name="close" />
                  </Btn>
                </div>
              </>
            )}
            {undo && (
              <Btn
                isIconOnly
                title={tr("Undo")}
                aria-label={tr("Undo move")}
                isDisabled={pending}
                onClick={async () => {
                  if (
                    await onOrganize({
                      action: "restore",
                      ids: undo.map((node) => node.id),
                      placements: undo,
                    })
                  ) {
                    setUndo(null);
                    setMessage("Undone.");
                  }
                }}
              >
                <Icon name="undo" />
              </Btn>
            )}
          </div>
        </div>
      )}
      {deleting && (
        <PracticeModal title={tr("Delete {v0} selected items?", { v0: deleting.length })} pending={pending} onClose={() => setDeleting(null)}>
          <p>{tr("Selected folders and everything inside them will be deleted, including their learning progress. This cannot be undone.")}</p>
          <ul>{deleting.map(id => <li key={id}>{nodes.find(node => node.id === id)?.title || tr("Selected item")}</li>)}</ul>
          <Status error={error} />
          <div className="flex flex-wrap gap-3">
            <Btn isDisabled={pending} onClick={() => setDeleting(null)}>{tr("Cancel")}</Btn>
            <Btn isDisabled={pending} onClick={async () => {
              if (await onOrganize({action:"delete",ids:deleting})) {
                setSelected([]);setDeleting(null);setDestination(false);setUndo(null);setMessage("Selected items deleted.");
              }
            }}>{pending ? tr("Deleting…") : tr("Delete permanently")}</Btn>
          </div>
        </PracticeModal>
      )}
      {grouping && (
        <PracticeModal
          title={tr("Group into a folder")}
          pending={pending}
          onClose={() => setGrouping(false)}
        >
          <Status error={error} />
          <Field
            label={tr("Folder name")}
            value={groupName}
            onChange={setGroupName}
            maxLength={200}
          />
          <Btn
            primary
            isDisabled={pending || !groupName.trim()}
            onClick={async () => {
              if (await move(selected, parent, "group")) setGrouping(false);
            }}
          >{tr("Gom ")}{selected.length}{tr(" items")}</Btn>
        </PracticeModal>
      )}
      {renaming !== null && nodes.some((node) => node.id === renaming) && (
        <PracticeModal
          title={tr("Rename")}
          size="sm"
          pending={pending}
          onClose={() => setRenaming(null)}
        >
          <Status error={error} />
          <Field
            autoFocus
            label={tr("New name")}
            value={title}
            maxLength={200}
            onChange={setTitle}
            onKeyDown={async (event) => {
              if (
                event.key !== "Enter" ||
                event.nativeEvent.isComposing ||
                pending ||
                !title.trim()
              )
                return;
              event.preventDefault();
              if (
                await onRename(
                  nodes.find((node) => node.id === renaming),
                  title.trim(),
                )
              )
                setRenaming(null);
            }}
          />
          <Btn
            icon="check"
            title={tr("Save name")}
            aria-label={tr("Save name")}
            isDisabled={pending || !title.trim()}
            onClick={async () => {
              if (
                await onRename(
                  nodes.find((node) => node.id === renaming),
                  title.trim(),
                )
              )
                setRenaming(null);
            }}
          >{tr("Save name")}</Btn>
        </PracticeModal>
      )}
      <div className="library-notice" role="status">
        {tr(message)}
      </div>
      {destination && (
        <PracticeModal
          title={tr("Move")}
          pending={pending}
          onClose={() => setDestination(false)}
        >
          <Status error={error} />
          <DestinationPicker
            {...{ nodes, pending }}
            ids={selected}
            onClose={() => setDestination(false)}
            onChoose={(target) => move(selected, target)}
          />
        </PracticeModal>
      )}
      <div className={`hub-grid library-view-${view}`}>
        {items.map((node) => {
          const folder = node.kind === "folder";
          const siblings = nodes.filter(other=>other.can_edit && other.parent===node.parent).sort((a,b)=>a.position-b.position || a.id-b.id);
          const siblingIndex = siblings.findIndex(other=>other.id===node.id);
          return (
            <article
              key={node.id}
              data-kind={node.kind}
              className={`hub-tile library-card ${selected.includes(node.id) ? "is-selected" : ""} ${hover === node.id ? "is-drop-target" : ""}`}
              draggable={node.can_edit && !pending && renaming !== node.id}
              onDragStart={(event) => {
                event.dataTransfer.setData(
                  "application/x-practice-nodes",
                  JSON.stringify(
                    selected.includes(node.id) ? selected : [node.id],
                  ),
                );
                event.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(event) => {
                if (
                  folder &&
                  node.can_edit &&
                  event.dataTransfer.types.includes(
                    "application/x-practice-nodes",
                  )
                ) {
                  event.preventDefault();
                  setHover(node.id);
                }
              }}
              onDragLeave={() => setHover(null)}
              onDrop={(event) => {
                if (!folder || !node.can_edit) return;
                event.preventDefault();
                setHover(null);
                try {
                  const ids = JSON.parse(
                    event.dataTransfer.getData("application/x-practice-nodes"),
                  );
                  if (
                    Array.isArray(ids) &&
                    ids.every((id) =>
                      nodes.some((n) => n.id === id && n.can_edit),
                    )
                  )
                    move(ids, node.id);
                } catch {}
              }}
            >
              <div className="library-card-top">
                <span className="library-card-icon" aria-hidden="true">
                  <Icon
                    name={
                      folder
                        ? "folder"
                        : node.kind === "exercise"
                          ? "exercise"
                          : "book"
                    }
                    size={24}
                  />
                </span>
                {node.can_edit && (
                  <label className="library-card-select"><input
                    type="checkbox"
                    aria-label={tr("Choose {v0}", { v0: node.title })}
                    checked={selected.includes(node.id)}
                    disabled={pending}
                    onChange={() => toggle(node.id)}
                  /></label>
                )}
              </div>
              {!folder && (onOpen || onPreview) ? (
                <button
                  type="button"
                  className="library-card-title text-left"
                  title={tr("Preview {v0}", { v0: node.title })}
                  onClick={() => (onOpen || onPreview)(node)}
                >
                  {node.title}
                </button>
              ) : (
                <Link
                  to={`/${lang}/${routeBase}/${node.id}`}
                  className="library-card-title"
                >
                  {node.title}
                </Link>
              )}
              <small>
                {folder
                  ? tr("{count} items",{count:nodes.filter((n) => n.parent === node.id).length})
                  : node.kind === "theory"
                    ? tr("Reading content")
                    : node.payload?.questions || node.question_count != null ? tr("{count} questions",{count:node.question_count ?? node.payload.questions.length}) : tr("Exercises")}
              </small>
              {node.can_edit && (
                <div className="library-card-actions">
                  {folder && onCreate && (
                    <Btn
                      isIconOnly
                      title={tr("Add")}
                      aria-label={tr("Add to {v0}", { v0: node.title })}
                      isDisabled={pending}
                      onClick={() => onCreate(node)}
                    >
                      <Icon name="plus" />
                    </Btn>
                  )}
                  {!folder && onPreview && (
                    <Btn
                      isIconOnly
                      title={tr("Preview")}
                      aria-label={tr("Preview {v0}", { v0: node.title })}
                      onClick={() => onPreview(node)}
                    >
                      <Icon name="eye" />
                    </Btn>
                  )}
                  {!folder && (
                    <Btn
                      isIconOnly
                      title={tr("Edit exercise")}
                      aria-label={tr("Edit {v0}", { v0: node.title })}
                      isDisabled={pending}
                      onClick={() => onEdit(node)}
                    >
                      <Icon name="edit" />
                    </Btn>
                  )}
                  <ActionMenu label={tr("Options {v0}",{v0:node.title})} disabled={pending} items={[
                    ...(extraMenuItems?.(node) || []),
                    {key:"rename",icon:"edit",label:"Rename",run:()=>{setRenaming(node.id);setTitle(node.title);}},
                    {key:"move",icon:"move",label:"Move",run:()=>{setSelected([node.id]);setDestination(true);}},
                    ...(!searching ? [{key:"earlier",icon:"chevron_left",label:" Move earlier",disabled:siblingIndex<=0,run:()=>reorder(node,-1)},{key:"later",icon:"chevron_right",label:" Move later",disabled:siblingIndex>=siblings.length-1,run:()=>reorder(node,1)}] : []),
                    ...(onSettings ? [{key:"settings",icon:"settings",label:"Content options",run:()=>onSettings(node)}] : []),
                    {key:"delete",icon:"trash",label:"Delete permanently",danger:true,divider:true,run:()=>setDeleting([node.id])},
                  ]}/>

                </div>
              )}
            </article>
          );
        })}
      </div>
      {!items.length && (
        <div className="library-empty">
          <Icon name="folder" size={32}/>
          <p>
            {searching ? tr("No matching exercises found.") : tr("No content yet.")}
          </p>
        </div>
      )}
    </section>
  );
}
