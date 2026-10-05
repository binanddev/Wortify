import { useEffect, useState, useRef } from "react";
import { endpoint, useResource } from "./core";
import { Btn, Icon, Link } from "./ui";

export function folderAncestors(folders, item) {
  const chain = [],
    seen = new Set();
  while (item && !seen.has(item.id)) {
    seen.add(item.id);
    chain.unshift(item);
    item = folders.find((f) => f.id === item.parent_id);
  }
  return chain;
}
export function folderPath(folders, item) {
  return folderAncestors(folders, item)
    .map((f) => f.name)
    .join(" / ");
}
export function FolderTree({
  folders,
  decks = [],
  lang,
  parent = null,
  selected,
  onSelect,
  depth = 0,
}) {
  return folders
    .filter((f) => (f.parent_id ?? null) === parent)
    .map((f) => (
      <FolderBranch
        key={f.id}
        {...{ f, folders, decks, lang, selected, onSelect, depth }}
      />
    ));
}
function FolderBranch({ f, folders, decks, lang, selected, onSelect, depth }) {
  const activePath = folderAncestors(
    folders,
    folders.find((v) => String(v.id) === selected),
  ).some((v) => v.id === f.id);
  const [open, setOpen] = useState(activePath);
  useEffect(() => {
    if (activePath) setOpen(true);
  }, [activePath]);
  const children = decks.filter((d) => d.folder_id === f.id);
  const expandable =
    children.length > 0 || folders.some((child) => child.parent_id === f.id);
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-1">
        {expandable ? (
          <button
            type="button"
            className="flash-tree-toggle"
            aria-expanded={open}
            aria-label={`${open ? "Thu gọn" : "Mở rộng"} ${f.name}`}
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name="chevron_right" size={16} />
          </button>
        ) : (
          <span className="w-6 shrink-0" />
        )}
        <button
          title={folderPath(folders, f)}
          aria-current={String(f.id) === selected ? "page" : undefined}
          onClick={() => onSelect(String(f.id))}
        >
          <Icon name="folder" />
          <span>{f.name}</span>
        </button>
      </div>
      {open && expandable && (
        <div
          className={
            depth < 4
              ? "ml-3 border-l border-(--line) pl-2"
              : "border-l border-(--line) pl-1"
          }
        >
          <FolderTree
            {...{ folders, decks, lang, selected, onSelect }}
            parent={f.id}
            depth={depth + 1}
          />
          {children.map((d) => (
            <Link
              key={d.id}
              to={`/${lang}/flashcard/deck/${d.id}`}
              title={d.title}
              className="flex min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-base hover:bg-(--surface)"
            >
              <Icon name="cards" />
              <span className="truncate">{d.title}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
export default function FlashcardNavigation({ lang, route }) {
  const resource = useResource(endpoint(lang, "decks/"));
  const { data } = resource;
  const lastRoute = useRef(route);
  useEffect(() => {
    if (lastRoute.current !== route) {
      lastRoute.current = route;
      resource.reload();
    }
  }, [route]);
  const base = `/${lang}/flashcard`;
  const deckId = route.match(/\/deck\/(\d+)/)?.[1];
  const folderId = new URLSearchParams(route.split("?")[1]).get("folder");
  const deck = data?.decks.find((d) => String(d.id) === deckId);
  const folder = data?.folders.find(
    (f) => String(f.id) === String(deck?.folder_id ?? folderId),
  );
  return (
    <div className="flash-route-nav mb-4 grid gap-2 border-b border-(--line) pb-3">
      <div className="flash-icon-row">
        <Link
          className="btn flash-icon-link"
          to={base}
          title="My Flashcards"
          aria-label="My Flashcards"
        >
          <Icon name="home" />
        </Link>
        <Btn icon="undo" onClick={() => window.history.back()}>
          Quay lại
        </Btn>
        <Btn icon="arrow" onClick={() => window.history.forward()}>
          Tiến lên
        </Btn>
        {deck && folder && (
          <Link
            className="btn flash-icon-link"
            to={`${base}?folder=${folder.id}`}
            title={folderPath(data.folders, folder)}
            aria-label={`Về ${folder.name}`}
          >
            <Icon name="folder" />
          </Link>
        )}
      </div>
    </div>
  );
}
