import {
  DEFAULT_OPTIONS,
  answerLetters,
  glyphs,
  composingPrefix,
} from "./defense-engine.js";

export const birdX = 0.53;
export const gateWidth = 0.065;
export function createFallenBird(cards, options = {}, random = Math.random) {
  if (!cards.length) throw new Error("No playable cards.");
  const settings = { ...DEFAULT_OPTIONS, ...options };
  const fall = { easy: 0.034, normal: 0.045, hard: 0.058 }[settings.difficulty];
  const state = {
    options: settings,
    height: 0.68,
    velocity: 0,
    gate: { x: 1.14, bottom: 0.12, top: 0.9, brushed: false },
    featherUntil: 0,
    target: 0,
    rocks: [],
    shots: 0,
    flyingLetters: [],
    errors: 0,
    cleared: 0,
    combo: 0,
    bestCombo: 0,
    score: 0,
    time: 0,
    paused: false,
    ended: false,
  };
  let previous = -1,
    bestPrefix = 0,
    confirmedLength = 0;
  function next() {
    let index = Math.floor(random() * cards.length);
    if (index === previous && cards.length > 1)
      index = (index + 1) % cards.length;
    previous = index;
    bestPrefix = 0;
    confirmedLength = 0;
    state.rocks = [{ id: ++state.target, card: cards[index], typed: "" }];
  }
  next();
  const compare = (text) =>
    settings.caseSensitive ? text : text.toLocaleLowerCase();
  return {
    state,
    input(value) {
      const rock = state.rocks[0];
      if (state.paused || state.ended) return rock.typed;
      const typed = answerLetters(value);
      const answer = compare(answerLetters(rock.card.answer));
      if (!answer.startsWith(compare(typed))) {
        if (composingPrefix(answer, compare(typed))) {
          rock.typed = typed;
          return typed;
        }
        state.errors++;
        state.combo = 0;
        return rock.typed;
      }
      rock.typed = typed;
      const letters = glyphs(typed);
      const length = letters.length;
      for (let i = confirmedLength; i < length; i++) {
        state.flyingLetters.push({
          letter: letters[i],
          index: i,
          time: state.time,
          target: rock.id,
        });
      }
      confirmedLength = length;
      const gained = Math.max(0, length - bestPrefix);
      bestPrefix = Math.max(bestPrefix, length);
      if (gained) {
        state.velocity = 0.055;
        state.height = Math.min(1, state.height + 0.018 * gained);
      }
      state.shots += gained;
      if (compare(typed) !== answer) return typed;
      state.cleared++;
      state.score += 100;
      state.bestCombo = Math.max(state.bestCombo, ++state.combo);
      next();
      return "";
    },
    tick(seconds) {
      if (state.paused || state.ended) return;
      const dt = Math.min(0.1, Math.max(0, seconds));
      state.time += dt;
      while (
        state.flyingLetters.length &&
        state.time - state.flyingLetters[0].time > 0.22
      )
        state.flyingLetters.shift();
      state.velocity = Math.max(-fall, state.velocity - dt * 0.054);
      state.height = Math.max(
        0,
        Math.min(1, state.height + state.velocity * dt),
      );
      if (state.height === 1) state.velocity = Math.min(0, state.velocity);
      const gate = state.gate;
      gate.x -= dt * 0.055;
      if (
        !gate.brushed &&
        Math.abs(gate.x - birdX) <= gateWidth / 2 + 0.018 &&
        (state.height < gate.bottom + 0.02 || state.height > gate.top - 0.02)
      ) {
        gate.brushed = true;
        state.combo = 0;
        state.featherUntil = state.time + 1;
      }
      if (gate.x < -gateWidth) {
        const middle = 0.48 + random() * 0.12;
        const gap = { easy: 0.84, normal: 0.78, hard: 0.72 }[
          settings.difficulty
        ];
        state.gate = {
          x: 1.08,
          bottom: middle - gap / 2,
          top: Math.min(0.99, middle + gap / 2),
          brushed: false,
        };
      }
      state.ended = state.height === 0;
    },
    finish() {
      state.ended = true;
    },
    pause(value) {
      state.paused = value;
    },
  };
}
