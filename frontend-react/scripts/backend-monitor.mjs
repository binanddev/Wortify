import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
export const INTERVAL_MS = 10 * 60 * 1000;
export function createMonitor({
  origin,
  secret,
  host,
  stateFile,
  fetcher = fetch,
  now = Date.now,
  log = console.log,
}) {
  if (!origin || !secret)
    throw new Error(
      "Server monitoring requires backend origin and BACKEND_MONITOR_SECRET.",
    );
  const base = origin.replace(/\/$/, "");
  let timer,
    busy = false,
    stopped = false,
    pending = [],
    active;
  const headers = {
    "X-Forwarded-Proto": "https",
    ...(host ? { Host: host } : {}),
  };
  const load = readFile(stateFile, "utf8")
    .then((text) => {
      const rows = JSON.parse(text);
      pending = Array.isArray(rows)
        ? rows
            .filter(
              (r) =>
                typeof r.token === "string" &&
                Number.isFinite(Date.parse(r.at)),
            )
            .slice(-1008)
        : [];
    })
    .catch(() => {});
  const persist = async () => {
    await mkdir(dirname(stateFile), { recursive: true });
    await writeFile(`${stateFile}.tmp`, JSON.stringify(pending), {
      mode: 0o600,
    });
    await rename(`${stateFile}.tmp`, stateFile);
  };
  async function call(path, options = {}) {
    active = new AbortController();
    const timeout = setTimeout(() => active?.abort(), 15000);
    try {
      const response = await fetcher(`${base}${path}`, {
        ...options,
        signal: active.signal,
        headers: { ...headers, ...options.headers },
      });
      const data = await response.json();
      return { ok: response.ok, status: response.status, data };
    } finally {
      clearTimeout(timeout);
      active = null;
    }
  }
  async function tick() {
    if (busy || stopped) return;
    busy = true;
    try {
      await load;
      const start = now();
      const check = {
        token: randomUUID(),
        at: new Date(start).toISOString(),
        ok: false,
        latency_ms: 0,
        error: "",
      };
      try {
        const response = await call("/api/health/check/");
        check.ok = response.ok && response.data?.ok === true;
        check.error = check.ok ? "" : response.ok ? "invalid-response" : "http";
      } catch (error) {
        check.error =
          error.name === "AbortError" || error.name === "TimeoutError"
            ? "timeout"
            : error instanceof SyntaxError
              ? "invalid-response"
              : "network";
      }
      if (stopped) return;
      check.latency_ms = Math.max(0, Math.min(60000, now() - start));
      pending = [
        ...pending.filter((r) => now() - Date.parse(r.at) < 7 * 86400000),
        check,
      ].slice(-1008);
      await persist(); // Keep failures on the frontend machine while backend is unavailable.
      log(JSON.stringify({ source: "frontend-server", ...check }));
      while (pending.length && !stopped) {
        const batch = pending.slice(0, 50);
        try {
          const response = await call("/api/monitor/", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Wortify-Monitor-Key": secret,
            },
            body: JSON.stringify({ checks: batch }),
          });
          if (!response.ok || response.data?.ok !== true) {
            log(`Monitor report pending (${response.status}).`);
            break;
          }
          pending = pending.slice(batch.length);
          await persist();
        } catch {
          break;
        }
      }
    } catch {
      log(
        "Monitor could not persist its queue; check the frontend monitor volume.",
      );
    } finally {
      busy = false;
    }
  }
  return {
    tick,
    start() {
      void tick();
      timer = setInterval(tick, INTERVAL_MS);
      timer.unref?.();
    },
    stop() {
      stopped = true;
      clearInterval(timer);
      active?.abort();
    },
  };
}
export function monitorFromEnvironment(env = process.env) {
  return createMonitor({
    origin:
      env.BACKEND_ORIGIN || env.DJANGO_DEV_ORIGIN || "http://127.0.0.1:8000",
    secret:
      env.BACKEND_MONITOR_SECRET ||
      (env.NODE_ENV !== "production" ? "local-monitor-development-only" : ""),
    host: env.PUBLIC_HOST,
    stateFile:
      env.MONITOR_STATE_FILE ||
      resolve(
        fileURLToPath(new URL("../../", import.meta.url)),
        ".development-backups/frontend-monitor.json",
      ),
  });
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const monitor = monitorFromEnvironment();
  monitor.start();
  // CLI process must remain alive even when no browser or other service is running.
  const keepAlive = setInterval(() => {}, INTERVAL_MS);
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      monitor.stop();
      clearInterval(keepAlive);
    });
}
