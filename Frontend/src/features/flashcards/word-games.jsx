import ArcadeGames from "./arcade-games.jsx";
import { useEffect, useState } from "react";
import {
  Btn,
  Heading,
  Link,
  Page,
  useSound,
} from "../../components/ui/ui.jsx";
import { useWindowActive } from "../../lib/core.js";
import { mix } from "./flashcard-engine.js";
import {
  WORD_GAMES,
  eligibleCards,
  sentenceTiles,
  checkGameAnswer,
  memoryTiles,
  demoGameCards,
  pairBoards,
} from "./word-games.js";

export function WordGames({
  pack,
  lang,
  deck,
  sound,
  embedded = false,
  selectedMode = null,
}) {
  const Container = embedded ? "section" : Page;
  const [demo, setDemo] = useState(false),
    [round, setRound] = useState(() => {
      if (!selectedMode) return null;
      const cards = eligibleCards(pack.cards, selectedMode);
      return cards.length >= (selectedMode === "memory" ? 2 : 1)
        ? {
            mode: selectedMode,
            cards:
              selectedMode === "memory" ? mix(cards) : mix(cards).slice(0, 10),
          }
        : null;
    }),
    [run, setRun] = useState(0);
  const cards = !deck && demo ? demoGameCards(lang) : pack.cards;
  return (
    <Container className="flashcard-workspace">
      {!embedded && (
        <Link
          to={
            deck
              ? "/" + lang + "/flashcard/deck/" + deck
              : "/" + lang + "/flashcard"
          }
        >
          ← Back to flashcards
        </Link>
      )}
      <Heading
        title={
          selectedMode
            ? WORD_GAMES.find((g) => g[0] === selectedMode)?.[1]
            : "Word playground"
        }
        description={
          deck
            ? "Learn with the words, phrases and examples in this deck."
            : "Learn words together, in sentences you can use."
        }
      />
      {round ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>
              {deck
                ? "This deck only"
                : demo
                  ? "Sample collection"
                  : "Your flashcards"}{" "}
              · {WORD_GAMES.find((g) => g[0] === round.mode)[1]}
            </p>
            <Btn onClick={() => setRound(null)}>
              {selectedMode ? "Round setup" : "Choose another game"}
            </Btn>
          </div>
          {round.mode === "memory" ? (
            <MemoryRound
              key={run}
              cards={round.cards}
              onDone={() => setRound(null)}
              sound={sound}
              lang={lang}
            />
          ) : (
            <ArcadeGames
              key={run}
              cards={round.cards}
              mode={round.mode}
              grading={pack.grading}
              onDone={() => setRound(null)}
              sound={sound}
              lang={lang}
            />
          )}
        </>
      ) : (
        <>
          {!deck && (
            <div className="flex flex-wrap items-center gap-3">
              <Btn aria-pressed={!demo} onClick={() => setDemo(false)}>
                My cards
              </Btn>
              <Btn aria-pressed={demo} onClick={() => setDemo(true)}>
                Try sample collection
              </Btn>
            </div>
          )}
          <p className="my-3">
            {!deck && demo
              ? "Six original examples to try. Nothing is added to your deck."
              : deck
                ? "Only cards from this deck are used. Add example sentences or multi-word phrases to this deck to unlock more rounds."
                : "Games use the cards in your selected scope. Add example sentences and multi-word phrases to unlock more rounds."}
          </p>
          {deck && (
            <Link
              className="btn"
              to={"/" + lang + "/flashcard/deck/" + deck + "/edit"}
            >
              Edit this deck · Add examples and phrases
            </Link>
          )}
          <div className="grid gap-4 md:grid-cols-3">
            {WORD_GAMES.filter(
              ([mode]) => !selectedMode || mode === selectedMode,
            ).map(([mode, title, description]) => {
              const eligible = eligibleCards(cards, mode),
                minimum = mode === "memory" ? 2 : 1;
              return (
                <section
                  key={mode}
                  className="flex flex-col gap-3 rounded-2xl border border-(--line) bg-(--surface) p-5"
                >
                  <h2 className="text-xl font-semibold">{title}</h2>
                  <p>{description}</p>
                  <p>
                    {eligible.length} eligible cards · Up to{" "}
                    {mode === "memory" ? "6 or 10 pairs" : "10 cards"} per round
                  </p>
                  <p className="text-sm">
                    {mode === "sentence"
                        ? "Needs an example sentence of 3–40 words."
                        : "Needs at least two distinct phrases and meanings. Use terms with two or more words."}
                  </p>
                  <Btn
                    primary
                    isDisabled={eligible.length < minimum}
                    onClick={() => {
                      setRound({
                        mode,
                        cards:
                          mode === "memory"
                            ? mix(eligible)
                            : mix(eligible).slice(0, 10),
                      });
                      setRun((n) => n + 1);
                    }}
                  >
                    Play {title}
                  </Btn>
                </section>
              );
            })}
          </div>
          <p className="my-4 text-sm">
            These are practice rounds. Your spaced-review schedule stays
            unchanged.
          </p>
        </>
      )}
    </Container>
  );
}
function MemoryRound({ cards, onDone, sound, lang }) {
  const [tileCount, setTileCount] = useState(12),
    [boardIndex, setBoardIndex] = useState(0);
  const boards = pairBoards(cards, tileCount);
  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>Match a phrase with its meaning. All tiles stay visible.</p>
        <label>
          Board size{" "}
          <select
            value={tileCount}
            onChange={(e) => {
              setTileCount(Number(e.target.value));
              setBoardIndex(0);
            }}
          >
            <option value={12}>12 tiles · relaxed</option>
            <option value={20}>20 tiles · compact</option>
          </select>
        </label>
      </div>
      <p className="text-sm">
        Changing board size starts a new run. The last board may have fewer
        tiles.
      </p>
      <PairBoard
        key={tileCount + ":" + boardIndex}
        cards={boards[boardIndex]}
        compact={tileCount === 20}
        roundNumber={boardIndex + 1}
        totalRounds={boards.length}
        sound={sound}
        lang={lang}
        onNext={
          boardIndex + 1 < boards.length
            ? () => setBoardIndex((i) => i + 1)
            : null
        }
        onDone={onDone}
      />
    </section>
  );
}
function PairBoard({
  cards,
  compact,
  roundNumber,
  totalRounds,
  sound,
  lang,
  onNext,
  onDone,
}) {
  const [tiles] = useState(() => memoryTiles(cards)),
    [selected, setSelected] = useState(null);
  const [matched, setMatched] = useState([]),
    [wrong, setWrong] = useState([]),
    [turns, setTurns] = useState(0),
    [last, setLast] = useState(null);
  const active = useWindowActive(),
    audio = useSound(sound, lang);
  const finished = matched.length === cards.length;
  useEffect(() => {
    if (!wrong.length || !active) return;
    const timer = setTimeout(() => setWrong([]), 700);
    return () => clearTimeout(timer);
  }, [wrong, active]);
  useEffect(() => {
    if (!finished || !onNext || !active) return;
    const timer = setTimeout(onNext, 1800);
    return () => clearTimeout(timer);
  }, [finished, onNext, active]);
  function choose(tile) {
    if (wrong.length || matched.includes(tile.pair) || !active) return;
    if (selected === tile.id) {
      setSelected(null);
      return;
    }
    if (selected === null) {
      setSelected(tile.id);
      return;
    }
    const first = tiles.find((t) => t.id === selected);
    if (first.side === tile.side) {
      setSelected(tile.id);
      return;
    }
    setTurns((n) => n + 1);
    setSelected(null);
    if (first.pair === tile.pair) {
      setMatched((m) => [...m, tile.pair]);
      setLast(tile.card);
      audio.feedback(true);
    } else {
      setWrong([first.id, tile.id]);
      audio.feedback(false);
    }
  }
  return (
    <section className="grid gap-4 rounded-2xl border border-(--line) bg-(--surface) p-4">
      <p role="status">
        Round {roundNumber} / {totalRounds} · {matched.length} / {cards.length}{" "}
        pairs · {turns} attempts
        {finished
          ? onNext
            ? " · Board complete! Next round…"
            : " · All boards complete!"
          : ""}
      </p>
      <div
        className={
          compact
            ? "grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5"
            : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        }
      >
        {tiles.map((t) => {
          const found = matched.includes(t.pair),
            bad = wrong.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              disabled={found || wrong.length > 0 || finished}
              aria-label={t.side + ": " + t.text + (found ? " · Matched" : "")}
              aria-pressed={selected === t.id}
              className={
                (compact ? "min-h-20 p-2 text-sm " : "min-h-24 p-3 ") +
                "break-words rounded-xl border-2 text-center transition-colors " +
                (found
                  ? "border-green-600 bg-green-100 text-green-950"
                  : bad
                    ? "border-red-600 bg-red-100 text-red-950"
                    : selected === t.id
                      ? "border-(--accent) bg-(--surface) text-(--ink)"
                      : "border-(--line) bg-(--surface) text-(--ink)")
              }
              onClick={() => choose(t)}
            >
              <span className="block text-xs">{t.side}</span>
              <strong>{t.text}</strong>
              {found && <span className="block">✓</span>}
            </button>
          );
        })}
      </div>
      {wrong.length > 0 && <p role="status">Not a match. Try another pair.</p>}
      {last && (
        <div role="status">
          <strong>
            {last.german_text} — {last.vietnamese_meaning}
          </strong>
          <p>{last.example_german}</p>
          <p>{last.example_vietnamese}</p>
        </div>
      )}
      {finished && !onNext && (
        <div className="flex justify-end">
          <Btn primary onClick={onDone}>
            Play again / Game setup
          </Btn>
        </div>
      )}
    </section>
  );
}
