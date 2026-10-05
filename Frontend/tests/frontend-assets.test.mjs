import test from "node:test";
import assert from "node:assert/strict";
import { frontendAssetPath, frontendAssetAliases } from "../scripts/frontend-assets.mjs";
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

test("dev and preview install middleware without returning Connect as a Vite post-hook", () => {
  for (const name of ["configureServer", "configurePreviewServer"]) {
    let middleware;
    const connect = () => { throw new Error("Connect must only receive HTTP requests"); };
    const server = {middlewares:{use(handler){middleware=handler;return connect;}}};
    assert.equal(frontendAssetAliases()[name](server), undefined);
    const request = {url:"/static/react/audio/tone.wav"};
    let called = 0;
    middleware(request, {}, () => called++);
    assert.equal(request.url,"/audio/tone.wav");
    assert.equal(called,1);
  }
});
