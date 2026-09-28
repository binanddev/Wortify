import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_MEDIA_BYTES,
  validateMediaSelection,
} from "../src/exercise-media-utils.js";
test("optional media supports images and MP3 up to 200 MB combined", () => {
  assert.doesNotThrow(() => validateMediaSelection([], []));
  assert.doesNotThrow(() =>
    validateMediaSelection([], [{ name: "track.MP3", size: MAX_MEDIA_BYTES }]),
  );
  assert.doesNotThrow(() =>
    validateMediaSelection(
      [{ size: 100 }],
      [{ name: "picture.webp", size: 100 }],
    ),
  );
  assert.throws(() =>
    validateMediaSelection(
      [{ size: 100 }],
      [{ name: "picture.png", size: MAX_MEDIA_BYTES }],
    ),
  );
  assert.throws(() =>
    validateMediaSelection([], [{ name: "script.svg", size: 100 }]),
  );
  assert.throws(() =>
    validateMediaSelection([], [{ name: "empty.mp3", size: 0 }]),
  );
  assert.throws(() =>
    validateMediaSelection(
      Array.from({ length: 20 }, () => ({ size: 1 })),
      [{ name: "extra.jpg", size: 1 }],
    ),
  );
});
