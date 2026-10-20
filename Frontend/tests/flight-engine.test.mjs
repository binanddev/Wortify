import test from "node:test";
import assert from "node:assert/strict";
import { createFlight } from "../src/features/flashcards/defense/flight-engine.js";
const cards = [
  { id: 1, answer: "Katze", prompt: "cat" },
  { id: 2, answer: "Hund", prompt: "dog" },
];
const step = (g, n) => {
  for (let i = 0; i < n; i++) g.tick(0.05);
};
test("flight freezes at vocabulary gates, wrong typing does not open them, correct typing grants shield", () => {
  const g = createFlight(cards, { mode: "zen" }, () => 0.5);
  step(g, 70);
  assert.equal(g.state.quiz, true);
  const y = g.state.bird.y,
    x = g.state.gate.x;
  step(g, 30);
  g.flap();
  assert.equal(g.state.bird.y, y);
  assert.equal(g.state.gate.x, x);
  const answer = g.state.rocks[0].card.answer;
  g.input("!");
  assert.equal(g.state.quiz, true);
  g.input(answer);
  assert.equal(g.state.quiz, false);
  assert.equal(g.state.cleared, 1);
  assert.equal(g.state.shield, 2);
  assert.equal(g.state.gate.answered, true);
});
test("flap changes velocity, pausing stops physics and typing, classic collision costs health", () => {
  const g = createFlight(cards, {}, () => 0.5);
  g.flap();
  assert.ok(g.state.bird.velocity < 0);
  g.pause(true);
  const state = JSON.stringify(g.state);
  step(g, 20);
  g.flap();
  g.input("Hund");
  assert.equal(JSON.stringify(g.state), state);
  g.pause(false);
  g.state.shield = 0;
  g.state.bird.y = 0.99;
  g.state.bird.velocity = 0.5;
  g.tick(0.05);
  assert.equal(g.state.hp, 2);
  g.finish();
  const t = g.state.time;
  step(g, 10);
  assert.equal(g.state.time, t);
});
test("flight provides drone and storm rounds without repeating the same card consecutively", () => {
  const g = createFlight(cards, { mode: "zen" }, () => 0.5);
  let previous;
  for (let i = 1; i <= 5; i++) {
    assert.equal(g.state.round, i);
    assert.notEqual(g.state.gate.card.id, previous);
    previous = g.state.gate.card.id;
    if (i === 3) assert.equal(g.state.gate.drone, true);
    if (i === 5) assert.equal(g.state.storm, true);
    g.state.gate.asked = true;
    g.state.gate.x = -0.31;
    g.tick(0.01);
  }
});
test("time attack ends even when waiting for an answer", () => {
  const g = createFlight(cards, { mode: "time" });
  step(g, 1210);
  assert.equal(g.state.time, 60);
  assert.equal(g.state.ended, true);
});
