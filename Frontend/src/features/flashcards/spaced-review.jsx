import { SkipButton } from "../learning/skip-controls.jsx";
import { useEffect, useRef, useState } from "react";
import { endpoint, request, useResource } from "../../lib/core.js";
import { useLearningSync, pendingLearning } from "../learning/learning-sync.js";
import { useAnswerClock } from "../learning/use-answer-clock.js";
import { Btn, Icon, Status, Field, SidebarTools, FlipCard } from "../../components/ui/ui.jsx";
import { PracticeModal } from "../practice/practice-workspace.jsx";
const labels = ["Not remembered", "Hard", "Remembered", "Easy"];
const icons = ["refresh", "history", "check", "spark"];
function delay(date) {
  const minutes = Math.max(
    1,
    Math.round((new Date(date) - Date.now()) / 60000),
  );
  return minutes < 60
    ? `${minutes} minutes`
    : minutes < 1440
      ? `${Math.round(minutes / 60)} hours`
      : minutes < 43200
        ? `${Math.round(minutes / 1440)} days`
        : `${Math.round(minutes / 43200)} months`;
}
export default function SpacedReview({ lang, id, userId }) {
  const resource = useResource(endpoint(lang, `decks/${id}/review/`));
  const sync = useLearningSync(userId, lang);
  const [reviewed, setReviewed] = useState(() =>
    pendingLearning(userId, lang)
      .filter(
        (e) => e.kind === "review" && Number(e.payload.deck) === Number(id),
      )
      .map((e) => e.payload.card),
  );
  const [skipped, setSkipped] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [revealed, setRevealed] = useState(false),
    [settings, setSettings] = useState(false),
    [stats, setStats] = useState(false),
    [error, setError] = useState("");
  const card = resource.data?.cards.find((c) => !reviewed.includes(c.id));
  const rated = useRef(new Set());
  const [nextDue, setNextDue] = useState(null);
  const timer = useAnswerClock(card?.id);
  const duration = useRef(null);
  const data = resource.data;
  useEffect(() => {
    sync.flush().then(() => resource.reload());
  }, []);
  useEffect(() => {
    setSkipped(false);
    setRevealed(false);
    setFlipped(false);
    duration.current = null;
  }, [card?.id]);
  const rate = (index) => {
    if (rated.current.has(card.id)) return;
    rated.current.add(card.id);
    setNextDue(card.choices[String(index + 1)]);
    sync.enqueue("review", {
      deck: Number(id),
      card: card.id,
      type: "flash",
      correct: index !== 0,
      rating: index + 1,
      response_ms: duration.current,
      goal: "comprehensive",
    });
    setRevealed(false);
    setFlipped(false);
    setReviewed((previous) => [...previous, card.id]);
    sync.flush();
  };
  return (
    <section className="mx-auto grid w-full max-w-3xl gap-5">
      <SidebarTools navOnly>
        <div className="flash-icon-row">
          <Btn icon="settings" onClick={() => setSettings(true)}>
            Spaced review options
          </Btn>
          <Btn icon="history" onClick={() => setStats(true)}>
            Review schedule and difficult cards
          </Btn>
          <Btn
            icon="refresh"
            onClick={() => {
              sync.flush().then(() => {
                setReviewed(
                  pendingLearning(userId, lang)
                    .filter(
                      (e) =>
                        e.kind === "review" &&
                        Number(e.payload.deck) === Number(id),
                    )
                    .map((e) => e.payload.card),
                );
                rated.current.clear();
                resource.reload();
              });
            }}
          >
            Update review schedule
          </Btn>
        </div>
      </SidebarTools>
      <Status error={error || resource.error || sync.error} />
      {sync.pending > 0 && (
        <p className="text-sm text-(--muted)">Waiting to sync learning activity.</p>
      )}
      {data && (
        <p className="text-center text-sm text-(--muted)">
          {data.due} due · {data.new} new cards · {data.reviewed_today} reviewed today
        </p>
      )}
      {resource.loading ? (
        <Status>Opening review schedule…</Status>
      ) : card ? (
        <>
          <div ref={timer.root}>
            <FlipCard
              front={card.front}
              back={card.back}
              example={card.example}
              flipped={flipped}
              setFlipped={(value) => {
                if (value && !revealed) {
                  duration.current = timer.read();
                  setRevealed(true);
                }
                setFlipped(value);
              }}
            />
          </div>
          <div className="flex justify-center">
            {skipped ? (
              <Btn icon="arrow" primary onClick={() => rate(0)}>
                Continue
              </Btn>
            ) : (
              <SkipButton
                onClick={() => {
                  duration.current ??= timer.read();
                  setRevealed(true);
                  setFlipped(true);
                  setSkipped(true);
                }}
              />
            )}
          </div>
          {revealed && !skipped && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {labels.map((label, index) => (
                <Btn
                  key={label}
                  className="btn flex h-auto flex-col gap-2 py-4"
                  onClick={() => {
                    rate(index);
                  }}
                >
                  <Icon name={icons[index]} />
                  <span>{label}</span>
                  <small>{delay(card.choices[String(index + 1)])}</small>
                </Btn>
              ))}
            </div>
          )}
        </>
      ) : (
        data && (
          <div className="rounded-3xl border border-(--line) p-10 text-center">
            <Icon name="check" size={32} />
            <h2 className="mt-4 text-xl font-bold">Review complete</h2>
            <p className="mt-2 text-(--muted)">
              {nextDue || data.next_due
                ? `Next review: ${new Date(nextDue || data.next_due).toLocaleString("en-GB")}`
                : "You can continue with other study modes."}
            </p>
          </div>
        )
      )}
      {settings && data && (
        <PracticeModal
          title="Spaced review"
          size="lg"
          onClose={() => setSettings(false)}
        >
          <ReviewSettings
            config={data.config}
            onSave={async (config) => {
              await request(
                endpoint(lang, `decks/${id}/review/`),
                "PATCH",
                config,
              );
              resource.reload();
              setSettings(false);
            }}
          />
        </PracticeModal>
      )}
      {stats && data && (
        <PracticeModal title="Review schedule" onClose={() => setStats(false)}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {data.forecast.map((day) => (
              <div
                key={day.date}
                className="rounded-xl border border-(--line) p-3"
              >
                <small>{day.date}</small>
                <p className="text-xl font-bold">{day.count}</p>
              </div>
            ))}
          </div>
          <h3 className="mt-4 font-semibold">Needs practice</h3>
          {data.difficult.length ? (
            data.difficult.map((c) => (
              <p key={c.id}>
                {c.title} · {c.lapses} missed attempts
              </p>
            ))
          ) : (
            <p>No frequently missed cards.</p>
          )}
          <p className="text-sm text-(--muted)">
            The schedule adjusts after each review. Overdue cards come first; there is no need to cram.
          </p>
        </PracticeModal>
      )}
    </section>
  );
}
function ReviewSettings({ config, onSave }) {
  const [error, setError] = useState("");
  const [value, setValue] = useState(config),
    [saving, setSaving] = useState(false);
  return (
    <div className="grid gap-4">
      <Status error={error} />
      <Field
        label="Mastery target (%)"
        type="number"
        min={80}
        max={97}
        value={Math.round(value.retention * 100)}
        onChange={(v) => setValue({ ...value, retention: Number(v) / 100 })}
      />
      {[
        ["new_limit", "New cards per day"],
        ["review_limit", "Daily review limit"],
      ].map(([key, label]) => (
        <Field
          key={key}
          label={label}
          type="number"
          min={0}
          max={500}
          value={value[key]}
          onChange={(v) => setValue({ ...value, [key]: Number(v) })}
        />
      ))}
      <label className="check-line">
        <input
          type="checkbox"
          checked={value.adapt_time}
          onChange={(e) => setValue({ ...value, adapt_time: e.target.checked })}
        />
        Use response time to support assessment
      </label>
      <p className="text-sm text-(--muted)">
        Accuracy and recall history are the main signals. Unusually slow answers are considered only when enough comparable data is available. You always choose your own recall rating in this mode.
      </p>
      <Btn
        icon="save"
        primary
        isLoading={saving}
        onClick={async () => {
          setSaving(true);
          try {
            setError("");
            await onSave(value);
          } catch (error) {
            setError(error.message);
          } finally {
            setSaving(false);
          }
        }}
      >
        Save options
      </Btn>
    </div>
  );
}
