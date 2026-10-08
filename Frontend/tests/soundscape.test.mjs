import test from "node:test";
import assert from "node:assert/strict";
import { playAmbientNote } from "../src/features/audio/soundscape-engine.js";
import {
  AMBIENT_TRACKS,
  ambientTrack,
  ambientStep,
} from "../src/features/audio/soundscape-presets.js";

test("ten distinct built-in melodies loop with safe finite tones and a fallback", () => {
  assert.equal(AMBIENT_TRACKS.length, 10);
  assert.equal(new Set(AMBIENT_TRACKS.map((t) => t.id)).size, 10);
  assert.equal(
    new Set(AMBIENT_TRACKS.map((t) => JSON.stringify(t.notes))).size,
    10,
  );
  assert.equal(ambientTrack("removed-track"), AMBIENT_TRACKS[0]);
  for (const track of AMBIENT_TRACKS) {
    assert.deepEqual(
      ambientStep(track, 0),
      ambientStep(track, track.notes.length),
    );
    for (let i = 0; i < track.notes.length; i++) {
      const note = ambientStep(track, i);
      assert.ok(note.frequency >= 200 && note.frequency <= 1500);
      assert.ok(note.duration > 0 && note.duration <= 2);
      assert.ok(note.interval >= 0.5 && note.interval <= 1);
      assert.ok(["sine", "triangle"].includes(note.type));
    }
  }
});

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
