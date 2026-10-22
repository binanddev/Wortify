import { compareAnswer } from "./answer-comparison.js";
export const TYPES = [
  ["choice", "Multiple choice"],
  ["written", "Type your answer"],
  ["dictation", "Listen and write"],
  ["truefalse", "Correct / Sai"],
  ["matching", "Matching"],
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
  if (isExample(card)) answerWith = card.exampleDirection === "back" ? "term" : "definition";
  cards = cards.filter(c=>isExample(c)===isExample(card));
  const selectedAnswerWith =
      answerWith === "random"
        ? random() < 0.5
          ? "term"
          : "definition"
        : answerWith,
    side = sides(card, selectedAnswerWith),
    q = { id: card.id, type, card, ...side };
  if (type === "dictation") return {...q, prompt:"", expected:card.german_text, alternatives:card.accepted_answers || []};
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
  return assessQuestion(q, value, options).correct;
}
export function assessQuestion(q, value, options = {}) {
  if (q.type === "dictation") {
    const term = compareAnswer(q.card.german_text, value?.term, options, q.card.accepted_answers || []);
    const definition = compareAnswer(q.card.vietnamese_meaning, value?.definition, options);
    return {correct:term.correct && definition.correct, term, definition};
  }
  if (q.type === "written") return compareAnswer(q.expected, value, options, q.alternatives || []);
  return null;
}

export function advanceProgress(previous, correct, type, turn, goal) {
  const p = { hits: 0, misses: 0, streak: 0, written: false, ...previous };
  p.hits += Number(correct);
  p.misses += Number(!correct);
  p.streak = correct ? p.streak + 1 : 0;
  p.written = p.written || (correct && ["written", "dictation"].includes(type));
  p.stage =
    p.streak >= 3 && (goal !== "comprehensive" || p.written)
      ? "mastered"
      : p.hits
        ? "familiar"
        : "new";
  p.due = turn + (correct ? Math.min(8, p.streak * 2 + 1) : 1);
  return p;
}
export function nextLearningCard(cards, progress, turn, lastId, options = {}) {
  if(options.includeExamples && options.exampleOrder !== 'mixed') {
    const example=cards.find(c=>isExample(c) && c.sourceCardId === lastId);
    if(example)return example;
    cards=cards.filter(c=>!isExample(c));
  }

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
  options,
) {
  if (!types.length) throw new Error("Choose at least one question type.");
  const queue = options ? studyCards(cards, options, random) : mix(cards, random);
  return queue
    .slice(0, Math.max(1, count))
    .map((c, i) =>
      makeQuestion(c, types[i % types.length], queue, answerWith, random),
    );
}

// Example items exist only in the study queue; sourceCardId always points to a real term.
export const sourceCardId = card => card.sourceCardId ?? card.id;
export const isExample = card => card.sourceCardId != null;
export function studyCards(cards, options = {}, random = Math.random) {
  const terms = options.shuffle ? mix(cards, random) : [...cards];
  if (!options.includeExamples) return terms;
  const result = terms.flatMap(card => {
    if (!card.example_german?.trim() || !card.example_vietnamese?.trim()) return [card];
    return [card, {...card, id:`example:${card.id}`, sourceCardId:card.id,
      german_text:card.example_german, vietnamese_meaning:card.example_vietnamese,
      example_german:'', example_vietnamese:'', accepted_answers:[],
      exampleDirection:options.exampleDirection || 'front'}];
  });
  return options.exampleOrder === 'mixed' ? mix(result, random) : result;
}
export function termProgress(progress) {
  return Object.fromEntries(Object.entries(progress).filter(([id])=>!id.startsWith('example:')));
}
