import { useCallback, useEffect, useRef, useState } from "react";
const contentCache = new Map();
export function primeContentCache(path, data) {
  contentCache.set(path, { at: Date.now(), data: structuredClone(data) });
}
export function clearContentCache() {
  contentCache.clear();
}
export async function request(path, method = "GET", data, signal) {
  const cacheable =
    method === "GET" &&
    /\/api\/(en|de)\/(practice-hub|decks|sessions|study-pack)\//.test(path);
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const cached = contentCache.get(path);
  if (cacheable && cached && Date.now() - cached.at < 600000)
    return structuredClone(cached.data);
  const headers = {};
  if (data !== undefined && !(data instanceof FormData))
    headers["Content-Type"] = "application/json";
  if (method !== "GET")
    headers["X-CSRFToken"] = decodeURIComponent(
      document.cookie
        .split("; ")
        .find((c) => c.startsWith("csrftoken="))
        ?.slice(10) || "",
    );
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers,
    body:
      data === undefined
        ? undefined
        : data instanceof FormData
          ? data
          : JSON.stringify(data),
    signal,
  });
  let malformed = false;
  const json = await res.json().catch((error) => {
    if (error.name === "AbortError" || signal?.aborted)
      throw new DOMException("Aborted", "AbortError");
    malformed = true;
    return {
      error:
        res.status === 403
          ? "Phiên bảo mật đã thay đổi. Hãy tải lại trang rồi thử lại."
          : "Máy chủ chưa phản hồi đúng định dạng.",
    };
  });
  if (!res.ok || malformed) {
    if (res.status === 401) window.dispatchEvent(new Event("session-expired"));
    throw new Error(json.error || "Không thể hoàn tất yêu cầu. Hãy thử lại.");
  }
  if (method !== "GET" && !path.endsWith("/learning/sync/"))
    contentCache.clear();
  if (path.endsWith("/learning/sync/"))
    for (const key of contentCache.keys())
      if (/\/decks\/\d+\/$/.test(key) || key.includes("/practice-hub/")) contentCache.delete(key);
  if (cacheable) {
    if (contentCache.size >= 30)
      contentCache.delete(contentCache.keys().next().value);
    contentCache.set(path, { at: Date.now(), data: structuredClone(json) });
  }
  if (method === "POST" && /\/sessions\/$/.test(path) && json.token)
    contentCache.set(`${path}${json.token}/`, {
      at: Date.now(),
      data: structuredClone(json),
    });
  return json;
}
export const endpoint = (lang, path) => {
  if (!["en", "de"].includes(lang)) throw new Error("Không gian không hợp lệ");
  return `/api/${lang}/${path}`;
};
export function useResource(path, keepDataOnReload = false) {
  const [state, set] = useState({ data: null, error: "", loading: true });
  const [version, bump] = useState(0);
  useEffect(() => {
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
        if (e.name !== "AbortError")
          set({ data: null, error: e.message, loading: false });
      });
    return () => c.abort();
  }, [path, version, keepDataOnReload]);
  return {
    ...state,
    reload: () => {
      contentCache.delete(path);
      bump((v) => v + 1);
    },
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
  const [path, set] = useState(location.pathname + location.search);
  useEffect(() => {
    const cb = () => set(location.pathname + location.search);
    window.addEventListener("popstate", cb);
    return () => window.removeEventListener("popstate", cb);
  }, []);
  return path;
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
