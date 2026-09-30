import test from "node:test";
import assert from "node:assert/strict";
import { netlifyRedirects } from "../scripts/netlify-routing.mjs";

test("Netlify keeps API upstream paths before the SPA fallback", () => {
  const rules = netlifyRedirects("https://api.example.com/").trim().split("\n");
  assert.ok(rules.includes("/api/* https://api.example.com/api/:splat 200!"));
  assert.ok(rules.includes("/private_media/* /404.html 404!"));
  assert.equal(rules.at(-1), "/* /index.html 200");
  assert.equal(netlifyRedirects("https://new.example.org").includes("api.example.com"), false);
});

test("Netlify rejects missing, insecure and malformed upstream configuration", () => {
  for (const origin of [undefined, "", "http://api.example.com", "https://localhost", "https://api.example.com/api", "https://user:pass@api.example.com", "https://api.example.com?key=secret", "https://api.example.com#x", "https://api.example.com\n/* /bad 200"]) {
    assert.throws(() => netlifyRedirects(origin), /BACKEND_ORIGIN/);
  }
});
