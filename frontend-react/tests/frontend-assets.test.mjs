import test from "node:test";
import assert from "node:assert/strict";
import { frontendAssetPath } from "../scripts/frontend-assets.mjs";
test("old media links resolve in frontend without redirecting API or admin assets", () => {
  assert.equal(
    frontendAssetPath("/static/react/audio/tone.wav?v=1"),
    "/audio/tone.wav?v=1",
  );
  for (const path of [
    "/api/en/audio/1/",
    "/static/admin/css/base.css",
    "/admin/",
    "/en/create",
    "/assets/app.js",
  ])
    assert.equal(frontendAssetPath(path), path);
});
