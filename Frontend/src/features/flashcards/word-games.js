import samples from "./word-game-samples.json" with { type: "json" };
import { mix } from "./flashcard-engine.js";
import { normalize } from "../learning/local-learning.js";
export const WORD_GAMES = [
  [
    "sentence",
    "Sentence Quest",
    "Collect word islands to build a bridge before the clock runs out.",
  ],
  [
    "memory",
    "Phrase pairs",
    "Match visible phrases and meanings. Complete the board to unlock the next round.",
  ],
];
const clean = (text) =>
  String(text || "")
    .normalize("NFC")
    .trim();
export function eligibleCards(cards, mode) {
  const seen = new Set(),
    meanings = new Set();
  return cards.filter((card) => {
    const term = clean(card.german_text),
      meaning = clean(card.vietnamese_meaning),
      sentence = clean(card.example_german);
    if (!term || !meaning) return false;
    const words = sentence.split(/\s+/);
    const valid =
      mode === "sentence"
          ? words.length >= 3 && words.length <= 40
          : mode === "memory"
            ? term.split(/\s+/).length >= 2
            : false;
    const key = normalize(mode === "memory" ? term : sentence),
      m = normalize(meaning);
    if (!valid || seen.has(key) || (mode === "memory" && meanings.has(m)))
      return false;
    seen.add(key);
    meanings.add(m);
    return true;
  });
}
export function sentenceTiles(card, random = Math.random) {
  return mix(
    clean(card.example_german)
      .split(/\s+/)
      .map((text, i) => ({ id: String(i), text })),
    random,
  );
}
export function checkGameAnswer(card, mode, answer, grading = {}) {
  const expected =
    card.example_german;
  return (
    Boolean(expected) &&
    normalize(answer, grading, true) === normalize(expected, grading, true)
  );
}
export function memoryTiles(cards, random = Math.random) {
  return mix(
    cards.flatMap((card, i) => [
      {
        id: i + ":term",
        pair: i,
        text: card.german_text,
        side: "Phrase",
        card,
      },
      {
        id: i + ":meaning",
        pair: i,
        text: card.vietnamese_meaning,
        side: "Meaning",
        card,
      },
    ]),
    random,
  );
}
export function demoGameCards(lang) {
  return samples[lang === "de" ? "de" : "en"].map((card) => ({ ...card }));
}

export function pairBoards(cards, tileCount = 12) {
  const size = tileCount === 20 ? 10 : 6;
  const boards = [];
  for (let i = 0; i < cards.length; i += size)
    boards.push(cards.slice(i, i + size));
  return boards;
}
