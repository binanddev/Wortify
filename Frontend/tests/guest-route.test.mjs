import test from "node:test";
import assert from "node:assert/strict";
import { guestRoute } from "../src/app/guest-route.js";
test("public browsing and direct study links do not require an account", () => {
  for (const lang of ["de", "en"]) {
    for (const tail of [
      "flashcard",
      "flashcard/discover",
      "explore",
      "practice/all",
      "reading/discover",
    ])
      assert.equal(guestRoute(`/${lang}/${tail}`).needsAccount, false);
    assert.deepEqual(guestRoute(`/${lang}/flashcard/deck/42`), {
      kind: "flashcard",
      lang,
      id: 42,
      needsAccount: false,
    });
    assert.deepEqual(guestRoute(`/${lang}/reading/7`), {
      kind: "reading",
      lang,
      id: 7,
      needsAccount: false,
    });
    assert.deepEqual(guestRoute(`/${lang}/practice/8`), {
      kind: "practice",
      lang,
      id: 8,
      needsAccount: false,
    });
  }
});
test("personal editing, settings and admin routes remain gated", () => {
  for (const path of [
    "/manage",
    "/de/settings",
    "/en/create",
    "/de/reading/4/edit",
    "/en/flashcard/deck/1/edit",
    "/de/classes",
    "/de/flashcard/study",
    "//example.com",
    "/login",
  ])
    assert.equal(guestRoute(path).needsAccount, true, path);
  assert.equal(guestRoute("/").kind, "home");
});

test("only well-formed public lesson links bypass registration", () => {
  const token = "11111111-1111-4111-8111-111111111111";
  assert.deepEqual(guestRoute(`/de/classes/public/${token}`), {
    kind: "teaching-public",
    lang: "de",
    token,
    needsAccount: false,
  });
  for (const path of [
    "/de/classes/public/bad",
    "/de/classes/1",
    "/de/classes/public/11111111-1111-4111-8111-111111111111/edit",
  ])
    assert.equal(guestRoute(path).needsAccount, true);
});
