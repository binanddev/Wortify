export const DIFFICULTIES = {
  easy: { cap: 1, fall: 32, spawn: 2.4 },
  normal: { cap: 2, fall: 26, spawn: 3.5 },
  hard: { cap: 4, fall: 22, spawn: 2.7 },
};
export const DEFAULT_OPTIONS = {
  game: "defense",
  targeting: "guided",
  mode: "classic",
  difficulty: "normal",
  direction: "term",
  caseSensitive: false,
  sound: true,
  volume: 0.55,
};
export const glyphs = (text) =>
  [
    ...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
      String(text).normalize("NFC"),
    ),
  ].map((x) => x.segment);
export const clean = (text) =>
  String(text || "")
    .normalize("NFC")
    .replace(/\s+/gu, " ")
    .trim();
export function prepareCards(decks, options) {
  const seen = new Set();
  return decks
    .flatMap((deck) =>
      deck.cards.map((card) => {
        const term = clean(card.german_text),
          meaning = clean(card.vietnamese_meaning);
        const answer = options.direction === "meaning" ? meaning : term;
        const progress = deck.learning?.progress?.[card.id] || {};
        return {
          id: `${deck.deck.id}:${card.id}`,
          term,
          meaning,
          answer,
          prompt: options.direction === "meaning" ? term : meaning,
          hard:
            (progress.misses || 0) >= 2 ||
            progress.state === "weak" ||
            (deck.difficult_cards || []).includes(card.id),
          language:
            options.direction === "meaning"
              ? "vi-VN"
              : deck.deck.language === "en"
                ? "en-US"
                : "de-DE",
        };
      }),
    )
    .filter((c) => {
      const key = options.caseSensitive
        ? c.answer
        : c.answer.toLocaleLowerCase();
      if (!c.term || !c.meaning || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
export function createDefense(cards, options = {}, random = Math.random) {
  if (!cards.length) throw new Error("No playable cards.");
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const difficulty = DIFFICULTIES[opts.difficulty] || DIFFICULTIES.normal;
  const s = {
    options: opts,
    rocks: [],
    time: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    hp: 3,
    cleared: 0,
    errors: 0,
    shots: 0,
    paused: false,
    ended: false,
    frozen: 0,
    target: null,
    events: [],
    missed: new Map(),
    serial: 0,
    spawnIn: 0.6,
  };
  const equal = (a, b) =>
    opts.caseSensitive
      ? a === b
      : a.toLocaleLowerCase() === b.toLocaleLowerCase();
  const event = (type, rock, extra = {}) =>
    s.events.push({ type, rock: rock ? { ...rock } : null, ...extra });
  function spawn() {
    const available = cards.filter(
      (c) => !s.rocks.some((r) => r.card.id === c.id),
    );
    if (!available.length) return;
    const card = available[Math.floor(random() * available.length)];
    const boss = card.hard || (s.missed.get(card.id) || 0) >= 2;
    const roll = random(),
      kind = boss
        ? "boss"
        : roll < 0.12
          ? "freeze"
          : roll < 0.22
            ? "nuke"
            : roll < 0.32
              ? "health"
              : "normal";
    const used = new Set(s.rocks.map((r) => r.lane));
    const lanes = Array.from({ length: difficulty.cap }, (_, i) => i).filter(
      (i) => !used.has(i),
    );
    const rock = {
      id: ++s.serial,
      card,
      kind,
      lane: lanes[Math.floor(random() * lanes.length)],
      y: 0,
      typed: "",
      armor: boss ? 2 : 1,
      hints: 0,
    };
    s.rocks.push(rock);
    event("spawn", rock);
  }
  function select(id) {
    if (s.paused || s.ended || !s.rocks.some((r) => r.id === id)) return;
    for (const rock of s.rocks) rock.typed = "";
    s.target = id;
    event(
      "lock",
      s.rocks.find((r) => r.id === id),
    );
  }
  function guide() {
    if (opts.targeting === "guided" && !s.target && s.rocks.length)
      select([...s.rocks].sort((a, b) => b.y - a.y)[0].id);
  }
  function remove(rock) {
    s.rocks = s.rocks.filter((r) => r.id !== rock.id);
    if (s.target === rock.id) s.target = null;
  }
  function kill(rock) {
    remove(rock);
    s.cleared++;
    s.combo++;
    s.bestCombo = Math.max(s.bestCombo, s.combo);
    s.score +=
      (rock.kind === "boss" ? 250 : 100) + Math.min(100, (s.combo - 1) * 10);
    event("destroy", rock);
    if (rock.kind === "freeze") {
      s.frozen = 5;
      event("freeze", rock);
    }
    if (rock.kind === "health") {
      s.hp = Math.min(3, s.hp + 1);
      event("health", rock);
    }
    if (rock.kind === "nuke") {
      // Collateral clears the field but earns no vocabulary points/mastery.
      for (const other of [...s.rocks]) {
        remove(other);
        event("blast", other);
      }
      event("nuke", rock);
    }
  }
  function input(value) {
    if (s.paused || s.ended) return "";
    const typed = String(value).normalize("NFC");
    let target = s.rocks.find((r) => r.id === s.target);
    if (!typed) {
      if (target) target.typed = "";
      if (opts.targeting !== "guided") s.target = null;
      return "";
    }
    const prefix = (answer, text) =>
      equal(glyphs(answer).slice(0, glyphs(text).length).join(""), text);
    if (!target) {
      target = [...s.rocks]
        .sort((a, b) => b.y - a.y)
        .find((r) => prefix(r.card.answer, typed));
      if (target) {
        s.target = target.id;
        event("lock", target);
      }
    }
    if (!target || !prefix(target.card.answer, typed)) {
      s.errors++;
      s.combo = 0;
      if (target)
        s.missed.set(target.card.id, (s.missed.get(target.card.id) || 0) + 1);
      event("wrong", target);
      return target?.typed || "";
    }
    const added = Math.max(
      0,
      glyphs(typed).length - glyphs(target.typed).length,
    );
    target.typed = typed;
    s.shots += added;
    if (added) event("hit", target);
    if (equal(target.card.answer, typed)) {
      target.armor--;
      if (target.armor > 0) {
        target.typed = "";
        event("armor", target);
        return "";
      }
      kill(target);
      return "";
    }
    return typed;
  }
  function tick(seconds) {
    if (s.paused || s.ended) return;
    const dt = Math.max(0, Math.min(0.1, seconds));
    s.time += dt;
    if (opts.mode === "time" && s.time >= 60) {
      s.time = 60;
      s.ended = true;
      event("end");
      return;
    }
    const freezePart = Math.min(s.frozen, dt);
    s.frozen = Math.max(0, s.frozen - dt);
    const move = dt - freezePart;
    const speed = opts.mode === "classic" ? Math.min(2.8, 1 + s.time / 110) : 1;
    for (const rock of [...s.rocks]) {
      // Longer answers and bosses get more time, without slowing short words.
      const lengthFactor =
        1 + Math.max(0, glyphs(rock.card.answer).length - 9) * 0.055;
      rock.y +=
        (move * speed) /
        (difficulty.fall * lengthFactor * (rock.kind === "boss" ? 1.45 : 1));
      const hint =
        rock.y >= 0.88 ? 3 : rock.y >= 0.66 ? 2 : rock.y >= 0.33 ? 1 : 0;
      if (hint > rock.hints) {
        rock.hints = hint;
        event("hint", rock, { level: hint });
      }
      if (rock.y >= 1) {
        remove(rock);
        s.combo = 0;
        s.missed.set(rock.card.id, (s.missed.get(rock.card.id) || 0) + 1);
        event("impact", rock);
        if (opts.mode === "classic" && --s.hp <= 0) {
          s.hp = 0;
          s.ended = true;
          event("end");
          break;
        }
      }
    }
    s.spawnIn -= move;
    if (!s.ended && s.spawnIn <= 0 && s.rocks.length < difficulty.cap) {
      spawn();
      s.spawnIn = difficulty.spawn;
    }
    if (!s.ended) guide();
  }
  return {
    state: s,
    tick,
    input,
    select,
    nextTarget() {
      const ordered = [...s.rocks].sort((a, b) => a.lane - b.lane);
      if (ordered.length)
        select(
          ordered[
            (ordered.findIndex((r) => r.id === s.target) + 1) % ordered.length
          ].id,
        );
    },
    unlock() {
      s.target = null;
      for (const r of s.rocks) r.typed = "";
    },
    pause(value) {
      s.paused = value;
    },
    finish() {
      s.ended = true;
      event("end");
    },
    drain() {
      return s.events.splice(0);
    },
  };
}
export function mask(rock) {
  const letters = glyphs(rock.card.answer),
    typed = glyphs(rock.typed).length;
  const hint =
    rock.hints >= 3
      ? Math.max(2, Math.ceil(letters.length * 0.35))
      : rock.hints >= 1
        ? 1
        : 0;
  return letters
    .map((char, i) =>
      /\s/u.test(char) ? "  " : i < Math.max(typed, hint) ? char : "＿",
    )
    .join(" ");
}
