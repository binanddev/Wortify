import test from "node:test";
import assert from "node:assert/strict";
import { createFallenBird } from "../src/features/flashcards/defense/bird-engine.js";
test("accent composition, lift, backspace, pause and ground contact", () => {
  const game = createFallenBird([{ answer: "mèo" }]);
  const s = game.state;
  game.input("m");
  const height = s.height;
  game.input("");
  game.input("m");
  assert.equal(s.height, height);
  assert.equal(game.input("me"), "me");
  assert.equal(s.height, height);
  game.input("me\u0300");
  assert.ok(s.height > height);
  game.input("mèo");
  assert.equal(s.cleared, 1);
  game.pause(true);
  const before = s.height;
  game.tick(0.1);
  assert.equal(s.height, before);
  game.pause(false);
  for (let i = 0; i < 500; i++) game.tick(0.1);
  assert.equal(s.ended, true);
  assert.equal(s.height, 0);
});

test("wide gates forgive collisions and keep the current word", () => {
  const g = createFallenBird([{ answer: "prepare" }]);
  g.input("p");
  const s = g.state;
  s.height = 0.92;
  s.gate.x = 0.53;
  s.combo = 3;
  g.tick(0.01);
  assert.equal(s.gate.brushed, true);
  assert.equal(s.ended, false);
  assert.equal(s.combo, 0);
  assert.equal(s.rocks[0].typed, "p");
  assert.ok(s.velocity > 0);
});

test("hard mode uses narrow lethal gates and manual flaps respect pause", () => {
  const game = createFallenBird([{ answer: "prepare" }], {
    difficulty: "hard",
  });
  const s = game.state;
  assert.ok(s.gate.top - s.gate.bottom < 0.4);
  game.pause(true);
  game.flap();
  assert.equal(s.velocity, 0);
  game.pause(false);
  game.flap();
  assert.ok(s.velocity > 0);
  s.height = 0.94;
  s.gate.x = 0.53;
  game.tick(0.01);
  assert.equal(s.ended, true);
});
