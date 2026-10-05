import test from "node:test";
import assert from "node:assert/strict";
import { playAmbientNote } from "../src/soundscape-engine.js";

test("ambient notes fade to silence, stop and release audio nodes", () => {
  const events = [],
    active = new Set();
  const oscillator = {
    frequency: {},
    connect() {},
    disconnect() {
      events.push("osc disconnected");
    },
    start(t) {
      events.push(["start", t]);
    },
    stop(t) {
      events.push(["stop", t]);
    },
  };
  const envelope = {
    gain: Object.fromEntries(
      [
        "setValueAtTime",
        "linearRampToValueAtTime",
        "exponentialRampToValueAtTime",
      ].map((name) => [name, (...args) => events.push([name, ...args])]),
    ),
    connect() {},
    disconnect() {
      events.push("gain disconnected");
    },
  };
  playAmbientNote(
    {
      currentTime: 10,
      createOscillator: () => oscillator,
      createGain: () => envelope,
    },
    {},
    659.25,
    active,
  );
  assert.equal(active.size, 1);
  assert.equal(oscillator.frequency.value, 659.25);
  assert.ok(
    events.some(
      (e) => e[0] === "linearRampToValueAtTime" && e[1] === 0 && e[2] === 12,
    ),
  );
  assert.ok(events.some((e) => e[0] === "stop" && e[1] === 12.05));
  oscillator.onended();
  assert.equal(active.size, 0);
  assert.ok(events.includes("osc disconnected"));
  assert.ok(events.includes("gain disconnected"));
});
