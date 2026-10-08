import { gradeExercise } from "./local-learning.js";
export { SKIPPED_ANSWER } from "./local-learning.js";
export function exerciseSolution(exercise, question) {
  return [
    ...new Set(
      gradeExercise(exercise, [question], {}).answers.map(
        (row) =>
          `${row.label ? `${row.label}: ` : ""}${[...new Set(row.expected)].join(" / ")}`,
      ),
    ),
  ];
}
export function cardSolution(q) {
  if (q.type === "matching")
    return q.left.map(
      (item) =>
        `${item.text} — ${q.right.find((r) => r.id === item.id)?.text || ""}`,
    );
  if (q.type === "truefalse")
    return [`${q.truth ? "Correct" : "False"} — ${q.expected}`];
  return [q.expected];
}
