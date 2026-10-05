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

export function activeQuestions(mode, questions, index) {
  if (index >= questions.length) return [];
  return isWholeExercise(mode) ? questions : questions.slice(index, index + 1);
}

export function needsManualCheck(mode, style) {
  return (
    mode === "short_answer" &&
    ["sentence_rewrite", "partial_input"].includes(style)
  );
}

export function advanceQueue(queue, retry = false, wholeExercise = false) {
  if (!queue.length) return [];
  if (wholeExercise) return retry ? [...queue] : [];
  return retry ? [...queue.slice(1), queue[0]] : queue.slice(1);
}

export function isWholeExercise(mode) {
  return ["matching", "categorization"].includes(mode);
}

export function repeatLater(queue, random = Math.random) {
  if (queue.length < 2) return [...queue];
  const rest = queue.slice(1);
  const index =
    1 + Math.floor(Math.min(0.999999, Math.max(0, random())) * rest.length);
  return [...rest.slice(0, index), queue[0], ...rest.slice(index)];
}
