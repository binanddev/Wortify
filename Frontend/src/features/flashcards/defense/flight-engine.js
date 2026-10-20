import { DEFAULT_OPTIONS, clean, glyphs } from "./defense-engine.js";
export function createFlight(cards, options = {}, random = Math.random) {
  if (!cards.length) throw new Error("No playable cards.");
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const settings = {
    easy: { speed: 0.1, gap: 0.48, gravity: 0.65 },
    normal: { speed: 0.13, gap: 0.4, gravity: 0.8 },
    hard: { speed: 0.16, gap: 0.34, gravity: 0.95 },
  }[opts.difficulty] || { speed: 0.13, gap: 0.4, gravity: 0.8 };
  const s = {
    options: opts,
    rocks: [],
    target: null,
    quiz: false,
    round: 0,
    time: 0,
    score: 0,
    hp: 3,
    combo: 0,
    bestCombo: 0,
    cleared: 0,
    errors: 0,
    shots: 0,
    frozen: 0,
    paused: false,
    ended: false,
    events: [],
    bird: { y: 0.5, velocity: 0 },
    gate: null,
    shield: 2,
    storm: false,
  };
  let previous = -1,
    flapAt = -1;
  const emit = (type) => s.events.push({ type });
  function next() {
    let index = Math.floor(random() * cards.length);
    if (cards.length > 1 && index === previous)
      index = (index + 1) % cards.length;
    previous = index;
    s.round++;
    s.storm = s.round % 5 === 0;
    const center = 0.32 + random() * 0.36;
    s.gate = {
      id: s.round,
      x: 1.08,
      center,
      gap: Math.max(0.3, settings.gap - (s.storm ? 0.04 : 0)),
      answered: false,
      asked: false,
      hit: false,
      card: cards[index],
      drone: s.round % 3 === 0,
    };
  }
  next();
  function hurt() {
    if (s.shield > 0) return;
    s.combo = 0;
    s.shield = 1.5;
    emit("impact");
    if (opts.mode === "classic" && --s.hp <= 0) {
      s.hp = 0;
      s.ended = true;
      emit("end");
    }
  }
  function flap() {
    if (s.paused || s.ended || s.quiz || s.time - flapAt < 0.09) return;
    flapAt = s.time;
    s.bird.velocity = -0.36;
    emit("hit");
  }
  function input(value) {
    if (!s.quiz || s.paused || s.ended) return "";
    const rock = s.rocks[0],
      typed = String(value).normalize("NFC");
    const equal = (a, b) =>
      opts.caseSensitive
        ? a === b
        : a.toLocaleLowerCase() === b.toLocaleLowerCase();
    if (
      !equal(
        glyphs(rock.card.answer).slice(0, glyphs(typed).length).join(""),
        typed,
      )
    ) {
      s.errors++;
      s.combo = 0;
      emit("wrong");
      return rock.typed;
    }
    s.shots += Math.max(0, glyphs(typed).length - glyphs(rock.typed).length);
    rock.typed = typed;
    if (equal(clean(typed), rock.card.answer)) {
      s.cleared++;
      s.combo++;
      s.bestCombo = Math.max(s.bestCombo, s.combo);
      s.score += 100 + Math.min(100, s.combo * 10);
      s.quiz = false;
      s.target = null;
      s.rocks = [];
      s.gate.answered = true;
      s.shield = 2;
      s.bird.velocity = 0;
      emit("health");
      return "";
    }
    return typed;
  }
  function tick(seconds) {
    if (s.paused || s.ended) return;
    const dt = Math.max(0, Math.min(0.05, seconds));
    s.time += dt;
    if (opts.mode === "time" && s.time >= 60) {
      s.time = 60;
      s.ended = true;
      emit("end");
      return;
    }
    if (s.quiz) return;
    const gate = s.gate;
    gate.x -=
      dt *
      settings.speed *
      (opts.mode === "zen" ? 1 : Math.min(1.8, 1 + (s.round - 1) * 0.025));
    if (!gate.asked && gate.x <= 0.7) {
      gate.asked = true;
      s.quiz = true;
      s.target = gate.id;
      s.rocks = [
        {
          id: gate.id,
          card: gate.card,
          typed: "",
          hints: 0,
          kind: "normal",
          armor: 1,
        },
      ];
      emit("lock");
      return;
    }
    s.shield = Math.max(0, s.shield - dt);
    s.bird.velocity +=
      dt * (settings.gravity + (s.storm ? 0.12 * Math.sin(s.time * 3) : 0));
    s.bird.y += dt * s.bird.velocity;
    if (s.bird.y < 0.04 || s.bird.y > 0.96) {
      hurt();
      s.bird.y = Math.max(0.08, Math.min(0.92, s.bird.y));
      s.bird.velocity = 0;
    }
    const center = gate.center + (s.storm ? Math.sin(s.time * 1.7) * 0.045 : 0);
    if (
      Math.abs(gate.x - 0.25) < 0.06 &&
      (s.bird.y - 0.025 < center - gate.gap / 2 ||
        s.bird.y + 0.025 > center + gate.gap / 2) &&
      !gate.hit
    ) {
      gate.hit = true;
      hurt();
    }
    const droneX = gate.x + 0.22,
      droneY = 0.5 + Math.sin(s.time * 2) * 0.28;
    if (
      gate.drone &&
      Math.abs(droneX - 0.25) < 0.045 &&
      Math.abs(droneY - s.bird.y) < 0.065
    )
      hurt();
    if (gate.x < -0.3 && !s.ended) next();
  }
  return {
    state: s,
    tick,
    input,
    flap,
    pause(value) {
      s.paused = value;
    },
    finish() {
      s.ended = true;
      emit("end");
    },
    drain() {
      return s.events.splice(0);
    },
  };
}
