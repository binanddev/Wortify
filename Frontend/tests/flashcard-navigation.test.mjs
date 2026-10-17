import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import postcss from "postcss";
import { compileDesign } from "../scripts/design-system.mjs";

test("flashcard navigation retains layout outside the page (sidebar portals)", async () => {
  const css = postcss.parse(await compileDesign());
  function declarations(selector) {
    const result = {};
    css.walkRules(rule => {
      if (rule.selector.split(",").map(s => s.trim()).includes(selector)) {
        rule.nodes.filter(n => n.type === "decl").forEach(d => { result[d.prop] = d.value; });
      }
    });
    return result;
  }
  assert.equal(declarations(".flash-icon-row").display, "flex");
  assert.equal(declarations(".flash-icon-row")["flex-wrap"], "wrap");
  assert.equal(declarations(".flash-icon-link").display, "inline-flex");
  assert.equal(declarations(".flash-mode-picker").display, "grid");
  assert.match(declarations(".flash-mode-picker")["grid-template-columns"], /repeat\(2,/);
  assert.equal(declarations(".flash-mode-picker button").display, "flex");
  assert.equal(declarations(".flash-mode-picker button")["flex-direction"], "column");
  assert.ok(declarations(".context-panel .flash-icon-row .btn").width);
  assert.equal(declarations(".flash-folder-list").display, "flex");
  assert.equal(declarations(".flash-folder-list .flash-tree-toggle").display, "grid");
  assert.equal(declarations(".flash-settings")["flex-direction"], "column");
  assert.equal(declarations(".flash-library-grid").display, "grid");
});

test("flashcard stylesheet is imported exactly once", async () => {
  const entry = await fs.readFile(new URL("../src/design-system/index.css", import.meta.url), "utf8");
  assert.equal(entry.match(/@import "\.\/flashcard-workspace\.css"/g)?.length, 1);
});
