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
  return visible.map((n) => ({
    ...n,
    parent: visible.some((p) => p.id === n.parent) ? n.parent : null,
  }));
}

// Resolve only ancestors the API has authorized this user to see.
export function workspaceRoot(nodes, id) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  let node = byId.get(id);
  const seen = new Set();
  while (node && byId.has(node.parent) && !seen.has(node.parent)) {
    seen.add(node.id);
    node = byId.get(node.parent);
  }
  return node;
}
export function workspaceRoots(nodes, pinned) {
  return [
    ...new Set(
      pinned
        .map((id) => workspaceRoot(nodes, id)?.id)
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
  const matches = new Set(
    nodes
      .filter((node) =>
        node.title
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase()),
      )
      .map((node) => workspaceRoot(nodes, node.id)?.id),
  );
  return nodes.filter(
    (node) =>
      (!node.parent || !nodes.some((parent) => parent.id === node.parent)) &&
      matches.has(node.id),
  );
}
