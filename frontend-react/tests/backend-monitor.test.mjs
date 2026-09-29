import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMonitor, INTERVAL_MS } from "../scripts/backend-monitor.mjs";
test("frontend server probes on a ten-minute schedule without user cookies and reports with its own key", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wortify-monitor-"));
  const calls = [];
  const monitor = createMonitor({
    origin: "http://backend:8000",
    secret: "private-key",
    host: "learn.example.com",
    stateFile: join(dir, "queue.json"),
    log: () => {},
    fetcher: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    },
  });
  try {
    assert.equal(INTERVAL_MS, 600000);
    await monitor.tick();
    assert.equal(calls[0].url, "http://backend:8000/api/health/check/");
    assert.equal(calls[0].options.headers.Host, "learn.example.com");
    assert.equal(
      calls[1].options.headers["X-Wortify-Monitor-Key"],
      "private-key",
    );
    assert.equal(calls[1].options.headers.Cookie, undefined);
    const report = JSON.parse(calls[1].options.body).checks[0];
    assert.equal(report.ok, true);
    assert.equal(report.user, undefined);
    assert.deepEqual(
      JSON.parse(await readFile(join(dir, "queue.json"), "utf8")),
      [],
    );
  } finally {
    monitor.stop();
    await rm(dir, { recursive: true, force: true });
  }
});
test("failed probes survive frontend monitor restarts and are sent when backend recovers", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wortify-monitor-")),
    stateFile = join(dir, "queue.json");
  let first, second;
  try {
    first = createMonitor({
      origin: "http://backend",
      secret: "key",
      stateFile,
      log: () => {},
      fetcher: async () => {
        throw new Error("offline");
      },
    });
    await first.tick();
    first.stop();
    const saved = JSON.parse(await readFile(stateFile, "utf8"));
    assert.equal(saved[0].error, "network");
    let checks;
    second = createMonitor({
      origin: "http://backend",
      secret: "key",
      stateFile,
      log: () => {},
      fetcher: async (url, options) => {
        if (url.endsWith("/api/monitor/"))
          checks = JSON.parse(options.body).checks;
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      },
    });
    await second.tick();
    assert.equal(checks.length, 2);
    assert.equal(checks[0].token, saved[0].token);
    assert.equal(checks[1].ok, true);
  } finally {
    first?.stop();
    second?.stop();
    await rm(dir, { recursive: true, force: true });
  }
});
