import { t as tr, useLocale } from "../i18n/index.js";
import { useSyncExternalStore } from "react";
import { request } from "../lib/core.js";
export const MAINTENANCE_MESSAGE = "The system is under development";
let state = null;
const listeners = new Set();
export function updateAvailability(value) { state = value; listeners.forEach(fn => fn()); }
async function refresh() { try { updateAvailability(await request("/api/site/features/")); } catch {} }
let timer;
function subscribe(fn) {
  listeners.add(fn);
  if (listeners.size === 1) { refresh(); timer = setInterval(refresh, 15000); window.addEventListener("focus", refresh); }
  return () => { listeners.delete(fn); if (!listeners.size) { clearInterval(timer); window.removeEventListener("focus", refresh); } };
}
export function useAvailability() { return useSyncExternalStore(subscribe, () => state, () => null); }
export function themeEnabled(flags, id) { return id === "studio" || flags?.themes?.[id] === true; }
export function ClassGate({children}) {
  useLocale();
  const flags = useAvailability();
  if (!flags) return <p role="status">{tr("Loading…")}</p>;
  return flags.classes ? children : <p role="status">{tr(MAINTENANCE_MESSAGE)}</p>;
}
