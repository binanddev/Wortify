import { useCallback, useEffect, useRef, useState } from "react";
export async function request(path, method = "GET", data, signal) {
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
  const json = await res.json().catch(
    () => (
      (malformed = true),
      {
        error:
          res.status === 403
            ? "Phiên bảo mật đã thay đổi. Hãy tải lại trang rồi thử lại."
            : "Máy chủ chưa phản hồi đúng định dạng.",
      }
    ),
  );
  if (!res.ok || malformed) {
    if (res.status === 401) window.dispatchEvent(new Event("session-expired"));
    throw new Error(json.error || "Không thể hoàn tất yêu cầu. Hãy thử lại.");
  }
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
  return { ...state, reload: () => bump((v) => v + 1) };
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
export function readPreference(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
export function savePreference(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Browsers may disable persistence. */
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
