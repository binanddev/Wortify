import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_MEDIA_BYTES,
  remapQuestionMedia,
  validateMediaSelection,
} from "../src/features/practice/exercise-media-utils.js";
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
      Array.from({ length: 200 }, () => ({ size: 1 })),
      [{ name: "extra.jpg", size: 1 }],
    ),
  );
});

test("media follows moved questions and detached questions return to whole-exercise scope", () => {
  const items = [
    { id: "a", question: "1" },
    { id: "b", question: "2" },
    { id: "c" },
  ];
  const before = [
    { id: "1", prompt: "A" },
    { id: "2", prompt: "B" },
  ];
  assert.deepEqual(
    remapQuestionMedia(items, before, [
      { id: "1", prompt: "B" },
      { id: "2", prompt: "A" },
    ]).map((i) => i.question),
    ["2", "1", undefined],
  );
  assert.equal(
    remapQuestionMedia(items, before, [{ id: "1", prompt: "B" }])[0].question,
    "",
  );
  assert.equal(items[0].question, "1");
});
