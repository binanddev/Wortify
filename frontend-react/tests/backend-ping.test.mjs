import test from "node:test";
import assert from "node:assert/strict";
import ping from "../netlify/functions/backend-ping.mjs";

test("scheduled ping is opt-in, uses configured backend and reports failures", async () => {
  const original = { enabled: process.env.BACKEND_PING_ENABLED, origin: process.env.BACKEND_ORIGIN, fetch: globalThis.fetch };
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(String(url), "https://backend.example.com/api/health/check/");
    assert.equal(options.redirect, "error");
    return { ok: true, json: async () => ({ ok: true }) };
  };
  try {
    delete process.env.BACKEND_PING_ENABLED;
    await ping();
    assert.equal(calls, 0);
    process.env.BACKEND_PING_ENABLED = "1";
    process.env.BACKEND_ORIGIN = "https://backend.example.com";
    await ping();
    assert.equal(calls, 1);
    globalThis.fetch = async () => ({ ok: false });
    await assert.rejects(ping(), /health check failed/);
    process.env.BACKEND_ORIGIN = "http://backend.example.com";
    await assert.rejects(ping(), /HTTPS/);
  } finally {
    globalThis.fetch = original.fetch;
    for (const [name, value] of [["BACKEND_PING_ENABLED", original.enabled], ["BACKEND_ORIGIN", original.origin]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
