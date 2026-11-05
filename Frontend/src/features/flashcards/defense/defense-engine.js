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
  autoListen: true,
  volume: 0.55,
};
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
export const glyphs = (text) =>
  [...segmenter.segment(String(text).normalize("NFC"))].map((x) => x.segment);
// Some keyboards deliver the base letter before replacing it with its accented form.
export function composingPrefix(answer, typed) {
  const fold = (value) =>
    value
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/đ/gu, "d")
      .replace(/Đ/gu, "D");
  return (
    fold(answer).startsWith(fold(typed)) &&
    answer.slice(0, typed.length) !== typed
  );
}
export const answerLetters = (text) =>
  String(text).normalize("NFC").replace(/\s+/gu, "");
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
          partOfSpeech:
            typeof card.part_of_speech === "string"
              ? card.part_of_speech.trim()
              : "",
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
  let beaconReady = false;
  let engagedTarget = null;
  function spawn() {
    const available = cards.filter(
      (c) => !s.rocks.some((r) => r.card.id === c.id),
    );
    if (!available.length) return;
    const card = available[Math.floor(random() * available.length)];
    const boss = card.hard || (s.missed.get(card.id) || 0) >= 2;
    const roll = random(),
      kind =
        opts.mode === "classic" &&
        s.hp === 1 &&
        !s.rocks.some((r) => r.kind === "health")
          ? "health"
          : boss
            ? "boss"
            : roll < 0.12
              ? "freeze"
              : roll < 0.22
                ? "nuke"
                : roll < 0.32
                  ? "health"
                  : roll < 0.43
                    ? "pulse"
                    : roll < 0.51
                      ? "beacon"
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
      liftedLetters: 0,
      idleFallFactor: 0.6 + random() * 0.2,
      armor: boss ? 2 : 1,
      hints: beaconReady ? 1 : 0,
    };
    beaconReady = false;
    s.rocks.push(rock);
    event("spawn", rock);
  }
  function select(id) {
    if (s.paused || s.ended || !s.rocks.some((r) => r.id === id)) return;
    if (s.target === id) return;
    engagedTarget = null;
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
    if (rock.kind === "pulse") {
      for (const other of s.rocks) other.y = Math.max(0, other.y - 0.16);
      event("pulse", rock);
    }
    if (rock.kind === "beacon") {
      for (const other of s.rocks) other.hints = Math.max(other.hints, 1);
      beaconReady = true;
      event("beacon", rock);
    }
    if (rock.kind === "nuke") {
      // Measure proximity in lane and fall coordinates; only the closest two
      // within reach burst, regardless of their order in the spawn queue.
      const cap = difficulty.cap;
      const nearby = s.rocks
        .map((other) => ({
          other,
          distance: Math.hypot(
            (other.lane - rock.lane) / cap,
            other.y - rock.y,
          ),
        }))
        .filter((entry) => entry.distance <= 0.62)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 2);
      for (const { other } of nearby) {
        remove(other);
        event("blast", other);
      }
      event("nuke", rock);
    }
  }
  function input(value) {
    if (s.paused || s.ended) return "";
    const typed = answerLetters(value);
    let target = s.rocks.find((r) => r.id === s.target);
    if (!typed) {
      engagedTarget = null;
      if (target) target.typed = "";
      if (opts.targeting !== "guided") s.target = null;
      return "";
    }
    const prefix = (answer, text) =>
      equal(glyphs(answer).slice(0, glyphs(text).length).join(""), text);
    if (!target) {
      target = [...s.rocks]
        .sort((a, b) => b.y - a.y)
        .find((r) => prefix(answerLetters(r.card.answer), typed));
      if (target) {
        s.target = target.id;
        event("lock", target);
      }
    }
    if (!target && opts.targeting !== "guided") {
      target = s.rocks.find(
        (r) =>
          composingPrefix(
            answerLetters(r.card.answer).toLowerCase(),
            typed.toLowerCase(),
          ) && /[^\x00-\x7f]/u.test(answerLetters(r.card.answer)),
      );
      if (target) {
        s.target = target.id;
        event("lock", target);
      }
    }
    if (
      target &&
      !prefix(answerLetters(target.card.answer), typed) &&
      composingPrefix(
        opts.caseSensitive
          ? answerLetters(target.card.answer)
          : answerLetters(target.card.answer).toLocaleLowerCase(),
        opts.caseSensitive ? typed : typed.toLocaleLowerCase(),
      )
    ) {
      target.typed = typed;
      return typed;
    }
    if (!target || !prefix(answerLetters(target.card.answer), typed)) {
      s.errors++;
      s.combo = 0;
      if (target)
        s.missed.set(target.card.id, (s.missed.get(target.card.id) || 0) + 1);
      event("wrong", target);
      return target?.typed || "";
    }
    const letters = glyphs(typed);
    const previous = glyphs(target.typed);
    const unchanged = letters.findIndex(
      (letter, i) => !equal(letter, previous[i] || ""),
    );
    target.typed = typed;
    if (unchanged >= 0) {
      engagedTarget = target.id;
      for (let i = unchanged; i < letters.length; i++) {
        if (i >= target.liftedLetters) {
          target.y = Math.max(0, target.y - 0.025);
          target.liftedLetters = i + 1;
        }
        s.shots++;
        event("hit", target, { letter: letters[i], index: i });
      }
    }
    if (equal(answerLetters(target.card.answer), typed)) {
      target.armor--;
      if (target.armor > 0) {
        target.typed = "";
        target.liftedLetters = 0;
        event("armor", target);
        return "";
      }
      kill(target);
      guide();
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
        (move * speed * (rock.id === engagedTarget ? 1 : rock.idleFallFactor)) /
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
      if (ordered.length && (ordered.length > 1 || s.target !== ordered[0].id))
        select(
          ordered[
            (ordered.findIndex((r) => r.id === s.target) + 1) % ordered.length
          ].id,
        );
    },
    unlock() {
      engagedTarget = null;
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
export function letterSlots(rock) {
  const letters = glyphs(rock.card.answer),
    typed = glyphs(rock.typed);
  const hint =
    rock.hints >= 3
      ? Math.max(2, Math.ceil(letters.length * 0.35))
      : rock.hints >= 1
        ? 1
        : 0;
  let slot = 0;
  return letters.map((char) => {
    if (/\s/u.test(char)) return { text: "  ", state: "space" };
    const i = slot++;
    if (typed[i]?.toLocaleLowerCase() === char.toLocaleLowerCase())
      return { text: char, state: "typed" };
    if (i < hint) return { text: char, state: "hint" };
    return { text: "＿", state: "empty" };
  });
}
export function mask(rock) {
  return letterSlots(rock)
    .map((slot) => slot.text)
    .join(" ");
}
