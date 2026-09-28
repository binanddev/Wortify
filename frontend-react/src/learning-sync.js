import { useEffect, useState } from "react";
import { request, endpoint, readPreference, savePreference } from "./core.js";
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
export function pendingLearning(user, lang) {
  const key = queueKey(user, lang);
  const queue = readPreference(key, []);
  const unavailable = queue.filter(
    (e) =>
      e.errorCode === "content_unavailable" ||
      e.error === "Nội dung không còn truy cập được.",
  );
  if (!unavailable.length) return queue;
  // Keep obsolete receipts locally for recovery, outside the active retry queue.
  const archived = readPreference(`${key}:unavailable`, []);
  const known = new Set(archived.map((e) => e.token));
  savePreference(`${key}:unavailable`, [
    ...archived,
    ...unavailable.filter((e) => !known.has(e.token)),
  ]);
  const remaining = queue.filter((e) => !unavailable.includes(e));
  savePreference(key, remaining);
  return remaining;
}
function announce() {
  window.dispatchEvent(new Event("learning-sync-change"));
}
export function enqueueLearning(user, lang, kind, payload) {
  const key = queueKey(user, lang),
    queue = readPreference(key, []);
  if (kind === "practice_progress") {
    const previous = queue.filter(
      (e) =>
        e.kind === kind &&
        e.payload.node === payload.node &&
        e.payload.revision === payload.revision,
    );
    payload = {
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
    token: crypto.randomUUID(),
    at: new Date().toISOString(),
    kind,
    payload:
      kind === "preferences"
        ? {
            ...Object.assign(
              {},
              ...queue.filter((e) => e.kind === kind).map((e) => e.payload),
            ),
            ...payload,
          }
        : payload,
  };
  savePreference(key, [...next, event]);
  announce();
  if (next.length >= 19) flushLearning(user, lang);
  else schedule(user, lang, kind === "review" ? 5000 : 1200);
  return event.token;
}
export async function flushLearning(user, lang) {
  const key = queueKey(user, lang);
  clearTimeout(timers.get(key));
  timers.delete(key);
  if (flights.has(key)) return flights.get(key);
  const events = pendingLearning(user, lang)
    .filter((e) => !e.error)
    .slice(0, 100);
  if (!events.length) return;
  const task = request(endpoint(lang, "learning/sync/"), "POST", { events })
    .then((data) => {
      const done = new Set(data.accepted.map((e) => e.token));
      const errors = new Map(data.errors.map((e) => [e.token, e]));
      savePreference(
        key,
        readPreference(key, [])
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
    const refresh = () => setQueue(pendingLearning(user, lang));
    const flush = () => flushLearning(user, lang);
    const hidden = () => {
      if (document.hidden) flush();
    };
    window.addEventListener("learning-sync-change", refresh);
    window.addEventListener("online", flush);
    document.addEventListener("visibilitychange", hidden);
    const timer = setInterval(flush, 15000);
    flush();
    return () => {
      clearInterval(timer);
      window.removeEventListener("learning-sync-change", refresh);
      window.removeEventListener("online", flush);
      document.removeEventListener("visibilitychange", hidden);
      flush();
    };
  }, [user, lang]);
  const errors = queue.filter((e) => e.error);
  return {
    enqueue: (kind, payload) => enqueueLearning(user, lang, kind, payload),
    flush: () => flushLearning(user, lang),
    message: errors.length
      ? `${errors.length} mục chưa lưu: ${errors[0].error}`
      : queue.length
        ? `${queue.length} thay đổi đang chờ đồng bộ`
        : "Đã đồng bộ",
    error: errors.length
      ? errors[0].error
      : queue.some((e) => Date.now() - Date.parse(e.at) > 20000)
        ? "Chưa kết nối được máy chủ. Thay đổi sẽ tự gửi lại."
        : "",
    pending: queue.length,
  };
}
