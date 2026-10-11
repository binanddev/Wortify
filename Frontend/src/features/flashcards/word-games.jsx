import { useEffect, useState } from "react";
import {
  Btn,
  Field,
  Heading,
  Link,
  Page,
  useSound,
} from "../../components/ui/ui.jsx";
import { useWindowActive } from "../../lib/core.js";
import { mix } from "./flashcard-engine.js";
import {
  WORD_GAMES,
  contextGap,
  eligibleCards,
  sentenceTiles,
  checkGameAnswer,
  memoryTiles,
  demoGameCards,
} from "./word-games.js";

export function WordGames({ pack, lang, deck, sound, embedded = false, selectedMode = null }) {
  const Container = embedded ? "section" : Page;
  const [demo, setDemo] = useState(false),
    [round, setRound] = useState(() => {
      if (!selectedMode) return null;
      const cards = eligibleCards(pack.cards, selectedMode);
      return cards.length >= (selectedMode === "memory" ? 2 : 1)
        ? {mode: selectedMode, cards: mix(cards).slice(0, selectedMode === "memory" ? 6 : 10)}
        : null;
    }),
    [run, setRun] = useState(0);
  const cards = demo ? demoGameCards(lang) : pack.cards;
  return (
    <Container>
      {!embedded && <Link
        to={
          deck
            ? "/" + lang + "/flashcard/deck/" + deck
            : "/" + lang + "/flashcard"
        }
      >
        ← Back to flashcards
      </Link>}
      <Heading
        title={selectedMode ? WORD_GAMES.find(g => g[0] === selectedMode)?.[1] : "Word playground"}
        description="Learn words together, in sentences you can use."
      />
      {round ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>
              {demo ? "Sample collection" : "Your flashcards"} ·{" "}
              {WORD_GAMES.find((g) => g[0] === round.mode)[1]}
            </p>
            <Btn onClick={() => setRound(null)}>{selectedMode ? "Round setup / samples" : "Choose another game"}</Btn>
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
            <SentenceRound
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
          <div className="flex flex-wrap items-center gap-3">
            <Btn aria-pressed={!demo} onClick={() => setDemo(false)}>
              My cards
            </Btn>
            <Btn aria-pressed={demo} onClick={() => setDemo(true)}>
              Try sample collection
            </Btn>
          </div>
          <p className="my-3">
            {demo
              ? "Six original examples to try. Nothing is added to your deck."
              : "Games use the cards in your selected scope. Add example sentences and multi-word phrases to unlock more rounds."}
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {WORD_GAMES.filter(([mode]) => !selectedMode || mode === selectedMode).map(([mode, title, description]) => {
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
                    {mode === "memory" ? 6 : 10} per round
                  </p>
                  <p className="text-sm">
                    {mode === "context"
                      ? "Needs an example containing the saved term or an accepted form."
                      : mode === "sentence"
                        ? "Needs an example sentence of 3–40 words."
                        : "Needs at least two distinct phrases and meanings. Use terms with two or more words."}
                  </p>
                  <Btn
                    primary
                    isDisabled={eligible.length < minimum}
                    onClick={() => {
                      setRound({
                        mode,
                        cards: mix(eligible).slice(
                          0,
                          mode === "memory" ? 6 : 10,
                        ),
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
function SentenceRound({ cards, mode, grading, onDone, sound, lang }) {
  const [queue, setQueue] = useState(cards),
    [index, setIndex] = useState(0),
    [done, setDone] = useState(0);
  const next = (revealed) => {
    if (revealed) setQueue((q) => [...q, q[index]]);
    else setDone((n) => n + 1);
    setIndex((n) => n + 1);
  };
  return index >= queue.length ? (
    <section className="rounded-2xl border border-(--line) bg-(--surface) p-6">
      <h2 className="text-2xl font-semibold">Round complete</h2>
      <p>{done} sentences completed.</p>
      <Btn primary onClick={onDone}>
        Choose another game
      </Btn>
    </section>
  ) : (
    <div>
      <p className="my-3" role="status">
        {done} / {cards.length} completed
        {queue.length > cards.length ? " · Review turns included" : ""}
      </p>
      <SentenceTurn
        key={index}
        card={queue[index]}
        {...{ mode, grading, sound, lang }}
        onNext={next}
      />
    </div>
  );
}
function SentenceTurn({ card, mode, grading, onNext, sound, lang }) {
  const [answer, setAnswer] = useState(""),
    [chosen, setChosen] = useState([]),
    [feedback, setFeedback] = useState(""),
    [hint, setHint] = useState(false);
  const [tiles] = useState(() => sentenceTiles(card)),
    audio = useSound(sound, lang);
  const gap = mode === "context" ? contextGap(card) : null;
  const complete = feedback === "correct" || feedback === "revealed";
  const check = () => {
    const value =
      mode === "context"
        ? answer
        : chosen.map((id) => tiles.find((t) => t.id === id).text).join(" ");
    const correct = checkGameAnswer(card, mode, value, grading);
    setFeedback(correct ? "correct" : "incorrect");
    audio.feedback(correct);
  };
  return (
    <section className="grid gap-5 rounded-2xl border border-(--line) bg-(--surface) p-5 sm:p-7">
      <div>
        <p className="text-sm">
          {mode === "context"
            ? "Use the saved word or phrase for this meaning:"
            : "Rebuild the saved example sentence:"}
        </p>
        <h2 className="text-xl font-semibold">
          {mode === "context"
            ? card.vietnamese_meaning
            : card.example_vietnamese || card.vietnamese_meaning}
        </h2>
      </div>
      {mode === "context" ? (
        <>
          <p className="text-2xl leading-relaxed">
            {gap.before}
            <span className="border-b-2 border-(--accent) px-2">
              {complete ? gap.answer : "____"}
            </span>
            {gap.after}
          </p>
          {!complete && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (answer.trim()) check();
              }}
            >
              <Field
                label="Missing word or phrase"
                value={answer}
                onChange={(v) => {
                  setAnswer(v);
                  setFeedback("");
                }}
                autoComplete="off"
              />
              <div className="mt-3 flex justify-end">
                <Btn type="submit" primary isDisabled={!answer.trim()}>
                  Check
                </Btn>
              </div>
            </form>
          )}
        </>
      ) : (
        <>
          <div
            className="flex min-h-20 flex-wrap items-center gap-2"
            aria-label="Your sentence"
          >
            {chosen.length ? (
              chosen.map((id) => (
                <Btn
                  key={id}
                  isDisabled={complete}
                  title="Return word to bank"
                  onClick={() => {
                    setChosen((c) => c.filter((x) => x !== id));
                    setFeedback("");
                  }}
                >
                  {tiles.find((t) => t.id === id).text}
                </Btn>
              ))
            ) : (
              <p>
                Tap words below to build the sentence. Tap a placed word to
                return it.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Word bank">
            {tiles
              .filter((t) => !chosen.includes(t.id))
              .map((t) => (
                <Btn
                  key={t.id}
                  isDisabled={complete}
                  onClick={() => {
                    setChosen((c) => [...c, t.id]);
                    setFeedback("");
                  }}
                >
                  {t.text}
                </Btn>
              ))}
          </div>
          {!complete && (
            <div className="flex justify-end">
              <Btn
                primary
                isDisabled={chosen.length !== tiles.length}
                onClick={check}
              >
                Check
              </Btn>
            </div>
          )}
        </>
      )}
      {!complete && (
        <div className="flex flex-wrap gap-3">
          <Btn onClick={() => setHint(true)}>Hint</Btn>
          <Btn onClick={() => setFeedback("revealed")}>
            Show answer &amp; revisit
          </Btn>
        </div>
      )}
      {hint && !complete && (
        <p role="status">
          {mode === "context"
            ? "Starts with: " +
              Array.from(gap.answer)[0] +
              " · " +
              gap.answer.split(/\s+/).length +
              " word(s)"
            : "Starts with: " +
              card.example_german.split(/\s+/).slice(0, 2).join(" ")}
        </p>
      )}
      {feedback === "incorrect" && (
        <p className="feedback feedback-incorrect" role="alert">
          Not quite. Try again
          {mode === "sentence" ? " — rebuild the saved example sentence" : ""}.
        </p>
      )}
      {complete && (
        <>
          <div className="feedback feedback-correct" role="status">
            <strong>
              {feedback === "correct"
                ? "Correct!"
                : "Saved example · You will try this again"}
            </strong>
            <p>{card.example_german}</p>
            <p>{card.example_vietnamese}</p>
            <p>
              {card.german_text} — {card.vietnamese_meaning}
            </p>
            {card.usage && <p>{card.usage}</p>}
          </div>
          <div className="flex justify-end">
            <Btn primary onClick={() => onNext(feedback === "revealed")}>
              Next →
            </Btn>
          </div>
        </>
      )}
    </section>
  );
}
function MemoryRound({ cards, onDone, sound, lang }) {
  const [tiles] = useState(() => memoryTiles(cards)),
    [open, setOpen] = useState([]),
    [matched, setMatched] = useState([]),
    [turns, setTurns] = useState(0),
    [last, setLast] = useState(null);
  const active = useWindowActive(),
    audio = useSound(sound, lang);
  useEffect(() => {
    if (open.length !== 2 || !active) return;
    const [a, b] = open.map((id) => tiles.find((t) => t.id === id));
    if (a.pair === b.pair) {
      setMatched((m) => (m.includes(a.pair) ? m : [...m, a.pair]));
      setLast(a.card);
      setOpen([]);
      audio.feedback(true);
    } else {
      const timer = setTimeout(() => setOpen([]), 1000);
      return () => clearTimeout(timer);
    }
  }, [open, active, tiles]);
  const finished = matched.length === cards.length;
  return (
    <section className="grid gap-4 rounded-2xl border border-(--line) bg-(--surface) p-5">
      <p role="status">
        {matched.length} / {cards.length} pairs · {turns} turns
        {finished ? " · Round complete!" : ""}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((t, i) => {
          const found = matched.includes(t.pair),
            visible = found || open.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              disabled={found || open.includes(t.id) || open.length === 2}
              aria-label={
                visible ? t.side + ": " + t.text : "Turn over card " + (i + 1)
              }
              aria-pressed={visible}
              className={
                "min-h-28 rounded-xl border p-3 text-center " +
                (found
                  ? "border-green-600 bg-green-100 text-green-950"
                  : "border-(--line) bg-(--surface) text-(--ink)")
              }
              onClick={() => {
                setOpen((o) => [...o, t.id]);
                if (open.length === 1) setTurns((n) => n + 1);
              }}
            >
              <span className="block text-sm">{visible ? t.side : "?"}</span>
              <strong>{visible ? t.text : "Card " + (i + 1)}</strong>
              {found && <span className="block">✓</span>}
            </button>
          );
        })}
      </div>
      {open.length === 2 &&
        tiles.find((t) => t.id === open[0]).pair !==
          tiles.find((t) => t.id === open[1]).pair && (
          <p role="status">Different pair — remember their positions.</p>
        )}
      {last && (
        <div role="status">
          <strong>
            {last.german_text} — {last.vietnamese_meaning}
          </strong>
          <p>{last.example_german}</p>
          <p>{last.example_vietnamese}</p>
        </div>
      )}
      {finished && (
        <div className="flex justify-end">
          <Btn primary onClick={onDone}>
            Choose another game
          </Btn>
        </div>
      )}
    </section>
  );
}
