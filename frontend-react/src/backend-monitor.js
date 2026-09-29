import { useEffect } from "react";
import { readPreference, savePreference, request } from "./core";
export const CHECK_INTERVAL = 10 * 60 * 1000;
export function useBackendMonitor(userId) {
  useEffect(() => {
    let stopped = false,
      controller;
    const key = `backend-checks:${userId}`;
    const tick = async () => {
      controller = new AbortController();
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, 15000);
      const start = performance.now();
      const check = {
        token: crypto.randomUUID(),
        at: new Date().toISOString(),
        ok: false,
        error: "",
        latency_ms: 0,
      };
      try {
        const res = await fetch("/api/health/check/", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!res.ok) check.error = "http";
        else {
          const body = await res.json();
          check.ok = body.ok === true;
          if (!check.ok) check.error = "invalid-response";
        }
      } catch {
        check.error = timedOut ? "timeout" : "network";
      } finally {
        clearTimeout(timeout);
      }
      if (stopped) return;
      check.latency_ms = Math.min(60000, Math.round(performance.now() - start));
      if (userId) {
        const stored = readPreference(key, []);
        const queue = [...(Array.isArray(stored) ? stored : []), check]
          .filter(
            (item) => item && Date.now() - Date.parse(item.at) < 7 * 86400000,
          )
          .slice(-50);
        savePreference(key, queue);
        if (check.ok) {
          const uploadTimeout = setTimeout(() => controller.abort(), 15000);
          try {
            await request(
              "/api/monitor/",
              "POST",
              { checks: queue },
              controller.signal,
            );
            if (!stopped) {
              const sent = new Set(queue.map((item) => item.token));
              savePreference(
                key,
                readPreference(key, []).filter((item) => !sent.has(item.token)),
              );
            }
          } catch {
            /* Retry the same tokens on the next successful probe. */
          } finally {
            clearTimeout(uploadTimeout);
          }
        }
      }
    };
    tick();
    const interval = setInterval(tick, CHECK_INTERVAL);
    return () => {
      stopped = true;
      clearInterval(interval);
      controller?.abort();
    };
  }, [userId]);
}
