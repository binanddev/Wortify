import test from "node:test";
import assert from "node:assert/strict";
import { defenseAudio } from "../src/features/flashcards/defense/defense-audio.js";

test("typing, mute, speech ducking and cleanup share one bounded audio graph", () => {
  const sources = [],
    gains = [],
    utterances = [];
  const param = () => ({
    value: 1,
    setValueAtTime(v) {
      this.value = v;
    },
    exponentialRampToValueAtTime(v) {
      this.value = v;
    },
    setTargetAtTime(v) {
      this.value = v;
    },
    cancelScheduledValues() {},
  });
  const node = () => ({
    connect() {},
    disconnect() {
      this.disconnected = true;
    },
    gain: param(),
    frequency: param(),
    pan: param(),
  });
  let context;
  class AudioContext {
    constructor() {
      context = this;
      this.currentTime = 0;
      this.sampleRate = 100;
      this.state = "running";
      this.destination = node();
    }
    resume() {
      return Promise.resolve();
    }
    close() {
      this.closed = true;
      return Promise.resolve();
    }
    createGain() {
      const n = node();
      gains.push(n);
      return n;
    }
    createDynamicsCompressor() {
      return {
        ...node(),
        threshold: param(),
        knee: param(),
        ratio: param(),
        attack: param(),
        release: param(),
      };
    }
    createBuffer() {
      return { getChannelData: () => new Float32Array(100) };
    }
    createBiquadFilter() {
      return node();
    }
    createStereoPanner() {
      return node();
    }
    createOscillator() {
      const n = {
        ...node(),
        start() {
          this.started = true;
        },
        stop(time) {
          if (time === undefined) {
            this.stopped = true;
            this.onended?.();
          }
        },
      };
      sources.push(n);
      return n;
    }
    createBufferSource() {
      return this.createOscillator();
    }
  }
  const previousWindow = globalThis.window,
    previousUtterance = globalThis.SpeechSynthesisUtterance;
  globalThis.window = {
    AudioContext,
    speechSynthesis: {
      cancel() {},
      speak(u) {
        utterances.push(u);
      },
    },
  };
  globalThis.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
    }
  };
  try {
    const audio = defenseAudio();
    audio.unlock();
    audio.typing();
    assert.equal(sources.length, 2, "first key sounds immediately");
    audio.typing();
    assert.equal(
      sources.length,
      2,
      "rapid duplicate composition events are throttled",
    );
    context.currentTime = 0.1;
    audio.typing(true);
    assert.equal(sources.length, 4);
    assert.equal(sources.at(-1).frequency.value, 200);
    audio.tone("wrong");
    assert.equal(sources.length, 5);
    audio.setVolume(0.35);
    assert.equal(gains[0].gain.value, 0.35);
    audio.speak({ answer: "Bahnhof", language: "de-DE" }, true);
    assert.equal(gains[1].gain.value, 0.22);
    assert.equal(utterances[0].volume, 0.35);
    audio.speak({ answer: "Sonne", language: "de-DE" }, true);
    utterances[0].onend();
    assert.equal(
      gains[1].gain.value,
      0.22,
      "stale speech completion must not unduck the next word",
    );
    utterances[1].onend();
    assert.equal(gains[1].gain.value, 1);
    const realNow = Date.now;
    try {
      let now = realNow() + 10000;
      Date.now = () => now;
      const card = { answer: "Wasser", language: "de-DE" };
      audio.repeat([card]);
      const before = utterances.length;
      utterances.at(-1).onend();
      now += 1999;
      audio.repeat([card]);
      assert.equal(
        utterances.length,
        before,
        "wait two seconds after speech ends",
      );
      now += 1;
      audio.repeat([card]);
      assert.equal(
        utterances.length,
        before + 1,
        "repeat without clicking the card",
      );
    } finally {
      Date.now = realNow;
    }
    audio.mute(true);
    const count = sources.length;
    context.currentTime = 1;
    audio.typing();
    audio.tone("destroy");
    assert.equal(sources.length, count);
    assert.equal(gains[0].gain.value, 0);
    assert.ok(sources.every((n) => n.stopped && n.disconnected));
    audio.mute(false);
    audio.tone("health");
    assert.ok(sources.length > count);
    audio.dispose();
    assert.equal(context.closed, true);
  } finally {
    globalThis.window = previousWindow;
    globalThis.SpeechSynthesisUtterance = previousUtterance;
  }
});
