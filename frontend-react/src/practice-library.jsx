import { useEffect, useState } from "react";
import { PracticeModal } from "./practice-workspace";
import { Btn, Link, Icon, SidebarTools, Status, Field } from "./ui";

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
      aria-label="Chọn nơi đặt bài"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      {!ids.some(
        (id) => nodes.find((node) => node.id === id)?.kind === "exercise",
      ) && (
        <button type="button" disabled={pending} onClick={() => onChoose(null)}>
          My Exercise Library
        </button>
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
  view = "grid",
  onSettings,
  pending,
  error,
  searching,
  routeBase = "create",
}) {
  const [menuId, setMenuId] = useState(null);
  const [groupName, setGroupName] = useState("Folde mới");
  const [grouping, setGrouping] = useState(false);
  const menu = nodes.find((node) => node.id === menuId);
  const menuSiblings = menu
    ? nodes
        .filter((node) => node.can_edit && node.parent === menu.parent)
        .sort((a, b) => a.position - b.position || a.id - b.id)
    : [];
  const menuIndex = menuSiblings.findIndex((node) => node.id === menuId);
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
  const availableIds = nodes.map((node) => node.id).join(",");
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
      ...(action === "group" ? { title: groupName.trim() || "Folde mới" } : {}),
    });
    if (ok) {
      setUndo(placements);
      setSelected([]);
      setDestination(false);
      setMessage(action === "group" ? "Đã tạo folde." : "Đã di chuyển.");
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
      setMessage("Đã đổi thứ tự bài.");
  };
  return (
    <section className="practice-library" aria-label="Nội dung folde">
      {(selected.length > 0 || undo) && (
        <SidebarTools navOnly>
          <div
            className="border-t border-(--line) pt-4"
            aria-label="Công cụ mục đã chọn"
          >
            {selected.length > 0 && (
              <>
                <p className="mb-3 text-sm font-semibold">
                  Đã chọn {selected.length}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Btn
                    isIconOnly
                    title="Di chuyển"
                    aria-label="Di chuyển mục đã chọn"
                    isDisabled={pending}
                    onClick={() => setDestination(true)}
                  >
                    <Icon name="arrow" />
                  </Btn>
                  <Btn
                    isIconOnly
                    title="Gom thành folde"
                    aria-label="Gom thành folde"
                    isDisabled={pending}
                    onClick={() => setGrouping(true)}
                  >
                    <Icon name="folder" />
                  </Btn>
                  <Btn
                    isIconOnly
                    title="Bỏ chọn"
                    aria-label="Bỏ chọn tất cả"
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
                title="Hoàn tác"
                aria-label="Hoàn tác di chuyển"
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
                    setMessage("Đã hoàn tác.");
                  }
                }}
              >
                <Icon name="undo" />
              </Btn>
            )}
          </div>
        </SidebarTools>
      )}
      {grouping && (
        <PracticeModal
          title="Gom thành folde"
          pending={pending}
          onClose={() => setGrouping(false)}
        >
          <Status error={error} />
          <Field
            label="Tên folde"
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
          >
            Gom {selected.length} mục
          </Btn>
        </PracticeModal>
      )}
      {renaming !== null && nodes.some((node) => node.id === renaming) && (
        <PracticeModal
          title="Đổi tên"
          size="sm"
          pending={pending}
          onClose={() => setRenaming(null)}
        >
          <Status error={error} />
          <Field
            autoFocus
            label="Tên mới"
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
            title="Lưu tên"
            aria-label="Lưu tên"
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
          >
            Lưu tên
          </Btn>
        </PracticeModal>
      )}
      {menu && (
        <PracticeModal
          title={menu.title}
          size="sm"
          pending={pending}
          onClose={() => setMenuId(null)}
        >
          <Status error={error} />
          <div className="grid gap-2 [&>button]:w-full [&>button]:justify-start">
            <Btn
              isDisabled={pending}
              onClick={() => {
                setRenaming(menu.id);
                setTitle(menu.title);
                setMenuId(null);
              }}
            >
              <Icon name="edit" />
              Đổi tên
            </Btn>
            <Btn
              isDisabled={pending}
              onClick={() => {
                setSelected([menu.id]);
                setDestination(true);
                setMenuId(null);
              }}
            >
              <Icon name="arrow" />
              Di chuyển
            </Btn>
            {onSettings && (
              <Btn
                isDisabled={pending}
                onClick={() => {
                  setMenuId(null);
                  onSettings(menu);
                }}
              >
                <Icon name="settings" />
                Chia sẻ và xóa
              </Btn>
            )}
            {!searching && (
              <>
                <Btn
                  isDisabled={pending || menuIndex <= 0}
                  onClick={() => reorder(menu, -1)}
                >
                  <Icon name="chevron_left" /> Đưa lên trước
                </Btn>
                <Btn
                  isDisabled={pending || menuIndex >= menuSiblings.length - 1}
                  onClick={() => reorder(menu, 1)}
                >
                  <Icon name="chevron_right" /> Đưa ra sau
                </Btn>
              </>
            )}
          </div>
        </PracticeModal>
      )}
      <div className="library-notice" role="status">
        {message}
      </div>
      {destination && (
        <PracticeModal
          title="Di chuyển"
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
                  <input
                    type="checkbox"
                    aria-label={`Chọn ${node.title}`}
                    checked={selected.includes(node.id)}
                    disabled={pending}
                    onChange={() => toggle(node.id)}
                  />
                )}
              </div>
              {!folder && onPreview ? (
                <button
                  type="button"
                  className="library-card-title text-left"
                  title={`Xem trước ${node.title}`}
                  onClick={() => onPreview(node)}
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
                  ? `${nodes.filter((n) => n.parent === node.id).length} nội dung`
                  : node.kind === "theory"
                    ? "Nội dung đọc"
                    : `${node.payload?.questions?.length || 0} câu`}
              </small>
              {node.can_edit && (
                <div className="library-card-actions">
                  {folder && onCreate && (
                    <Btn
                      isIconOnly
                      title="Thêm"
                      aria-label={`Thêm vào ${node.title}`}
                      isDisabled={pending}
                      onClick={() => onCreate(node)}
                    >
                      <Icon name="plus" />
                    </Btn>
                  )}
                  {!folder && onPreview && (
                    <Btn
                      isIconOnly
                      title="Xem trước"
                      aria-label={`Xem trước ${node.title}`}
                      onClick={() => onPreview(node)}
                    >
                      <Icon name="eye" />
                    </Btn>
                  )}
                  {!folder && (
                    <Btn
                      isIconOnly
                      title="Sửa bài"
                      aria-label={`Sửa ${node.title}`}
                      isDisabled={pending}
                      onClick={() => onEdit(node)}
                    >
                      <Icon name="edit" />
                    </Btn>
                  )}
                  <Btn
                    isIconOnly
                    title="Tùy chọn"
                    aria-label={`Tùy chọn ${node.title}`}
                    isDisabled={pending}
                    onClick={() => setMenuId(node.id)}
                  >
                    <Icon name="more" />
                  </Btn>
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
            {searching ? "Chưa tìm thấy bài phù hợp." : "Chưa có nội dung."}
          </p>
        </div>
      )}
    </section>
  );
}
