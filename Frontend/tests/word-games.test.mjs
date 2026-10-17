import test from "node:test";
import assert from "node:assert/strict";
import {
  eligibleCards,
  sentenceTiles,
  checkGameAnswer,
  memoryTiles,
  demoGameCards,
  WORD_GAMES,
} from "../src/features/flashcards/word-games.js";
test("missing data and ambiguous memory pairs are excluded", () => {
  const cards = [
    {
      id: 1,
      german_text: "on time",
      vietnamese_meaning: "đúng giờ",
      example_german: "We arrived on time.",
    },
    { id: 2, german_text: "punctually", vietnamese_meaning: "đúng giờ" },
    { id: 3, german_text: "in time", vietnamese_meaning: "đúng giờ" },
    { id: 4, german_text: "keep in touch", vietnamese_meaning: "giữ liên lạc" },
  ];
  assert.deepEqual(
    eligibleCards(cards, "memory").map((c) => c.id),
    [1, 4],
  );

  assert.deepEqual(
    eligibleCards(cards, "sentence").map((c) => c.id),
    [1],
  );
  assert.deepEqual(eligibleCards([], "memory"), []);
});
test("sentence tiles keep repeated tokens distinct and do not modify source cards", () => {
  const c = { example_german: "We know that that works." };
  const tiles = sentenceTiles(c, () => 0);
  assert.equal(tiles.length, 5);
  assert.equal(new Set(tiles.map((t) => t.id)).size, 5);
  const answer = [...tiles]
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((t) => t.text)
    .join(" ");
  assert.equal(answer, c.example_german);
  assert.equal(checkGameAnswer(c, "sentence", answer), true);
  assert.equal(
    checkGameAnswer(c, "sentence", "that We works. know that"),
    false,
  );
});
test("English and German demo collections support all games and form complete memory pairs", () => {
  for (const lang of ["en", "de"]) {
    const cards = demoGameCards(lang);
    for (const [mode] of WORD_GAMES)
      assert.equal(eligibleCards(cards, mode).length, 6);
    for (const card of cards) {
      assert.equal(
        checkGameAnswer(card, "sentence", card.example_german),
        true,
      );
    }
    const tiles = memoryTiles(cards, () => 0);
    assert.equal(new Set(tiles.map((t) => t.id)).size, 12);
    for (let i = 0; i < 6; i++)
      assert.deepEqual(
        tiles
          .filter((t) => t.pair === i)
          .map((t) => t.side)
          .sort(),
        ["Meaning", "Phrase"],
      );
  }
});

test("pair boards cover the deck once with 12 or 20 tiles and a shorter final board", async () => {
  const {pairBoards} = await import("../src/features/flashcards/word-games.js");
  const cards = Array.from({length:23}, (_,id)=>({id}));
  for (const [size, lengths] of [[12,[6,6,6,5]],[20,[10,10,3]]]) {
    const boards = pairBoards(cards,size);
    assert.deepEqual(boards.map(b=>b.length),lengths);
    assert.deepEqual(boards.flat(),cards);
    assert.equal(new Set(boards.flat().map(c=>c.id)).size,23);
    for (const board of boards) assert.equal(memoryTiles(board).length,board.length*2);
  }
  assert.deepEqual(pairBoards([],12),[]);
});
