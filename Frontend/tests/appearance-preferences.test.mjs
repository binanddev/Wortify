import test from "node:test";
import assert from "node:assert/strict";
import { applyAppearance } from "../src/appearance-preferences.js";

test("appearance clamps values, keeps glass visible at 100%, and clears another account color", () => {
  const values = new Map();
  const previous = globalThis.document;
  globalThis.document = {
    documentElement: {
      dataset: {},
      style: { setProperty: (key, value) => values.set(key, value) },
    },
  };
  try {
    applyAppearance({
      transparency: 100,
      textColor: "#ab12cd",
      textWeight: 900,
      textContrast: 100,
    });
    assert.equal(values.get("--glass-alpha"), "0.04");
    assert.equal(values.get("--text-weight"), "700");
    assert.match(values.get("--ink"), /#ab12cd/);
    applyAppearance({ interface: "glass", background: "night" });
    assert.equal(values.get("--glass-alpha"), "0.75");
    assert.match(values.get("--ink"), /#f0f5ff/);
    assert.equal(values.get("--text-weight"), "500");
  } finally {
    globalThis.document = previous;
  }
});

test("Studio is the default and switching interfaces clears the previous mode", () => {
  const previous = globalThis.document;
  const values = new Map(),
    dataset = {};
  globalThis.document = {
    documentElement: {
      dataset,
      style: { setProperty: (key, value) => values.set(key, value) },
    },
  };
  try {
    applyAppearance();
    assert.equal(dataset.interface, "studio");
    applyAppearance({
      interface: "glass",
      background: "night",
      transparency: 100,
    });
    assert.equal(dataset.interface, "glass");
    assert.match(values.get("--ink"), /#f0f5ff/);
    applyAppearance({ interface: "studio", background: "night" });
    assert.equal(dataset.interface, "studio");
    assert.match(values.get("--ink"), /#24304e/);
    applyAppearance({ interface: "unknown" });
    assert.equal(dataset.interface, "studio");
  } finally {
    globalThis.document = previous;
  }
});
