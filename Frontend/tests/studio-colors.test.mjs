import test from "node:test";
import assert from "node:assert/strict";
import {
  studioPalette,
  studioColor,
  colorContrast,
} from "../src/themes/studio/colors.js";
import {
  updateAppearance,
  restoreAppearance,
} from "../src/themes/preferences.js";
import { applyAppearance } from "../src/themes/apply.js";
test("Studio defaults and malformed colors resolve safely", () => {
  assert.equal(studioColor({}, "studioNavColor"), "#294b40");
  for (const bad of [null, true, "red", "url(x)", "#fff", "#12345678"])
    assert.equal(
      studioColor({ studioNavColor: bad }, "studioNavColor"),
      "#294b40",
    );
});
test("Light, dark and saturated palettes keep navigation and primary text readable", () => {
  for (const color of [
    "#ffffff",
    "#000000",
    "#ffdd00",
    "#ed00ff",
    "#444444",
    "#11ccee",
    "#f5faf6",
  ]) {
    const p = studioPalette({
      studioPageColor: color,
      studioNavColor: color,
      studioAccentColor: color,
    });
    for (const [background, text] of [
      ["nav", "nav-ink"],
      ["nav-surface", "nav-ink"],
      ["nav-hover", "nav-ink"],
      ["nav-active", "nav-active-ink"],
      ["accent", "accent-ink"],
      ["accent-hover", "accent-ink"],
      ["accent-soft", "accent-strong"],
    ])
      assert.ok(
        colorContrast(p["--studio-" + background], p["--studio-" + text]) >=
          4.5,
        `${color} ${background}`,
      );
  }
});
test("Studio colors survive reload and isolate old profiles without color settings", () => {
  let p = {
    interface: "studio",
    background: "mist",
    studioNavColor: "#123456",
    studioPageColor: "#abcdef",
    appearanceProfiles: { "default:studio:paper": { textSize: 18 } },
  };
  p = updateAppearance(p, { ...p, interface: "glass" });
  assert.equal(p.studioNavColor, "auto");
  p = updateAppearance(p, { ...p, interface: "studio" });
  assert.equal(p.studioNavColor, "#123456");
  assert.equal(
    restoreAppearance(JSON.parse(JSON.stringify(p))).studioPageColor,
    "#abcdef",
  );
  p = updateAppearance(p, { ...p, background: "paper" });
  assert.equal(p.studioNavColor, "auto");
});
test("Applying another theme or account clears custom Studio values", () => {
  const previous = globalThis.document,
    values = new Map();
  globalThis.document = {
    documentElement: {
      dataset: {},
      style: { setProperty: (key, value) => values.set(key, value) },
    },
  };
  try {
    applyAppearance({ interface: "studio", studioNavColor: "#123456" });
    assert.equal(values.get("--studio-nav"), "#123456");
    applyAppearance({ interface: "glass" });
    assert.equal(values.get("--studio-nav"), "");
    applyAppearance({ interface: "studio" });
    assert.equal(values.get("--studio-nav"), "#294b40");
  } finally {
    globalThis.document = previous;
  }
});
