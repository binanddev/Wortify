import { EXERCISE_TYPES, modeOf } from "./exercise-types.js";

export function supportedPracticeNodes(nodes) {
  return nodes.filter(
    (node) =>
      node.kind !== "exercise" ||
      EXERCISE_TYPES.some(
        ([mode]) =>
          mode === (node.payload ? modeOf(node.payload) : node.interaction),
      ),
  );
}
export function ownedPracticeNodes(nodes) {
  return supportedPracticeNodes(nodes).filter((node) => node.can_edit);
}
export function folderItems(nodes, parent, query = "") {
  return nodes.filter((node) =>
    query
      ? node.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())
      : parent
        ? node.parent === parent
        : !node.parent || !nodes.some((p) => p.id === node.parent),
  );
}
export const practiceRoutes = (lang) => ({
  learn: `/${lang}/practice`,
  studio: `/${lang}/create`,
  explore: `/${lang}/explore`,
  create: `/${lang}/create/new`,
  guide: `/${lang}/create/guide`,
});
export function legacyPracticeDestination(lang, section, segment) {
  if (section !== "practice") return null;
  return segment === "guide"
    ? practiceRoutes(lang).guide
    : segment === "new"
      ? practiceRoutes(lang).create
      : null;
}

export function workspaceNodes(nodes, pinned) {
  const included = new Set(pinned);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes)
      if (included.has(node.parent) && !included.has(node.id)) {
        included.add(node.id);
        changed = true;
      }
  }
  const visible = nodes.filter((n) => included.has(n.id));
  return visible.map((n) => ({
    ...n,
    parent: visible.some((p) => p.id === n.parent) ? n.parent : null,
  }));
}
