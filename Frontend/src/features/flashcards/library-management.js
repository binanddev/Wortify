export const DECK_DRAG_TYPE = "application/x-wortify-decks";
export function draggedSelection(id, selected, decks) {
  const owned = new Set(decks.map((deck) => deck.id));
  return (selected.includes(id) ? selected : [id])
    .filter((pk) => owned.has(pk))
    .slice(0, 100);
}
export function readDeckDrag(raw, { language, session, decks }) {
  try {
    const data = JSON.parse(raw),
      owned = new Set(decks.map((deck) => deck.id));
    if (
      data.language !== language ||
      data.session !== session ||
      !Array.isArray(data.ids) ||
      !data.ids.length ||
      data.ids.length > 100 ||
      new Set(data.ids).size !== data.ids.length ||
      data.ids.some((id) => !Number.isInteger(id) || !owned.has(id))
    )
      return [];
    return data.ids;
  } catch {
    return [];
  }
}
export function movableDecks(ids, decks, folder) {
  const target =
    folder === "" || folder === "all" || folder == null ? null : Number(folder);
  return ids.filter((id) =>
    decks.some((deck) => deck.id === id && (deck.folder_id ?? null) !== target),
  );
}
export function toggleVisibleSelection(selected, visible, select) {
  const shown = new Set(visible);
  return select
    ? [...new Set([...selected, ...visible])].slice(0, 100)
    : selected.filter((id) => !shown.has(id));
}
