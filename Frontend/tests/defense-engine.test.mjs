import test from "node:test";
import assert from "node:assert/strict";
import {
  createDefense,
  prepareCards,
  mask,
  glyphs,
} from "../src/features/flashcards/defense/defense-engine.js";
const card = (id, answer = "Katze", extra = {}) => ({
  id,
  answer,
  term: answer,
  meaning: "mèo",
  prompt: "mèo",
  language: "de-DE",
  ...extra,
});
const step = (game, seconds) => {
  for (let i = 0; i < Math.ceil(seconds * 10); i++) game.tick(0.1);
};
const game = (options = {}, cards = [card("1")], random = () => 0.5) =>
  createDefense(cards, options, random);
test("multi-deck preparation filters incomplete cards, deduplicates answers and reads difficult SRS cards", () => {
  const decks = [
    {
      deck: { id: 1, language: "de" },
      cards: [
        { id: 2, german_text: "Katze", vietnamese_meaning: "mèo" },
        { id: 3, german_text: "", vietnamese_meaning: "x" },
      ],
      learning: { progress: { 2: { misses: 2 } } },
    },
    {
      deck: { id: 2, language: "en" },
      cards: [
        { id: 4, german_text: "Katze", vietnamese_meaning: "mèo" },
        { id: 5, german_text: "Dog", vietnamese_meaning: "chó" },
      ],
      difficult_cards: [5],
    },
  ];
  const original = structuredClone(decks);
  const cards = prepareCards(decks, { direction: "term" });
  assert.equal(cards.length, 2);
  assert.ok(cards.every((c) => c.hard));
  assert.equal(cards[1].language, "en-US");
  assert.equal(prepareCards(decks, { direction: "meaning" })[0].answer, "mèo");
  assert.deepEqual(decks, original);
  assert.throws(() => createDefense([]));
});
test("first character locks the nearest matching target; wrong characters never advance it", () => {
  const g = game({ difficulty: "hard" }, [
    card("1", "Katze"),
    card("2", "Karte"),
  ]);
  step(g, 4);
  assert.equal(g.state.rocks.length, 2);
  const nearest = [...g.state.rocks].sort((a, b) => b.y - a.y)[0];
  assert.equal(g.input("K"), "K");
  assert.equal(g.state.target, nearest.id);
  assert.equal(g.input("Kz"), "K");
  assert.equal(g.state.errors, 1);
  assert.equal(nearest.typed, "K");
  g.input(nearest.card.answer);
  assert.equal(g.state.cleared, 1);
  assert.equal(g.state.target, null);
});
test("case sensitivity and Unicode input respect composed Vietnamese and German", () => {
  const strict = game({ caseSensitive: true });
  step(strict, 1);
  strict.input("k");
  assert.equal(strict.state.target, null);
  strict.input("Katze");
  assert.equal(strict.state.cleared, 1);
  const flexible = game();
  step(flexible, 1);
  flexible.input("katze");
  assert.equal(flexible.state.cleared, 1);
  const vi = game({}, [card("1", "mèo")]);
  step(vi, 1);
  vi.input("me\u0300o");
  assert.equal(vi.state.cleared, 1);
  assert.equal(glyphs("me\u0300o").length, 3);
});
test("boss armor requires two complete answers and awards only one defeat", () => {
  const g = game({}, [card("1", "Haus", { hard: true })]);
  step(g, 1);
  assert.equal(g.state.rocks[0].kind, "boss");
  assert.equal(g.input("Haus"), "");
  assert.equal(g.state.rocks[0].armor, 1);
  assert.equal(g.state.cleared, 0);
  g.input("Haus");
  assert.equal(g.state.cleared, 1);
  assert.ok(g.state.score >= 250);
});
test("freeze lasts five seconds, nuke clears collateral without points, health caps at three", () => {
  const freeze = game({}, [card("1")], () => 0.05);
  step(freeze, 1);
  freeze.input("Katze");
  assert.equal(freeze.state.frozen, 5);
  step(freeze, 4);
  assert.ok(freeze.state.frozen > 0.9);
  assert.equal(freeze.state.rocks.length, 0);
  step(freeze, 2);
  assert.equal(freeze.state.frozen, 0);
  const nuke = game(
    { difficulty: "hard" },
    [card("1", "a"), card("2", "b")],
    () => 0.16,
  );
  step(nuke, 4);
  assert.equal(nuke.state.rocks.length, 2);
  nuke.input(nuke.state.rocks[0].card.answer);
  assert.equal(nuke.state.rocks.length, 0);
  assert.equal(nuke.state.cleared, 1);
  const health = game({}, [card("1")], () => 0.26);
  step(health, 1);
  health.state.hp = 2;
  health.input("Katze");
  assert.equal(health.state.hp, 3);
});
test("dynamic hints reveal characters without typing for the player", () => {
  const g = game();
  step(g, 1);
  const rock = g.state.rocks[0];
  rock.y = 0.34;
  g.tick(0.01);
  assert.ok(mask(rock).startsWith("K"));
  assert.equal(rock.typed, "");
  rock.y = 0.67;
  g.tick(0.01);
  assert.ok(g.drain().some((e) => e.type === "hint" && e.level === 2));
  rock.y = 0.9;
  g.tick(0.01);
  assert.ok(mask(rock).startsWith("K a"));
});
test("classic ends after three impacts; zen has no damage; time attack ends at 60 seconds", () => {
  const classic = game();
  step(classic, 110);
  assert.equal(classic.state.hp, 0);
  assert.equal(classic.state.ended, true);
  const zen = game({ mode: "zen" });
  step(zen, 110);
  assert.equal(zen.state.hp, 3);
  assert.equal(zen.state.ended, false);
  const time = game({ mode: "time" });
  step(time, 61);
  assert.equal(time.state.ended, true);
  assert.equal(time.state.time, 60);
});
test("pause and finish prevent movement, scoring and timer progress", () => {
  const g = game();
  step(g, 1);
  g.pause(true);
  const before = g.state.time;
  step(g, 20);
  g.input("Katze");
  assert.equal(g.state.time, before);
  assert.equal(g.state.score, 0);
  g.pause(false);
  g.finish();
  step(g, 5);
  assert.equal(g.input("Katze"), "");
  assert.equal(g.state.score, 0);
});
test("repeated mistakes promote words to bosses only inside the current game", () => {
  const g = game();
  step(g, 1);
  g.input("K");
  g.input("Kz");
  g.input("Kz");
  g.input("Katze");
  step(g, 4);
  assert.equal(g.state.rocks[0].kind, "boss");
  assert.equal(game().state.missed.size, 0);
});
