import { useRef, useState } from "react";
import { endpoint, request, useAction } from "../../lib/core.js";
import { t as tr } from "../../i18n/index.js";
import {
  DECK_DRAG_TYPE,
  draggedSelection,
  readDeckDrag,
  movableDecks,
} from "./library-management.js";

export default function useDeckOperations({ lang, data, reload, onDone }) {
  const [pending, setPending] = useState(false),
    [notice, setNotice] = useState(""),
    [undo, setUndo] = useState(null),
    [drag, setDrag] = useState(null);
  const action = useAction(),
    mutex = useRef(false),
    requests = useRef(new Map()),
    dragging = useRef(null),
    session = useRef(null),
    suppressClick = useRef(0);
  session.current ??= crypto.randomUUID();
  const perform = async (payload, signal) => {
    if (mutex.current) throw Error("Please wait for the current operation.");
    mutex.current = true;
    setPending(true);
    action.setError("");
    const normalized = { ...payload };
    if (payload.ids) normalized.ids = [...payload.ids].sort((a, b) => a - b);
    if (payload.action === "copy")
      normalized.names = Object.fromEntries(
        normalized.ids.map((id) => [
          String(id),
          payload.names?.[id] ||
            tr("{title} (copy)", {
              title: data.decks.find((deck) => deck.id === id)?.title || "",
            }).slice(0, 150),
        ]),
      );
    const key = JSON.stringify(normalized);
    if (!requests.current.has(key))
      requests.current.set(key, crypto.randomUUID());
    try {
      const result = await request(
        endpoint(lang, "decks/manage/"),
        "POST",
        { ...normalized, request_id: requests.current.get(key) },
        signal,
      );
      requests.current.delete(key);
      setUndo(result.undoable ? result.operation_id : null);
      const noticeKey =
        payload.action === "move"
          ? "Moved to {folder}"
          : payload.action === "copy"
            ? result.count === 1
              ? "Deck copied"
              : "Copied {count} decks"
            : payload.action === "delete"
              ? result.count === 1
                ? "Deck deleted"
                : "Deleted {count} decks"
              : "Move undone";
      setNotice({
        key: noticeKey,
        values: {
          count: result.count,
          folder:
            data.folders.find((folder) => folder.id === payload.folder)?.name ??
            null,
        },
      });
      onDone();
      reload();
      return result;
    } finally {
      mutex.current = false;
      setPending(false);
    }
  };
  const background = (payload) =>
    action.run((signal) => perform(payload, signal));
  const endDrag = () => {
    dragging.current = null;
    setDrag(null);
    suppressClick.current = Date.now() + 300;
  };
  const dragProps = (id, selected) => ({
    draggable: !pending,
    onDragStart: (e) => {
      if (pending) {
        e.preventDefault();
        return;
      }
      const ids = draggedSelection(id, selected, data.decks);
      if (!ids.length) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.clearData();
      e.dataTransfer.setData(
        DECK_DRAG_TYPE,
        JSON.stringify({ language: lang, session: session.current, ids }),
      );
      e.dataTransfer.effectAllowed = "copyMove";
      dragging.current = { ids, mode: "move", target: undefined };
      setDrag(dragging.current);
      suppressClick.current = Date.now() + 300;
    },
    onDragEnd: endDrag,
  });
  const dropProps = (folder) => ({
    "data-drop-active": drag?.target === folder ? true : undefined,
    onDragOver: (e) => {
      if (
        !dragging.current ||
        pending ||
        !Array.from(e.dataTransfer.types).includes(DECK_DRAG_TYPE)
      )
        return;
      const mode = e.altKey ? "copy" : "move";
      if (
        mode === "move" &&
        !movableDecks(dragging.current.ids, data.decks, folder).length
      )
        return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = mode;
      if (
        dragging.current.target !== folder ||
        dragging.current.mode !== mode
      ) {
        dragging.current = { ...dragging.current, target: folder, mode };
        setDrag(dragging.current);
      }
    },
    onDragLeave: (e) => {
      if (
        !e.currentTarget.contains(e.relatedTarget) &&
        dragging.current?.target === folder
      ) {
        dragging.current = { ...dragging.current, target: undefined };
        setDrag(dragging.current);
      }
    },
    onDrop: (e) => {
      if (!dragging.current || pending) return;
      e.preventDefault();
      e.stopPropagation();
      const ids = readDeckDrag(e.dataTransfer.getData(DECK_DRAG_TYPE), {
        language: lang,
        session: session.current,
        decks: data.decks,
      });
      const copy = e.altKey,
        selected = copy ? ids : movableDecks(ids, data.decks, folder);
      endDrag();
      if (selected.length)
        background({ action: copy ? "copy" : "move", ids: selected, folder });
    },
  });
  return {
    perform,
    background,
    pending,
    error: action.error,
    notice,
    undo,
    clearNotice: () => setNotice(""),
    drag,
    dragProps,
    dropProps,
    suppressClick,
  };
}
