export function questionKeys(q) {
  return q.blanks?.length
    ? q.blanks.map((_, i) => `${q.id}_${i}`)
    : [String(q.id)];
}
export function readyToCheck(q, answers) {
  if (!q) return false;
  if (q.kind === "order" && !q.blanks?.length) {
    const value = answers[String(q.id)];
    return (
      Array.isArray(value) &&
      value.length === q.presentation.tokens.length &&
      new Set(value).size === value.length
    );
  }
  return questionKeys(q).every(
    (key) => String(answers[key] ?? "").trim().length > 0,
  );
}
export function mergeProgress(questions, ...snapshots) {
  const valid = new Set(
    questions.filter((q) => !q.example).map((q) => String(q.id)),
  );
  return [
    ...new Set(
      snapshots
        .flatMap((value) => (Array.isArray(value) ? value : []))
        .filter((id) => valid.has(id)),
    ),
  ];
}
