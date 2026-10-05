import { normalize } from "./local-learning.js";
export const TYPES = [
  ["choice", "Trắc nghiệm"],
  ["written", "Gõ câu trả lời"],
  ["truefalse", "Đúng / Sai"],
  ["matching", "Ghép cặp"],
];
export function mix(items, random = Math.random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function sides(card, answerWith = "term", random = Math.random) {
  const selected =
    answerWith === "random"
      ? random() < 0.5
        ? "term"
        : "definition"
      : answerWith;
  return selected === "term"
    ? {
        prompt: card.vietnamese_meaning,
        expected: card.german_text,
        alternatives: card.accepted_answers || [],
      }
    : {
        prompt: card.german_text,
        expected: card.vietnamese_meaning,
        alternatives: [],
      };
}
export function makeQuestion(
  card,
  type,
  cards,
  answerWith = "term",
  random = Math.random,
) {
  const selectedAnswerWith =
      answerWith === "random"
        ? random() < 0.5
          ? "term"
          : "definition"
        : answerWith,
    side = sides(card, selectedAnswerWith),
    q = { id: card.id, type, card, ...side };
  if (type === "choice") {
    q.options = mix(
      [
        side.expected,
        ...mix(
          [
            ...new Set(
              cards
                .filter((c) => c.id !== card.id)
                .map((c) => sides(c, selectedAnswerWith).expected),
            ),
          ].filter((v) => v !== side.expected),
          random,
        ).slice(0, 3),
      ],
      random,
    );
    // Keep the selected format even when the deck has no distinct distractors.
  }
  if (type === "truefalse") {
    const others = cards.filter(
      (c) => sides(c, selectedAnswerWith).expected !== side.expected,
    );
    q.truth = random() > 0.5 || !others.length;
    q.proposed = q.truth
      ? side.expected
      : sides(others[Math.floor(random() * others.length)], selectedAnswerWith)
          .expected;
  }
  if (type === "matching") {
    const group = [
      card,
      ...mix(
        cards.filter((c) => c.id !== card.id),
        random,
      ).slice(0, 3),
    ];
    q.left = group.map((c) => ({
      id: String(c.id),
      text: sides(c, selectedAnswerWith).prompt,
    }));
    q.right = mix(
      group.map((c) => ({
        id: String(c.id),
        text: sides(c, selectedAnswerWith).expected,
      })),
      random,
    );
  }
  return q;
}
export function checkQuestion(q, value, options = {}) {
  if (q.type === "truefalse") return value === q.truth;
  if (q.type === "matching")
    return q.left.every(
      (l) =>
        q.right.find((r) => r.id === value?.[l.id])?.text ===
        q.right.find((r) => r.id === l.id)?.text,
    );
  if (q.type === "choice") return value === q.expected;
  return [q.expected, ...q.alternatives].some(
    (v) => normalize(v, options, true) === normalize(value, options, true),
  );
}
export function advanceProgress(previous, correct, type, turn, goal) {
  const p = { hits: 0, misses: 0, streak: 0, written: false, ...previous };
  p.hits += Number(correct);
  p.misses += Number(!correct);
  p.streak = correct ? p.streak + 1 : 0;
  p.written = p.written || (correct && type === "written");
  p.stage =
    p.streak >= 3 && (goal !== "comprehensive" || p.written)
      ? "mastered"
      : p.hits
        ? "familiar"
        : "new";
  p.due = turn + (correct ? Math.min(8, p.streak * 2 + 1) : 1);
  return p;
}
export function nextLearningCard(cards, progress, turn, lastId) {
  return [...cards].sort((a, b) => {
    const priority = (c) => {
      const p = progress[c.id] || {};
      return (
        (p.stage === "mastered" ? 1000 : 0) +
        Math.max(0, (p.due || 0) - turn) * 10 +
        (c.id === lastId ? 5 : 0) -
        (p.misses || 0)
      );
    };
    return priority(a) - priority(b);
  })[0];
}
export function createTest(
  cards,
  count,
  types,
  answerWith,
  random = Math.random,
) {
  if (!types.length) throw new Error("Chọn ít nhất một dạng câu hỏi.");
  return mix(cards, random)
    .slice(0, Math.min(cards.length, Math.max(1, count)))
    .map((c, i) =>
      makeQuestion(c, types[i % types.length], cards, answerWith, random),
    );
}
