import { useEffect, useState } from "react";
import { Btn, Link } from "./ui";

export function DestinationPicker({ nodes, ids, onChoose, onClose, pending }) {
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
      role="dialog"
      aria-modal="false"
      aria-label="Chọn nơi đặt bài"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div className="toolbar">
        <h3>Đặt bài ở đâu nhỉ?</h3>
        <Btn onClick={onClose}>Đóng</Btn>
      </div>
      <p>Chạm một thư mục để di chuyển ngay.</p>
      <button type="button" disabled={pending} onClick={() => onChoose(null)}>
        ⌂ Tất cả nội dung
      </button>
      {nodes
        .filter((n) => n.kind === "folder" && n.can_edit && !excluded.has(n.id))
        .map((node) => (
          <button
            type="button"
            key={node.id}
            disabled={pending}
            onClick={() => onChoose(node.id)}
          >
            📁 {path(node)}
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
  pending,
  searching,
  routeBase = "create",
}) {
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
      ...(action === "group" ? { title: "Nhóm bài mới" } : {}),
    });
    if (ok) {
      setUndo(placements);
      setSelected([]);
      setDestination(false);
      setMessage(
        action === "group"
          ? "Đã gom bài vào “Nhóm bài mới”. Bạn có thể đổi tên ngay trên thẻ."
          : "Đã chuyển bài. Góc học gọn hơn rồi!",
      );
    }
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
      setMessage("Đã đổi thứ tự bài.");
  };
  return (
    <section className="practice-library" aria-label="Nội dung trong thư mục">
      <div className="library-heading">
        <h2>Nội dung của bạn</h2>
        <span>{items.length} nội dung</span>
      </div>
      {selected.length > 0 && (
        <div className="selection-bar">
          <strong>Đã chọn {selected.length}</strong>
          <Btn isDisabled={pending} onClick={() => setDestination(true)}>
            Di chuyển
          </Btn>
          <Btn
            isDisabled={pending}
            onClick={() => move(selected, parent, "group")}
          >
            Gom thành nhóm
          </Btn>
          <Btn onClick={() => setSelected([])}>Bỏ chọn</Btn>
        </div>
      )}
      <div className="library-notice" role="status">
        {message}
        {undo && (
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              if (
                await onOrganize({
                  action: "restore",
                  ids: undo.map((n) => n.id),
                  placements: undo,
                })
              ) {
                setUndo(null);
                setMessage("Đã hoàn tác di chuyển.");
              }
            }}
          >
            Hoàn tác
          </button>
        )}
      </div>
      {destination && (
        <DestinationPicker
          {...{ nodes, pending }}
          ids={selected}
          onClose={() => setDestination(false)}
          onChoose={(target) => move(selected, target)}
        />
      )}
      <div className="hub-grid">
        {items.map((node) => {
          const folder = node.kind === "folder";
          const siblings = nodes
            .filter((n) => n.can_edit && n.parent === node.parent)
            .sort((a, b) => a.position - b.position || a.id - b.id);
          const index = siblings.findIndex((n) => n.id === node.id);
          return (
            <article
              key={node.id}
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
                  {folder ? "📁" : node.kind === "theory" ? "📖" : "🌼"}
                </span>
                {node.can_edit && (
                  <input
                    type="checkbox"
                    aria-label={`Chọn ${node.title}`}
                    checked={selected.includes(node.id)}
                    disabled={pending}
                    onChange={() => toggle(node.id)}
                  />
                )}
              </div>
              {renaming === node.id ? (
                <div className="inline-rename">
                  <input
                    autoFocus
                    aria-label="Tên mới"
                    maxLength={200}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    onKeyDown={async (event) => {
                      if (event.key === "Escape") setRenaming(null);
                      if (
                        event.key === "Enter" &&
                        title.trim() &&
                        (await onRename(node, title.trim()))
                      )
                        setRenaming(null);
                    }}
                  />
                  <button
                    type="button"
                    disabled={pending || !title.trim()}
                    onClick={async () => {
                      if (await onRename(node, title.trim())) setRenaming(null);
                    }}
                  >
                    ✓
                  </button>
                  <button type="button" onClick={() => setRenaming(null)}>
                    ×
                  </button>
                </div>
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
                  ? `${nodes.filter((n) => n.parent === node.id).length} nội dung`
                  : node.kind === "theory"
                    ? "Đọc một chút, hiểu thêm một chút"
                    : `${node.progress?.completed?.length || 0} câu đã hoàn thành`}
              </small>
              {node.can_edit && (
                <div className="library-card-actions">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setRenaming(node.id);
                      setTitle(node.title);
                    }}
                  >
                    Đổi tên
                  </button>
                  {node.kind !== "folder" && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onEdit(node)}
                    >
                      Sửa
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setSelected([node.id]);
                      setDestination(true);
                    }}
                  >
                    Chuyển
                  </button>
                  {!searching && (
                    <>
                      <button
                        type="button"
                        aria-label={`Đưa ${node.title} lên trước`}
                        disabled={pending || index <= 0}
                        onClick={() => reorder(node, -1)}
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        aria-label={`Đưa ${node.title} ra sau`}
                        disabled={pending || index >= siblings.length - 1}
                        onClick={() => reorder(node, 1)}
                      >
                        →
                      </button>
                    </>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
      {!items.length && (
        <div className="library-empty">
          <span aria-hidden="true">🌱</span>
          <p>
            {searching
              ? "Chưa tìm thấy bài phù hợp."
              : "Một góc nhỏ đang chờ bài học đầu tiên của bạn."}
          </p>
        </div>
      )}
    </section>
  );
}
