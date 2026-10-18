import { useSyncExternalStore } from "react";
import catalog from "./messages.json" with { type: "json" };
const supported = new Set(["en", "vi", "de"]);
let language = "en";
try {
  const saved = localStorage.getItem("wortify:interface-language");
  if (supported.has(saved)) language = saved;
} catch {
  /* Storage is optional. */
}
const listeners = new Set();
export function getLanguage() {
  return language;
}
export function setLanguage(next) {
  if (!supported.has(next)) return;
  if (typeof document !== "undefined") document.documentElement.lang = next;
  try {
    localStorage.setItem("wortify:interface-language", next);
  } catch {
    /* Keep the in-memory preference. */
  }
  if (next === language) return;
  language = next;
  listeners.forEach((listener) => listener());
}
const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export function useLocale() {
  return useSyncExternalStore(subscribe, getLanguage, () => "en");
}
// Only authored interface copy is passed here. Never translate lesson/user content.
export function t(source, params = {}) {
  if (typeof source !== "string") return source;
  const key = source.replace(/\s+/g, " ").trim();
  const translated =
    language === "en"
      ? catalog[key]?.en || key
      : catalog[key]?.[language] || catalog[key]?.en || key;
  const padded =
    (source.match(/^\s*/)?.[0] || "") +
    translated +
    (source.match(/\s*$/)?.[0] || "");
  return padded.replace(/\{(\w+)\}/g, (match, name) =>
    Object.hasOwn(params, name) ? String(params[name]) : match,
  );
}

export function dateLocale() {
  return { en: "en-GB", vi: "vi-VN", de: "de-DE" }[language];
}
if (typeof document !== "undefined") document.documentElement.lang = language;
