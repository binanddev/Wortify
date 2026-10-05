// Keep the active path visible even when a long branch is collapsed.
export function treeWindow(nodes, activeIds, expanded = false, limit = 8) {
  if (expanded || nodes.length <= limit) return nodes;
  const initial = nodes.slice(0, limit);
  const active = nodes.find((node) => activeIds.has(node.id));
  if (active && !initial.includes(active)) initial[limit - 1] = active;
  return initial;
}
