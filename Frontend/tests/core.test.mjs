import test from "node:test";
import assert from "node:assert/strict";
import { request, endpoint, shuffled, readPreference } from "../src/lib/core.js";
test("namespace rejects missing language and keeps en/de separate", () => {
  assert.equal(endpoint("en", "decks/"), "/api/en/decks/");
  assert.equal(endpoint("de", "decks/"), "/api/de/decks/");
  assert.throws(() => endpoint("../manage", "users/"));
});
test("mutations read the current CSRF cookie after login rotates it", async () => {
  const calls = [];
  globalThis.document = { cookie: "csrftoken=first" };
  globalThis.fetch = async (path, options) => {
    calls.push(options);
    return { ok: true, json: async () => ({ ok: true }) };
  };
  await request("/api/en/decks/", "POST", { title: "Test" });
  document.cookie = "csrftoken=rotated";
  await request("/api/en/decks/", "PATCH", { title: "Updated" });
  assert.equal(calls[0].headers["X-CSRFToken"], "first");
  assert.equal(calls[1].headers["X-CSRFToken"], "rotated");
  assert.equal(calls[1].credentials, "same-origin");
});
test("HTML error responses become readable errors and preserve caller input", async () => {
  const input = { answer: "water" };
  globalThis.fetch = async () => ({
    ok: false,
    status: 403,
    json: async () => {
      throw new Error("HTML");
    },
  });
  await assert.rejects(
    request("/api/en/sessions/test/answer/", "POST", input),
    /security session/,
  );
  assert.deepEqual(input, { answer: "water" });
});
test("shuffling preserves every duplicate instance and leaves original order untouched", () => {
  const cards = [
    { id: 1, text: "same" },
    { id: 2, text: "same" },
    { id: 3, text: "other" },
  ];
  const result = shuffled(cards);
  assert.deepEqual(result.map((c) => c.id).sort(), [1, 2, 3]);
  assert.deepEqual(
    cards.map((c) => c.id),
    [1, 2, 3],
  );
  assert.notEqual(result, cards);
});
test("blocked storage safely uses the default", () => {
  globalThis.localStorage = {
    getItem() {
      throw new Error("blocked");
    },
  };
  assert.equal(readPreference("font", 36), 36);
});

test("cancelling response parsing stays an abort, not a server error", async () => {
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => {
      throw new DOMException("Aborted", "AbortError");
    },
  });
  await assert.rejects(request("/api/en/practice-hub/nodes/987/"), {
    name: "AbortError",
  });
});
