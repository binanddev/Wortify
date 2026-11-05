import { useEffect, useState } from "react";
import { request, endpoint } from "../../lib/core.js";
import { learningQueueStore as queueStore } from "./learning-queue-store.js";
const flights = new Map();
const timers = new Map();
function schedule(user, lang, delay = 2000) {
  const key = queueKey(user, lang);
  clearTimeout(timers.get(key));
  const timer = setTimeout(() => {
    timers.delete(key);
    flushLearning(user, lang);
  }, delay);
  timer.unref?.();
  timers.set(key, timer);
}
const queueKey = (user, lang) => `wortify:sync:${user}:${lang}`;
// Recover before consumers take their initial progress/preferences snapshot.
export function restoreLearning(user) {
  return Promise.all(["en", "de"].map(lang => queueStore.restore(queueKey(user, lang))));
}
export function pendingLearning(user, lang) {
  const key = queueKey(user, lang);
  const queue = queueStore.read(key);
  const unavailable = queue.filter(
    (e) =>
      e.errorCode === "content_unavailable" ||
      e.error === "This content is no longer accessible." ||
      e.error === "Nội dung không còn truy cập được.",
  );
  if (!unavailable.length) return queue;
  // Keep obsolete receipts locally for recovery, outside the active retry queue.
  queueStore.update(`${key}:unavailable`, (archived) => {
    const known = new Set(archived.map((e) => e.token));
    return [...archived, ...unavailable.filter((e) => !known.has(e.token))];
  });
  const remaining = queue.filter((e) => !unavailable.includes(e));
  const removed = new Set(unavailable.map((e) => e.token));
  queueStore.update(key, (current) =>
    current.filter((e) => !removed.has(e.token)),
  );
  return remaining;
}
function announce() {
  window.dispatchEvent(new Event("learning-sync-change"));
}
export function enqueueLearning(user, lang, kind, payload, eventToken) {
  const key = queueKey(user, lang);
  const token = eventToken || crypto.randomUUID(),
    at = new Date().toISOString();
  const updated = queueStore.update(key, (queue) => {
    if (queue.some(event => event.token === token)) return queue;
    let eventPayload = payload;
    if (kind === "practice_progress") {
      const previous = queue.filter(
        (e) =>
          e.kind === kind &&
          e.payload.node === payload.node &&
          e.payload.revision === payload.revision,
      );
      eventPayload = {
        ...payload,
        completed: [
          ...new Set([
            ...previous.flatMap((e) => e.payload.completed || []),
            ...(payload.completed || []),
          ]),
        ],
      };
    }
    // A newer preferences snapshot supersedes an unsent older snapshot.
    const next = [
      "options",
      "preferences",
      "study_settings",
      "practice_progress",
    ].includes(kind)
      ? queue.filter(
          (e) =>
            e.kind !== kind ||
            (kind === "options" && e.payload.deck !== payload.deck) ||
            (kind === "practice_progress" &&
              (e.payload.node !== payload.node ||
                e.payload.revision !== payload.revision)),
        )
      : queue;
    const event = {
      token,
      at,
      kind,
      payload:
        kind === "preferences"
          ? {
              ...Object.assign(
                {},
                ...queue.filter((e) => e.kind === kind).map((e) => e.payload),
              ),
              ...eventPayload,
            }
          : eventPayload,
    };
    return [...next, event];
  });
  announce();
  if (updated.length >= 20) flushLearning(user, lang);
  else schedule(user, lang, kind === "review" ? 5000 : 1200);
  return token;
}
export async function flushLearning(user, lang) {
  const key = queueKey(user, lang);
  clearTimeout(timers.get(key));
  timers.delete(key);
  if (flights.has(key)) return flights.get(key);
  await queueStore.restore(key);
  if (flights.has(key)) return flights.get(key);
  // Older clients permanently marked legacy theme snapshots as rejected.
  // Replay each affected receipt once now that the API accepts Aurora profiles.
  const needsThemeRetry = event => event.kind === "preferences" &&
    event.error === "Invalid theme." && !event.retriedLegacyTheme;
  if (queueStore.read(key).some(needsThemeRetry)) {
    queueStore.update(key, queue => queue.map(event => {
      if (!needsThemeRetry(event)) return event;
      const { error, errorCode, ...receipt } = event;
      return { ...receipt, retriedLegacyTheme: true };
    }));
  }
  const events = pendingLearning(user, lang)
    .filter((e) => !e.error)
    .slice(0, 100);
  if (!events.length) return;
  const task = request(endpoint(lang, "learning/sync/"), "POST", {
    events,
    account_id: user,
  })
    .then((data) => {
      const done = new Set(data.accepted.map((e) => e.token));
      const errors = new Map(data.errors.map((e) => [e.token, e]));
      queueStore.update(key, (current) =>
        current
          .filter((e) => !done.has(e.token))
          .map((e) =>
            errors.has(e.token)
              ? {
                  ...e,
                  error: errors.get(e.token).error,
                  errorCode: errors.get(e.token).code,
                }
              : e,
          ),
      );
      pendingLearning(user, lang);
      window.dispatchEvent(
        new CustomEvent("learning-synced", { detail: { user, lang, ...data } }),
      );
    })
    .catch(() => {})
    .finally(() => {
      flights.delete(key);
      announce();
      if (pendingLearning(user, lang).some((e) => !e.error))
        schedule(user, lang, 15000);
    });
  flights.set(key, task);
  return task;
}
export function useLearningSync(user, lang) {
  const [queue, setQueue] = useState(() => pendingLearning(user, lang));
  useEffect(() => {
    if (!user) return;
    const refresh = () => setQueue(pendingLearning(user, lang));
    const flush = () => flushLearning(user, lang);
    const leaving = (event) => {
      if (
        pendingLearning(user, lang).length &&
        !queueStore.durable(queueKey(user, lang))
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const hidden = () => {
      if (document.hidden) flush();
    };
    window.addEventListener("learning-sync-change", refresh);
    window.addEventListener("online", flush);
    window.addEventListener("beforeunload", leaving);
    document.addEventListener("visibilitychange", hidden);
    const timer = setInterval(flush, 15000);
    flush();
    return () => {
      clearInterval(timer);
      window.removeEventListener("learning-sync-change", refresh);
      window.removeEventListener("online", flush);
      window.removeEventListener("beforeunload", leaving);
      document.removeEventListener("visibilitychange", hidden);
      flush();
    };
  }, [user, lang]);
  const errors = queue.filter((e) => e.error);
  const storageWarning =
    queue.length && !queueStore.durable(queueKey(user, lang))
      ? "Your progress is not saved on this device. Keep this page open until syncing finishes, or enable browser storage."
      : "";
  return {
    enqueue: (kind, payload, token) => enqueueLearning(user, lang, kind, payload, token),
    flush: () => flushLearning(user, lang),
    message: errors.length
      ? `${errors.length} unsaved items: ${errors[0].error}`
      : queue.length
        ? `${queue.length} changes waiting to sync`
        : "Synced",
    error:
      storageWarning ||
      (errors.length
        ? errors[0].error
        : queue.some((e) => Date.now() - Date.parse(e.at) > 20000)
          ? "Unable to reach the server. Changes will be retried automatically."
          : ""),
    pending: queue.length,
  };
}
