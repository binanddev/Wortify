// Matches the existing bounded discovery API.
export const EXPLORE_PAGE_SIZE = 12;
export function explorePage(value) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}
export function exploreScope(route) {
  const [path, search] = route.split("?");
  const params = new URLSearchParams(search);
  params.delete("page"); params.delete("seed"); params.sort();
  return `${path}?${params}`;
}
export function explorePageUrl(path, params, page, seed) {
  const next = new URLSearchParams(params);
  next.set("seed", seed);
  if (page > 1) next.set("page", String(page)); else next.delete("page");
  return `${path}?${next}`;
}
export function explorePageNumbers(page, pages) {
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  return Array.from({length:Math.min(5,pages)}, (_, index)=>start + index);
}
