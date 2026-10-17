// Shared transport and bounded cache. Each consumer owns its cancellation.
const cache = new Map();
const flights = new Map();
const MAX_ENTRIES = 30;
const TTL = 600000;
let generation = 0;
const aborted = () => new DOMException("Aborted", "AbortError");
function put(path, data) {
  cache.delete(path);
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(path, { at: Date.now(), data: structuredClone(data) });
}
export function invalidateContentCache(path) {
  generation++;
  flights.clear();
  if (path) cache.delete(path);
  else cache.clear();
}
export function clearContentCache() {
  invalidateContentCache();
}
export function primeContentCache(path, data) {
  invalidateContentCache(path);
  put(path, data);
}
function invalidateMutation(path) {
  generation++;
  flights.clear();
  if (path.endsWith("/learning/sync/")) {
    for (const key of cache.keys()) {
      if (
        /\/decks\//.test(key) ||
        key.includes("/practice-hub/") ||
        key.includes("/study-pack/") ||
        key.includes("/sessions/")
      )
        cache.delete(key);
    }
  } else cache.clear();
}
async function transport(path, method, data, signal) {
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
    if (error.name === "AbortError" || signal?.aborted) throw aborted();
    malformed = true;
    return {
      error:
        res.status === 403
          ? "Your security session has changed. Reload the page and try again."
          : "The server returned an invalid response.",
    };
  });
  if (signal?.aborted) throw aborted();
  if (!res.ok || malformed) {
    if (res.status === 401) {
      clearContentCache();
      window.dispatchEvent(new Event("session-expired"));
    }
    throw new Error(
      json.error || "Unable to complete the request. Please try again.",
    );
  }
  return json;
}
function subscribe(flight, signal) {
  flight.users++;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", cancel);
      flight.users--;
      if (!flight.users && !flight.done) flight.controller.abort();
      callback(value);
    };
    const cancel = () => finish(reject, aborted());
    signal?.addEventListener("abort", cancel, { once: true });
    flight.promise.then(
      (data) => finish(resolve, structuredClone(data)),
      (error) => finish(reject, error),
    );
    if (signal?.aborted) cancel();
  });
}
export async function request(path, method = "GET", data, signal) {
  if (signal?.aborted) throw aborted();
  const cacheable =
    method === "GET" &&
    /\/api\/(en|de)\/(practice-hub|decks|sessions|study-pack)\//.test(path);
  if (!cacheable) {
    if (method !== "GET") invalidateMutation(path);
    const startedGeneration = generation;
    let json;
    try {
      json = await transport(path, method, data, signal);
    } finally {
      if (method !== "GET") invalidateMutation(path);
    }
    // Reuse a newly created session without an immediate duplicate GET.
    if (
      method === "POST" &&
      /\/sessions\/$/.test(path) &&
      json.token &&
      generation === startedGeneration + 1
    ) {
      put(`${path}${json.token}/`, json);
    }
    return json;
  }
  const cached = cache.get(path);
  if (cached && Date.now() - cached.at < TTL)
    return structuredClone(cached.data);
  cache.delete(path);
  let flight = flights.get(path);
  if (!flight || flight.controller.signal.aborted) {
    const startedGeneration = generation;
    flight = { controller: new AbortController(), users: 0, done: false };
    const current = flight;
    current.promise = transport(path, method, data, current.controller.signal)
      .then((json) => {
        if (
          generation === startedGeneration &&
          !current.controller.signal.aborted
        )
          put(path, json);
        return json;
      })
      .finally(() => {
        current.done = true;
        if (flights.get(path) === current) flights.delete(path);
      });
    flights.set(path, current);
  }
  return subscribe(flight, signal);
}
