export const searchHistoryKey = (userId, lang) =>
  `wortify:explore-history:${userId}:${lang}`;
export const cleanSearch = (value) =>
  typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, 200)
    : "";
export function normalizeHistory(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .filter(
      (row) => row && typeof row.query === "string" && Number.isFinite(row.at),
    )
    .sort((a, b) => b.at - a.at)
    .flatMap((row) => {
      const query = cleanSearch(row.query),
        id = query.toLocaleLowerCase();
      if (!query || seen.has(id)) return [];
      seen.add(id);
      return [{ query, at: row.at }];
    })
    .slice(0, 30);
}
export function rememberSearch(history, query, at = Date.now()) {
  query = cleanSearch(query);
  if (!query) return normalizeHistory(history);
  return normalizeHistory([
    { query, at },
    ...normalizeHistory(history).filter(
      (row) => row.query.toLocaleLowerCase() !== query.toLocaleLowerCase(),
    ),
  ]);
}
