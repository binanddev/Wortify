import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@heroui/react";
import {
  request,
  endpoint,
  readPreference,
  savePreference,
} from "../../../lib/core.js";
import { t as tr, useLocale } from "../../../i18n/index.js";
import {
  createDefense,
  prepareCards,
  DEFAULT_OPTIONS,
} from "./defense-engine.js";
import { defenseAudio } from "./defense-audio.js";
import css from "./defense.css?inline";

const labelMap = {
  classic: "Classic",
  time: "Time Attack",
  zen: "Zen",
  easy: "Easy",
  normal: "Normal",
  hard: "Hard",
  term: "Definition → term",
  meaning: "Term → definition",
  audio: "Listen → type",
};
const snapshot = (s) => ({
  score: s.score,
  hp: s.hp,
  combo: s.combo,
  bestCombo: s.bestCombo,
  cleared: s.cleared,
  errors: s.errors,
  time: s.time,
  frozen: s.frozen,
  paused: s.paused,
  ended: s.ended,
  shots: s.shots,
  target: s.target,
  rock: s.rocks.find((r) => r.id === s.target),
});
export default function FlashcardDefense(props) {
  const host = useRef(null),
    [root, setRoot] = useState(null);
  useEffect(() => {
    const shadow =
      host.current.shadowRoot || host.current.attachShadow({ mode: "open" });
    setRoot(shadow);
  }, []);
  return createPortal(
    <div
      ref={host}
      role="dialog"
      aria-modal="true"
      aria-label="Flashcard Defense"
    >
      {root &&
        createPortal(
          <>
            <style>{css}</style>
            <Defense {...props} />
          </>,
          root,
        )}
    </div>,
    document.body,
  );
}
function Defense({ lang, userId, initialDeck, onClose }) {
  useLocale();
  const settingsKey = `wortify:defense:${userId}:${lang}`;
  const [options, setOptions] = useState(() => {
    const saved = readPreference(settingsKey, {}),
      value = { ...DEFAULT_OPTIONS, ...saved };
    for (const [key, allowed] of Object.entries({
      mode: ["classic", "time", "zen"],
      difficulty: ["easy", "normal", "hard"],
      direction: ["term", "meaning", "audio"],
    }))
      if (!allowed.includes(value[key])) value[key] = DEFAULT_OPTIONS[key];
    value.volume = Number.isFinite(Number(value.volume))
      ? Math.max(0, Math.min(1, Number(value.volume)))
      : DEFAULT_OPTIONS.volume;
    return value;
  });
  const [decks, setDecks] = useState([initialDeck.deck]),
    [selected, setSelected] = useState([initialDeck.deck.id]),
    [search, setSearch] = useState("");
  const [phase, setPhase] = useState("setup"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [hud, setHud] = useState(null),
    [draft, setDraft] = useState(""),
    [ready, setReady] = useState(false);
  const arena = useRef(null),
    input = useRef(null),
    root = useRef(null),
    engine = useRef(null),
    audio = useRef(null),
    composition = useRef(false),
    controller = useRef(null),
    mounted = useRef(true);
  const focus = () => input.current?.focus({ preventScroll: true });
  useEffect(() => {
    mounted.current = true;
    audio.current = defenseAudio();
    const previous = document.activeElement,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      mounted.current = false;
      controller.current?.abort();
      audio.current?.dispose();
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);
  useEffect(() => {
    const c = new AbortController();
    request(endpoint(lang, "decks/"), "GET", undefined, c.signal)
      .then((data) => setDecks(data.decks))
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => c.abort();
  }, [lang]);
  useEffect(() => savePreference(settingsKey, options), [options, settingsKey]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => {
      if (root.current) {
        const height = viewport?.height || window.innerHeight;
        root.current.style.setProperty("--fd-height", `${height}px`);
        root.current.dataset.compact = String(height < 500);
      }
    };
    resize();
    viewport?.addEventListener("resize", resize);
    window.addEventListener("resize", resize);
    return () => {
      viewport?.removeEventListener("resize", resize);
      window.removeEventListener("resize", resize);
    };
  }, []);

  useEffect(() => {
    const hidden = (event) => {
      if (
        (document.hidden || event.type === "blur") &&
        engine.current &&
        !engine.current.state.ended
      ) {
        engine.current.pause(true);
        audio.current.stop();
        setHud(snapshot(engine.current.state));
      }
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("blur", hidden);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("blur", hidden);
    };
  }, []);
  useEffect(() => {
    if (phase !== "play") return;
    let cancelled = false,
      dispose;
    import("./defense-scene.js")
      .then(({ launchDefense }) => {
        if (cancelled) return;
        dispose = launchDefense(arena.current, engine.current, {
          audio: audio.current,
          labels: {
            freeze: tr("Freeze"),
            nuke: tr("Nuke"),
            health: tr("Health"),
            boss: tr("Boss"),
            listen: tr("Tap to listen"),
          },
          reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
          onFocus: focus,
          onReady: () => {
            setReady(true);
            focus();
          },
          onFrame: (s) => {
            setHud(snapshot(s));
            if (!s.target && !composition.current) setDraft("");
          },
          onEnd: (s) => {
            setHud(snapshot(s));
            setPhase("result");
          },
        });
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setPhase("setup");
        }
      });
    return () => {
      cancelled = true;
      dispose?.();
      audio.current.stop();
    };
  }, [phase]);
  useEffect(() => {
    if (phase !== "play" || !ready || hud?.paused) return;
    focus();
    const type = (event) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.key === "Escape" ||
        event.key === "Tab"
      )
        return;
      if (
        event.key.length === 1 ||
        ["Backspace", "Delete", "Dead", "Process"].includes(event.key)
      ) {
        // Focus before the browser inserts text; native input keeps IME support.
        focus();
      }
    };
    window.addEventListener("keydown", type, true);
    return () => window.removeEventListener("keydown", type, true);
  }, [phase, ready, hud?.paused]);
  function pause() {
    const game = engine.current;
    if (!game || game.state.ended) return;
    game.pause(!game.state.paused);
    setHud(snapshot(game.state));
    audio.current.stop();
    if (!game.state.paused) {
      audio.current.unlock();
      focus();
    }
  }
  async function start() {
    if (busy || !selected.length) return;
    setBusy(true);
    setError("");
    if (options.direction === "audio" && !window.speechSynthesis) {
      setError(tr("Speech is not available in this browser."));
      setBusy(false);
      return;
    }
    const c = new AbortController();
    controller.current?.abort();
    controller.current = c;
    try {
      audio.current.unlock();
      audio.current.setVolume(options.volume);
      audio.current.mute(!options.sound);
      const collected = new Array(selected.length);
      let next = 0;
      await Promise.all(
        Array.from({ length: Math.min(3, selected.length) }, async () => {
          while (next < selected.length) {
            const index = next++,
              id = selected[index];
            collected[index] =
              id === initialDeck.deck.id
                ? initialDeck
                : await request(
                    endpoint(lang, `decks/${id}/`),
                    "GET",
                    undefined,
                    c.signal,
                  );
          }
        }),
      );
      if (c.signal.aborted) return;
      const cards = prepareCards(collected, options);
      if (!cards.length) throw new Error(tr("No playable cards."));
      engine.current = createDefense(cards, options);
      setHud(snapshot(engine.current.state));
      setReady(false);
      setDraft("");
      setPhase("play");
    } catch (e) {
      if (e.name !== "AbortError" && mounted.current) setError(e.message);
      c.abort();
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  function submit(value) {
    if (!engine.current) return;
    audio.current.typing(value.length < draft.length);
    setDraft(engine.current.input(value));
    setHud(snapshot(engine.current.state));
  }
  function exit() {
    if (phase === "play") {
      engine.current.pause(true);
      setHud(snapshot(engine.current.state));
      setPhase("confirm");
      audio.current.stop();
    } else onClose();
  }
  function keyboard(event) {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      if (phase === "play") pause();
      else if (phase === "confirm") {
        engine.current.pause(false);
        setPhase("play");
      } else onClose();
    }
    if (event.key === "Tab") {
      const buttons = [
        ...root.current.querySelectorAll(
          "button:not([disabled]),input:not([disabled]),select:not([disabled])",
        ),
      ].filter((el) => el.getClientRects().length);
      const active = root.current.getRootNode().activeElement,
        first = buttons[0],
        last = buttons.at(-1);
      if (event.shiftKey && (active === first || !buttons.includes(active))) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (active === last || !buttons.includes(active))
      ) {
        event.preventDefault();
        first?.focus();
      }
    }
  }
  const button = (text, fn, primary = false, props = {}) => (
    <GameButton
      className={`fd-button ${primary ? "fd-primary" : ""}`}
      action={fn}
      {...props}
    >
      {tr(text)}
    </GameButton>
  );
  const visible = decks.filter((d) =>
    d.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  return (
    <div className="fd-shell" ref={root} onKeyDown={keyboard}>
      <header className="fd-header">
        <div className="fd-brand">
          <span className="fd-emblem">✦</span>
          <div>
            <b>
              FLASHCARD <span>DEFENSE</span>
            </b>
            <small>WORTIFY · {tr("Vocabulary defense")}</small>
          </div>
        </div>
        <div className="fd-top-actions">
          {phase === "play" && button(hud?.paused ? "Resume" : "Pause", pause)}
          {button("Close", exit)}
        </div>
      </header>
      {phase === "setup" && (
        <main className="fd-setup">
          <section className="fd-hero">
            <div className="fd-orbit" />
            <span className="fd-kicker">{tr("Your words. Your defense.")}</span>
            <h1>
              {tr("Turn knowledge")}
              <br />
              <em>{tr("into firepower.")}</em>
            </h1>
            <p>{tr("Type to lock. Finish to destroy.")}</p>
            <div className="fd-illustration" aria-hidden="true">
              <div className="fd-preview-rock fd-preview-one">
                <small>FREEZE</small>
                <b>{tr("Train station")}</b>
                <span>B A ＿ ＿ ＿ ＿ ＿</span>
              </div>
              <div className="fd-preview-rock fd-preview-two">
                <small>BOSS · ◇ ◇</small>
                <b>{tr("Adventure")}</b>
                <span>＿ ＿ ＿ ＿ ＿ ＿ ＿ ＿ ＿</span>
              </div>
              <div className="fd-beam" />
              <div className="fd-turret">✦</div>
            </div>
            <div className="fd-power-legend">
              <span>
                ❄ {tr("Freeze")} <small>5s</small>
              </span>
              <span>✹ {tr("Nuke")}</span>
              <span>
                ✚ {tr("Health")} <small>+1</small>
              </span>
            </div>
          </section>
          <section className="fd-config">
            <div className="fd-section-title">
              <span>01</span>
              <h2>{tr("Choose your decks")}</h2>
              <small>{selected.length}</small>
            </div>
            <input
              className="fd-field"
              aria-label={tr("Search decks")}
              placeholder={tr("Search decks")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="fd-decks">
              {visible.map((deck) => (
                <label key={deck.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(deck.id)}
                    disabled={busy}
                    onChange={(e) =>
                      setSelected((old) =>
                        e.target.checked
                          ? [...old, deck.id]
                          : old.filter((id) => id !== deck.id),
                      )
                    }
                  />
                  <span>{deck.title}</span>
                  <small>{deck.count ?? initialDeck.cards.length}</small>
                </label>
              ))}
            </div>
            <div className="fd-section-title">
              <span>02</span>
              <h2>{tr("Mission settings")}</h2>
            </div>
            <div className="fd-options">
              {[
                ["mode", "Game mode", ["classic", "time", "zen"]],
                ["difficulty", "Difficulty", ["easy", "normal", "hard"]],
                ["direction", "Direction", ["term", "meaning", "audio"]],
              ].map(([key, label, values]) => (
                <label key={key}>
                  {tr(label)}
                  <select
                    value={options[key]}
                    disabled={busy}
                    onChange={(e) =>
                      setOptions((o) => ({
                        ...o,
                        [key]: e.target.value,
                        ...(key === "direction" && e.target.value === "audio"
                          ? { sound: true }
                          : {}),
                      }))
                    }
                  >
                    {values.map((v) => (
                      <option key={v} value={v}>
                        {tr(labelMap[v])}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="fd-switches">
              <label>
                <input
                  type="checkbox"
                  checked={options.caseSensitive}
                  disabled={busy}
                  onChange={(e) =>
                    setOptions((o) => ({
                      ...o,
                      caseSensitive: e.target.checked,
                    }))
                  }
                />
                {tr("Case sensitive")}
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={options.sound}
                  disabled={busy || options.direction === "audio"}
                  onChange={(e) =>
                    setOptions((o) => ({ ...o, sound: e.target.checked }))
                  }
                />
                {tr("Sound")}
              </label>
            </div>
            <label className="fd-volume">
              {tr("Volume")}
              <input
                aria-label={tr("Volume")}
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={options.volume}
                disabled={busy}
                onChange={(e) => {
                  setOptions((o) => ({ ...o, volume: Number(e.target.value) }));
                  audio.current.unlock();
                  audio.current.setVolume(e.target.value);
                  audio.current.mute(!options.sound);
                  audio.current.typing();
                }}
              />
              <span>{Math.round(options.volume * 100)}%</span>
            </label>
            <p className="fd-mode-note">
              {tr(
                options.mode === "classic"
                  ? "3 HP · Increasing speed"
                  : options.mode === "time"
                    ? "60 seconds · Maximum score"
                    : "No HP · Steady pace",
              )}
            </p>
            {error && (
              <p className="fd-error" role="alert">
                {error}
              </p>
            )}
            {button("Launch defense", start, true, {
              isDisabled: !selected.length || busy,
              isLoading: busy,
            })}
          </section>
        </main>
      )}
      {phase === "play" && (
        <main className="fd-play">
          <div className="fd-hud">
            <div>
              <small>{tr("Score")}</small>
              <b>{hud?.score.toLocaleString()}</b>
            </div>
            <div>
              <small>{tr("Base shield")}</small>
              <b className="fd-health">
                {options.mode === "classic"
                  ? "♥".repeat(hud?.hp || 0) + "♡".repeat(3 - (hud?.hp || 0))
                  : "∞"}
              </b>
            </div>
            <div>
              <small>{tr("Combo")}</small>
              <b>×{hud?.combo || 0}</b>
            </div>
            <div>
              <small>
                {tr(options.mode === "time" ? "Remaining" : "Time")}
              </small>
              <b>
                {Math.max(
                  0,
                  Math.ceil(
                    options.mode === "time"
                      ? 60 - (hud?.time || 0)
                      : hud?.time || 0,
                  ),
                )}
                s
              </b>
            </div>
          </div>
          <div className="fd-stage-wrap">
            <div
              className="fd-stage"
              ref={arena}
              aria-label={tr("Defense arena")}
            />
            {(!ready || hud?.paused) && (
              <div className="fd-cover">
                <h2>{tr(ready ? "Paused" : "Loading…")}</h2>
                {ready && button("Resume", pause, true)}
              </div>
            )}
            {hud?.frozen > 0 && (
              <div className="fd-freeze" role="status">
                ❄ {tr("Freeze")} · {Math.ceil(hud.frozen)}s
              </div>
            )}
          </div>
          <div className="fd-console">
            <div className="fd-target" aria-live="polite">
              <span className={hud?.target ? "fd-locked" : ""}>
                ● {tr(hud?.target ? "Target locked" : "Awaiting target")}
              </span>
              <span>
                {hud?.rock?.kind === "boss"
                  ? `${tr("Armor")} ${hud.rock.armor}/2`
                  : tr("Type the first letter")}
              </span>
            </div>
            {hud?.rock && options.direction !== "audio" && (
              <p className="fd-target-copy">{hud.rock.card.prompt}</p>
            )}
            <div className="fd-input-row">
              {button("Keyboard", focus, false, {
                className: "fd-button fd-touch-keyboard",
              })}
              <input
                ref={input}
                className="fd-keyboard-capture"
                aria-label={tr("Type your answer")}
                placeholder={tr("Type your answer")}
                value={draft}
                disabled={!ready || hud?.paused}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                onCompositionStart={() => {
                  composition.current = true;
                }}
                onCompositionEnd={(e) => {
                  composition.current = false;
                  submit(e.currentTarget.value);
                }}
                onChange={(e) => {
                  if (composition.current) {
                    audio.current.typing(e.target.value.length < draft.length);
                    setDraft(e.target.value);
                  } else submit(e.target.value);
                }}
              />
              {button("Release target", () => {
                engine.current.unlock();
                setDraft("");
                focus();
              })}
              {button("Listen", () => {
                const s = engine.current.state,
                  r =
                    s.rocks.find((r) => r.id === s.target) ||
                    [...s.rocks].sort((a, b) => b.y - a.y)[0];
                if (r) audio.current.speak(r.card, true);
                focus();
              })}
            </div>
            <div className="fd-bottom-note">
              <span>{tr("Tap a meteor to hear it. Esc to pause.")}</span>
              <span>
                {tr(labelMap[options.mode])} ·{" "}
                {tr(labelMap[options.difficulty])}
              </span>
            </div>
          </div>
        </main>
      )}
      {phase === "confirm" && (
        <div className="fd-result">
          <span className="fd-kicker">{tr("Mission paused")}</span>
          <h1>{tr("Leave this game?")}</h1>
          <div>
            {button(
              "Continue",
              () => {
                engine.current.pause(false);
                setPhase("play");
              },
              true,
            )}
            {button("Finish", () => {
              engine.current.finish();
              setHud(snapshot(engine.current.state));
              setPhase("result");
            })}
          </div>
        </div>
      )}
      {phase === "result" && (
        <div className="fd-result">
          <span className="fd-kicker">{tr("Mission complete")}</span>
          <h1>
            {hud?.score.toLocaleString()} <small>{tr("points")}</small>
          </h1>
          <div className="fd-result-stats">
            <div>
              <b>{hud?.cleared}</b>
              <span>{tr("Words cleared")}</span>
            </div>
            <div>
              <b>×{hud?.bestCombo}</b>
              <span>{tr("Best combo")}</span>
            </div>
            <div>
              <b>
                {Math.round(
                  (100 * (hud?.shots || 0)) /
                    Math.max(1, (hud?.shots || 0) + (hud?.errors || 0)),
                )}
                %
              </b>
              <span>{tr("Typing accuracy")}</span>
            </div>
          </div>
          <div className="fd-result-actions">
            {button("Play again", start, true, {
              isLoading: busy,
              isDisabled: busy,
            })}
            {button("Settings", () => setPhase("setup"))}
            {button("Back to deck", onClose)}
          </div>
          {error && (
            <p className="fd-error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// React Aria retargets touch events at the ShadowRoot host. Bind the native
// activation on the actual button while retaining HeroUI styling and semantics.
function GameButton({ action, children, ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    const element = ref.current;
    const click = (event) => {
      if (!props.isDisabled && !props.isLoading) action(event);
    };
    element?.addEventListener("click", click);
    return () => element?.removeEventListener("click", click);
  }, [action, props.isDisabled, props.isLoading]);
  return (
    <Button ref={ref} {...props}>
      {children}
    </Button>
  );
}
