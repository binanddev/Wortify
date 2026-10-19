import { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
import { request, invalidateContentCache } from "./request.js";
export const WindowContext = createContext(null);
export function useNavigate() { return useContext(WindowContext)?.navigate || navigate; }
export function useWindowActive() { return useContext(WindowContext)?.active ?? true; }
export { request, primeContentCache, clearContentCache } from "./request.js";
export const endpoint = (lang, path) => {
  if (!["en", "de"].includes(lang)) throw new Error("Invalid workspace");
  return `/api/${lang}/${path}`;
};
export function useResource(path, keepDataOnReload = false) {
  const [state, set] = useState({ data: null, error: "", loading: true });
  const [version, bump] = useState(0);
  useEffect(() => {
    if (!path) { set({data:null,error:"",loading:false}); return; }
    const c = new AbortController();
    set((prev) =>
      keepDataOnReload && prev.path === path && prev.data
        ? { ...prev, error: "", loading: false }
        : { path, data: null, error: "", loading: true },
    );
    request(path, "GET", undefined, c.signal)
      .then((data) => {
        if (!c.signal.aborted) set({ path, data, error: "", loading: false });
      })
      .catch((e) => {
        if (!c.signal.aborted && e.name !== "AbortError")
          set({ path, data: null, error: e.message, loading: false });
      });
    return () => c.abort();
  }, [path, version, keepDataOnReload]);
  const reload = useCallback(() => {
    invalidateContentCache(path);
    bump((v) => v + 1);
  }, [path]);
  return {
    ...(state.path === path ? state : { data: null, error: "", loading: true }),
    reload,
  };
}
export function useAction() {
  const guard = useRef(false),
    alive = useRef(true),
    controller = useRef(new AbortController());
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    alive.current = true;
    controller.current = new AbortController();
    return () => {
      alive.current = false;
      controller.current.abort();
    };
  }, []);
  const run = useCallback(async (fn) => {
    if (guard.current) return;
    guard.current = true;
    setPending(true);
    setError("");
    try {
      return await fn(controller.current.signal);
    } catch (e) {
      if (alive.current && e.name !== "AbortError") setError(e.message);
    } finally {
      guard.current = false;
      if (alive.current) setPending(false);
    }
  }, []);
  return { pending, error, setError, run };
}
export function navigate(path) {
  history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
export function useRoute() {
  const scope = useContext(WindowContext);
  const [path, set] = useState(location.pathname + location.search);
  useEffect(() => {
    const cb = () => set(location.pathname + location.search);
    window.addEventListener("popstate", cb);
    return () => window.removeEventListener("popstate", cb);
  }, []);
  return scope?.route ?? path;
}
const volatilePreferences = new Map();
export function readPreference(key, fallback) {
  if (volatilePreferences.has(key))
    return structuredClone(volatilePreferences.get(key));
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
export function savePreference(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    volatilePreferences.delete(key);
  } catch {
    volatilePreferences.set(key, structuredClone(value));
  }
}
export function shuffled(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
