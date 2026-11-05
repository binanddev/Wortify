import {
  DEFAULT_OPTIONS,
  answerLetters,
  glyphs,
  composingPrefix,
} from "./defense-engine.js";

export function createBalloon(cards, options = {}, random = Math.random) {
  if (!cards.length) throw new Error("No playable cards.");
  const settings = { ...DEFAULT_OPTIONS, ...options };
  const fall = { easy: 0.028, normal: 0.045, hard: 0.065 }[settings.difficulty];
  const state = {
    options: settings,
    height: 0.75,
    target: 0,
    rocks: [],
    shots: 0,
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
    bestPrefix = 0;
  function next() {
    let index = Math.floor(random() * cards.length);
    if (index === previous && cards.length > 1)
      index = (index + 1) % cards.length;
    previous = index;
    bestPrefix = 0;
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
      const length = glyphs(typed).length;
      const gained = Math.max(0, length - bestPrefix);
      bestPrefix = Math.max(bestPrefix, length);
      state.height = Math.min(1, state.height + gained * 0.045);
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
      state.height = Math.max(0, state.height - dt * fall);
      state.ended = state.height === 0;
    },
    pause(value) {
      state.paused = value;
    },
  };
}
