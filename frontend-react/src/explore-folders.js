import {
  supportedPracticeNodes,
  workspaceRoot,
} from "./practice-navigation.js";

export function publicExploreNodes(nodes) {
  return supportedPracticeNodes(nodes).filter(
    (node) => node.visibility === "public",
  );
}
export function exploreFolders(
  nodes,
  results,
  parent = null,
  filtering = false,
) {
  const matches = new Set();
  for (const result of results) {
    let node = nodes.find((node) => node.id === result.id);
    const seen = new Set();
    while (node && !seen.has(node.id)) {
      seen.add(node.id);
      matches.add(node.id);
      node = nodes.find((item) => item.id === node.parent);
    }
  }
  return nodes.filter(
    (node) =>
      (parent != null
        ? node.parent === parent
        : node.kind === "folder" &&
          workspaceRoot(nodes, node.id)?.id === node.id) &&
      (!filtering || matches.has(node.id)),
  );
}
