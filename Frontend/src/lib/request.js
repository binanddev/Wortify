import { configureStaffWorkspace, staffWorkspace, workspaceSection } from "./staff-workspace.js";
const revisions = new Map();
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
  if (!path) {
    generation++;
    flights.clear();
    cache.clear();
    return;
  }
  cache.delete(path);
  const flight = flights.get(path);
  if (flight) flight.invalidated = true;
  flights.delete(path);
}
export function clearContentCache() {
  invalidateContentCache();
}
export function primeContentCache(path, data) {
  invalidateContentCache(path);
  put(path, data);
}
function mutationMatches(path, data) {
  const language = /^\/api\/(en|de)\//.exec(path)?.[1];
  if (!language) return () => true;
  const base = `/api/${language}/`;
  if (path.endsWith('/learning/sync/')) {
    const events = data?.events || [];
    return key => {
      if (!key.startsWith(base)) return false;
      return events.some(({kind, payload = {}}) => {
        if (kind === 'practice_progress' || kind === 'practice')
          return key.startsWith(`${base}practice-hub/nodes/`) &&
            (!/nodes\/\d+\//.test(key) || key.split('?')[0] === `${base}practice-hub/nodes/${payload.node}/`);
        if (kind === 'preferences') return false;
        if (kind === 'study_settings')
          return key.startsWith(`${base}decks/`) || key.startsWith(`${base}study-pack/`);
        if (!['review','test','reset','star','options'].includes(kind)) return false;
        if (key.startsWith(`${base}study-pack/`)) return true;
        if (key.startsWith(`${base}sessions/`)) return ['review','test','reset'].includes(kind);
        if (key.split('?')[0] === `${base}decks/`)
          return ['review','test','reset'].includes(kind);
        return key.startsWith(`${base}decks/${payload.deck}/`);
      });
    };
  }
  const domain = path.slice(base.length).split('/')[0];
  if (['decks','folders'].includes(domain)) {
    const deck = /^decks\/(\d+)\//.exec(path.slice(base.length))?.[1];
    return key => key.startsWith(base) && (
      key.startsWith(`${base}study-pack/`) || key.startsWith(`${base}sessions/`) ||
      key.startsWith(`${base}flashcard/discover/`) ||
      (key.startsWith(`${base}decks/`) && (!deck || key.split('?')[0] === `${base}decks/` || key.startsWith(`${base}decks/${deck}/`)))
    );
  }
  if (['practice-hub','reading'].includes(domain))
    return key => key.startsWith(`${base}${domain}/`);
  return key => key.startsWith(base);
}
function invalidateMutation(path, data, announce = false) {
  const matches = mutationMatches(path, data);
  for (const key of cache.keys()) if (matches(key)) cache.delete(key);
  for (const [key, flight] of flights) if (matches(key)) {
    flight.invalidated = true;
    flights.delete(key);
  }
  if (announce && !path.endsWith('/learning/sync/') && typeof window !== 'undefined' && typeof CustomEvent !== 'undefined')
    window.dispatchEvent(new CustomEvent('content-cache-invalidated', {detail:{matches}}));
}
async function transport(path, method, data, signal) {
  const headers = {};
  const scope = staffWorkspace();
  const section = workspaceSection(path);
  const resource = path.split("?")[0].replace(/(\/decks\/\d+\/).*/, "$1");
  const expected = revisions.get(resource) || revisions.get(section);
  if (scope && /^\/api\/(en|de)\//.test(path)) headers["X-Wortify-Workspace"] = scope;
  if (scope === "shared" && section && method !== "GET" && expected)
    headers["X-Wortify-Revision"] = expected;
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
  if (path === "/api/session/" && "user" in json) {
    revisions.clear();
    clearContentCache();
    configureStaffWorkspace(json.user);
  }
  const revision = res.headers?.get?.("X-Wortify-Revision");
  if (section && revision) {
    if (method !== "GET") {
      for (const key of revisions.keys()) if (key === section || workspaceSection(key) === section) revisions.set(key, revision);
    }
    revisions.set(section, revision);
    revisions.set(resource, revision);
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
    /\/api\/(en|de)\/(practice-hub|decks|sessions|study-pack|reading)\//.test(path);
  if (!cacheable) {
    if (method !== "GET") invalidateMutation(path, data);
    const startedGeneration = generation;
    let json;
    try {
      json = await transport(path, method, data, signal);
    } finally {
      if (method !== "GET") invalidateMutation(path, data, true);
    }
    // Reuse a newly created session without an immediate duplicate GET.
    if (
      method === "POST" &&
      /\/sessions\/$/.test(path) &&
      json.token &&
      generation === startedGeneration
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
          !current.controller.signal.aborted && !current.invalidated
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
