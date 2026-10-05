// The insertion index is measured after removing the token being dragged.
export function placeSentenceToken(tokens, value, id, index) {
  const allowed = new Set(tokens.map((token) => token.id));
  if (!allowed.has(id)) return value;
  const rest = [...new Set(value)].filter(
    (key) => key !== id && allowed.has(key),
  );
  if (index === null) return rest;
  const position = Math.max(0, Math.min(rest.length, index));
  return [...rest.slice(0, position), id, ...rest.slice(position)];
}

export function sentenceInsertionIndex(point, rectangles) {
  for (let i = 0; i < rectangles.length; i++) {
    const rect = rectangles[i];
    if (
      point.y < rect.top ||
      (point.y <= rect.bottom && point.x < (rect.left + rect.right) / 2)
    )
      return i;
  }
  return rectangles.length;
}
