import { t as tr, useLocale } from "../../i18n/index.js";
import QuickCardEditor from "./quick-card-editor.jsx";
import { checkRecall } from "./notebook-recall.js";
import { useEffect, useRef, useState } from "react";
import {
  request,
  endpoint,
  readPreference,
  savePreference,
} from "../../lib/core.js";
import { Btn, Status, Link, Confirm } from "../../components/ui/ui.jsx";

const phases = [
  ["prepare", "Prepare"],
  ["recall", "Recall"],
  ["sentence", "Translate"],
  ["variation", "New sentence"],
  ["check", "Check"],
];
export default function VocabularyNotebook({ lang, id, userId, onCardUpdated }) {
  useLocale();
  const path = endpoint(lang, `decks/${id}/notebook/`);
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [size, setSize] = useState(5),
    [selection, setSelection] = useState("ready"),
    [discard, setDiscard] = useState(false);
  const [editing, setEditing] = useState(null);
  const guard = useRef(false),
    pending = useRef(null);
  useEffect(() => {
    const c = new AbortController();
    request(path, "GET", undefined, c.signal)
      .then(setData)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => c.abort();
  }, [path]);
  async function reload() {
    try {
      setData(await request(path));
      setError("");
      pending.current = null;
    } catch (e) {
      setError(e.message);
    }
  }
  async function act(action, values = {}) {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    const signature = JSON.stringify({
      action,
      ...values,
      revision: data.notebook.revision,
    });
    if (pending.current?.signature !== signature)
      pending.current = {
        signature,
        body: {
          action,
          ...values,
          revision: data.notebook.revision,
          token: crypto.randomUUID(),
        },
      };
    try {
      const result = await request(path, "POST", pending.current.body);
      const previous = data.notebook.session;
      if (previous) {
        try {
          const prefix = `wortify:notebook:${userId}:${lang}:${id}:${previous.id}:`;
          if (action === "discard" || result.notebook.session?.done) {
            for (const stored of Object.keys(localStorage))
              if (stored.startsWith(prefix)) localStorage.removeItem(stored);
          } else if (action === "step")
            localStorage.removeItem(
              `${prefix}${previous.phase}:${previous.cards[previous.index]}`,
            );
        } catch {
          /* Browser storage can be unavailable. */
        }
      }
      setData(result);
      pending.current = null;
      setDiscard(false);
    } catch (e) {
      setError(e.message);
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  if (!data)
    return (
      <section>
        <Status error={error}>{tr("Opening notebook…")}</Status>
        {error && <Btn onClick={reload}>{tr("Retry")}</Btn>}
      </section>
    );
  const session = data.notebook.session;
  const cards = new Map(data.cards.map((c) => [c.id, c]));
  const active = session && !session.done;
  const card = active ? cards.get(session.cards[session.index]) : null;
  const missing = active && session.cards.some((cid) => !cards.has(cid));
  const records = data.notebook.records || {};
  return (
    <section
      className="mx-auto max-w-3xl space-y-5"
      aria-label={tr("Vocabulary notebook")}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{tr("Vocabulary notebook")}</h2>
          <p className="text-sm">{tr("Recall · create · reuse")}</p>
        </div>
        {active && (
          <Btn isDisabled={busy} onClick={() => setDiscard(true)}>{tr("Discard this set")}</Btn>
        )}
      </header>
      <Status error={error} />
      {error && (
        <Btn isDisabled={busy} onClick={reload}>{tr("Reload saved step")}</Btn>
      )}
      {!active && (
        <>
          {session?.done && (
            <section
              className="rounded-xl border border-(--line) p-4 space-y-3"
              aria-label={tr("Set results")}
            >
              <h3 className="font-semibold">{tr("Completed ")}{session.cards.length}{" "}
                {session.cards.length === 1 ? tr("word") : tr("words")}
              </h3>
              <p className="text-sm">{tr("Your self-assessments track recall and sentence use separately.")}</p>
              <ul className="space-y-3">
                {session.cards.map((cid) => (
                  <li key={cid}>
                    <strong>
                      {cards.get(cid)?.german_text || tr("Deleted card")}
                    </strong>
                    <span className="block text-sm">
                      {records[cid]?.needs_practice
                        ? tr("Needs practice")
                        : tr("Recalled and used in a sentence")}{" "}{tr("· Review on ")}{records[cid]?.next_date}
                    </span>
                    <details>
                      <summary className="text-sm">{tr("Your sentences")}</summary>
                      <p>{session.answers[cid]?.sentence?.answer}</p>
                      <p>{session.answers[cid]?.sentence?.correction}</p>
                      <p>{session.answers[cid]?.variation?.answer}</p>
                      <p>{session.answers[cid]?.variation?.correction}</p>
                    </details>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="rounded-xl border border-(--line) p-5 space-y-4">
            <p>{tr("Prepare the whole set, recall each word, translate a sentence, write a new one, then recall the words again without answers.")}</p>
            <div className="flex flex-wrap gap-4">
              <label className="flex flex-col gap-1">{tr("Words per set")}<select
                  value={size}
                  onChange={(e) => setSize(Number(e.target.value))}
                >
                  {[3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>
                      {n}{tr(" words")}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">{tr("Word selection")}<select
                  value={selection}
                  onChange={(e) => setSelection(e.target.value)}
                >
                  <option value="ready">{tr("Review words + new words")}</option>
                  <option value="all">{tr("Include early practice")}</option>
                </select>
              </label>
            </div>
            <p className="text-sm">
              {data.due}{tr(" ready to review · ")}{data.new}{tr(" new. Try 5 words in about 15 minutes; there is no time limit.")}</p>
            <Btn
              primary
              isDisabled={
                busy ||
                !data.total ||
                (selection === "ready" && !data.due && !data.new)
              }
              onClick={() => act("start", { size, selection })}
            >{tr("Start set")}</Btn>
            {!data.total && (
              <p>{tr("This deck is empty.")}{" "}
                <Link to={`/${lang}/flashcard/deck/${id}/edit`}>{tr("Add words")}</Link>
              </p>
            )}
            <details className="text-sm">
              <summary>{tr("How does the review plan work?")}</summary>
              <p>{tr("Successful scheduled reviews use intervals of 1, 3, 7 and 14 days. Difficult words return tomorrow. Early practice does not advance the schedule. You assess your sentences; grammar is not automatically graded.")}</p>
            </details>
          </div>
        </>
      )}
      {active && (
        <>
          <ol className="flex flex-wrap gap-2 text-sm" aria-label={tr("Set steps")}>
            {phases.map(([phase, label], i) => (
              <li
                key={phase}
                aria-current={session.phase === phase ? "step" : undefined}
                className={`rounded-lg px-3 py-2 ${session.phase === phase ? "bg-(--solid) font-semibold" : "opacity-60"}`}
              >
                {i + 1}. {tr(label)}
              </li>
            ))}
          </ol>
          <p className="text-sm" aria-live="polite">
            {tr(phases.find((p) => p[0] === session.phase)?.[1])} ·{" "}
            {session.index + 1}/{session.cards.length}
          </p>
          {missing ? (
            <p>{tr("A card in this set was deleted. Discard this set to choose words again.")}</p>
          ) : (
            <NotebookStep
              key={`${session.id}:${session.phase}:${session.index}`}
              {...{ card, lang, busy, userId, id, session }}
              onEdit={() => setEditing(card)}
              onNext={(values) => act("step", values)}
            />
          )}
          <p className="text-xs opacity-70">{tr("Completed steps are saved to your account. Unfinished drafts stay in this browser.")}</p>
        </>
      )}
      {editing && <QuickCardEditor card={editing} lang={lang} deckId={id}
        onClose={() => setEditing(null)} onSaved={updated => {
          setData(old => ({ ...old, cards: old.cards.map(c => c.id === updated.id ? updated : c) }));
          onCardUpdated?.(updated);
        }} />}
      {discard && (
        <Confirm
          title={tr("Discard this set?")}
          description={tr("This unfinished set will be discarded. Review dates from completed sets are kept.")}
          confirmLabel={tr("Discard set")}
          onClose={() => setDiscard(false)}
          onConfirm={() => act("discard")}
        />
      )}
    </section>
  );
}
function NotebookStep({ card, lang, busy, userId, id, session, onNext, onEdit }) {
  useLocale();
  const phase = session.phase,
    recall = phase === "recall" || phase === "check";
  const key = `wortify:notebook:${userId}:${lang}:${id}:${session.id}:${phase}:${card.id}`;
  const [draft, setDraft] = useState(() =>
    readPreference(key, {
      answer: "",
      correction: "",
      revealed: false,
      struggled: false,
    }),
  );
  const { answer, correction, revealed, struggled } = draft;
  const [copied, setCopied] = useState("");
  const patch = (change) => setDraft((old) => ({ ...old, ...change }));
  useEffect(() => savePreference(key, draft), [key, draft]);
  const correct = checkRecall(card, answer);
  const editButton = <Btn isDisabled={busy} onClick={() => { if (recall) patch({ struggled: true }); onEdit(); }}>{tr("Edit card")}</Btn>;
  const language = lang === "de" ? "German" : "English";
  const complete = (remembered) =>
    onNext({ answer, correction, remembered: remembered && !struggled });
  const sample = (
    <div className="space-y-2">
      <p className="text-lg font-semibold">
        {card.german_text}
      </p>
      <p>{card.vietnamese_meaning}</p>
      {card.example_german && <p>{card.example_german}</p>}
      {card.example_vietnamese && <p>{card.example_vietnamese}</p>}
    </div>
  );
  if (phase === "prepare")
    return (
      <div className="rounded-xl border border-(--line) p-5 space-y-5">
        {editButton}
        {sample}
        <p className="text-sm opacity-70">{tr("Read to understand the expression and its use. Prepare all")}{" "}
          {session.cards.length}{tr(" words before recalling them.")}</p>
        <Btn primary isDisabled={busy} onClick={() => onNext({})}>{tr("Ready · Next")}</Btn>
      </div>
    );
  async function copyFeedback() {
    try {
      await navigator.clipboard.writeText(
        `Please correct my ${language} sentence and briefly explain grammar, prepositions and word order in Vietnamese. Accept correct alternatives to the example.\nExpression: ${card.german_text}\nIntended meaning: ${phase === "sentence" ? card.example_vietnamese : "My own new sentence"}\nMy sentence: ${answer}\nReference example: ${card.example_german}`,
      );
      setCopied("Copied. Paste into your chat for feedback.");
    } catch {
      setCopied("Could not copy. Select and copy your sentence manually.");
    }
  }
  return (
    <div className="rounded-xl border border-(--line) p-5 space-y-5">
      {editButton}
      <div>
        <h3 className="text-lg font-semibold">
          {recall
            ? card.vietnamese_meaning
            : phase === "sentence"
              ? card.example_vietnamese ||
                tr("Write a sentence using \u201c{v0}\u201d", { v0: card.german_text })
              : tr("Use \u201c{v0}\u201d in a new sentence", { v0: card.german_text })}
        </h3>
        <p className="text-sm">
          {recall
            ? tr("Recall and write the {v0} expression before revealing the answer.", { v0: tr(language) })
            : phase === "sentence"
              ? tr("Write in {v0}; keep the example hidden.", { v0: tr(language) })
              : tr("Change the time, subject, place or situation. Create a sentence instead of copying the example.")}
        </p>
      </div>
      <label className="block space-y-2">
        <span>{recall ? tr("Your recalled expression") : tr("Your sentence")}</span>
        <textarea
          className="w-full rounded-lg border border-(--line) bg-(--surface) p-3"
          rows={recall ? 2 : 4}
          maxLength={2000}
          value={answer}
          onChange={(e) => patch({ answer: e.target.value })}
          disabled={busy || revealed}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      {!revealed ? (
        <Btn
          primary
          isDisabled={busy}
          onClick={() => patch({ revealed: true, struggled: struggled || (recall && !correct) })}
        >
          {recall ? tr("Check answer") : tr("Compare and correct")}
        </Btn>
      ) : (
        <>
          <section
            className="rounded-lg bg-(--solid) p-4 space-y-2"
            aria-label={tr("Reference answer")}
          >
            {recall && <p role="status" className="font-semibold">{correct ? tr("Correct") : tr("Not correct yet · Compare with the answer below.")}</p>}
            {sample}
            {!recall && (
              <p className="text-sm">{tr("The example is one possible answer. Check verb forms, prepositions/case, noun gender and word order. Other sentences can also be correct.")}</p>
            )}
          </section>
          {!recall && (
            <>
              <label className="block space-y-2">
                <span>{tr("Correction / notes")}</span>
                <textarea
                  className="w-full rounded-lg border border-(--line) bg-(--surface) p-3"
                  rows={3}
                  maxLength={2000}
                  value={correction}
                  disabled={busy}
                  onChange={(e) => patch({ correction: e.target.value })}
                />
              </label>
              <Btn isDisabled={busy || !answer.trim()} onClick={copyFeedback}>{tr("Copy for chat feedback")}</Btn>
              <p role="status" className="text-sm">
                {tr(copied)}
              </p>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <Btn
              primary
              isDisabled={busy || !answer.trim() || (recall && !correct)}
              onClick={() => complete(true)}
            >
              {recall
                ? struggled
                  ? tr("Retried · Review sooner")
                  : tr("Recalled unaided")
                : struggled
                  ? tr("Revised · Practise again")
                  : tr("Self-check: I can use it")}
            </Btn>
            <Btn
              isDisabled={busy}
              onClick={() =>
                patch({ answer: "", revealed: false, struggled: true })
              }
            >
              {recall ? tr("Hide and try again") : tr("Rewrite without the example")}
            </Btn>
            <Btn isDisabled={busy} onClick={() => complete(false)}>{tr("Needs practice · Next")}</Btn>
          </div>
        </>
      )}
    </div>
  );
}
