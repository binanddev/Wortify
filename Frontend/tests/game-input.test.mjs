import test from "node:test";
import assert from "node:assert/strict";
import { bindGameInput } from "../src/features/flashcards/defense/game-input.js";
import { createDefense } from "../src/features/flashcards/defense/defense-engine.js";
test("native input displays accepted typing, rejects wrong letters, and cleans up", () => {
  const el = new EventTarget();
  el.value = "";
  let composing = false;
  const game = createDefense([{ id: 1, answer: "Katze" }]);
  game.tick(0.1);
  for (let i = 0; i < 8; i++) game.tick(0.1);
  const dispose = bindGameInput(el, {
    active: () => !game.state.paused,
    composing: (v) => {
      composing = v;
    },
    accept: (value) => game.input(value),
  });
  const enter = (value) => {
    el.value = value;
    el.dispatchEvent(new Event("input"));
  };
  enter("K");
  assert.equal(game.state.rocks[0].typed, "K");
  enter("Kz");
  assert.equal(el.value, "K");
  enter("Ka");
  assert.equal(game.state.rocks[0].typed, "Ka");
  game.pause(true);
  enter("Katze");
  assert.equal(game.state.cleared, 0);
  dispose();
  enter("Katze");
  assert.equal(game.state.cleared, 0);
  assert.equal(composing, false);
});
test("IME commits once, including browser trailing input after compositionend", () => {
  const el = new EventTarget();
  el.value = "";
  let calls = 0;
  const dispose = bindGameInput(el, {
    active: () => true,
    composing() {},
    accept: (value) => {
      calls++;
      assert.equal(value, "mèo");
      return "";
    },
  });
  el.dispatchEvent(new Event("compositionstart"));
  el.value = "me";
  el.dispatchEvent(new Event("input"));
  assert.equal(calls, 0);
  el.value = "mèo";
  el.dispatchEvent(new Event("compositionend"));
  el.dispatchEvent(new Event("input"));
  assert.equal(calls, 1);
  assert.equal(el.value, "");
  dispose();
});
