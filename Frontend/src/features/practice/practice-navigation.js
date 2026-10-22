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

// Personal content is always part of My practice; pins add accessible shared roots.
export function myPracticeNodes(nodes, pinned = []) {
  return workspaceNodes(nodes, [...ownedPracticeNodes(nodes).map(node => node.id), ...pinned]);
}

export function workspaceNodes(nodes, pinned) {
  const included = new Set(workspaceRoots(nodes, pinned));
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
  const visibleIds = new Set(visible.map(n => n.id));
  return visible.map((n) => ({
    ...n,
    parent: visibleIds.has(n.parent) ? n.parent : null,
  }));
}

// Resolve only ancestors the API has authorized this user to see.
function rootFromIndex(byId, id) {
  let node = byId.get(id);
  const seen = new Set();
  while (node && byId.has(node.parent) && !seen.has(node.parent)) {
    seen.add(node.id);
    node = byId.get(node.parent);
  }
  return node;
}
export function workspaceRoot(nodes, id) {
  return rootFromIndex(new Map(nodes.map(node => [node.id,node])), id);
}
export function workspaceRoots(nodes, pinned) {
  const byId = new Map(nodes.map(node => [node.id,node]));
  return [
    ...new Set(
      pinned
        .map((id) => rootFromIndex(byId, id)?.id)
        .filter((id) => id != null),
    ),
  ];
}
export function toggleWorkspaceRoot(nodes, pinned, id) {
  const roots = workspaceRoots(nodes, pinned);
  const root = workspaceRoot(nodes, id);
  if (!root) return roots;
  return roots.includes(root.id)
    ? roots.filter((id) => id !== root.id)
    : [...roots, root.id];
}
export function catalogRoots(nodes, query = "") {
  const byId = new Map(nodes.map(node => [node.id,node]));
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return nodes.filter(node => !byId.has(node.parent));
  const matches = new Set(
    nodes
      .filter((node) =>
        node.title
          .toLocaleLowerCase()
          .includes(needle),
      )
      .map((node) => rootFromIndex(byId, node.id)?.id),
  );
  return nodes.filter(
    (node) =>
      (!node.parent || !byId.has(node.parent)) &&
      matches.has(node.id),
  );
}

// Search content through its containing folder, retaining only authorized ancestors.
export function practiceFolders(nodes, query = "") {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const needle = query.trim().toLocaleLowerCase();
  const included = new Set();
  for (const node of nodes) {
    if (needle && !node.title.toLocaleLowerCase().includes(needle)) continue;
    let current = node.kind === "folder" ? node : byId.get(node.parent);
    const seen = new Set();
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      if (current.kind === "folder") included.add(current.id);
      current = byId.get(current.parent);
    }
  }
  return nodes.filter(node => node.kind === "folder" && (!needle || included.has(node.id)))
    .sort((a,b) => (a.position || 0) - (b.position || 0) || a.id - b.id)
    .map(node => ({id:node.id, name:node.title, parent_id:byId.get(node.parent)?.kind === "folder" ? node.parent : null}));
}
