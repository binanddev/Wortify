import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";
import { ICON_PATHS } from "../src/components/ui/icon-paths.js";
import { compileDesign } from "../scripts/design-system.mjs";

test("shared icon catalog covers every literal Icon and action icon in the app", async () => {
  async function visit(directory) {
    for (const item of await fs.readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, item.name);
      if (item.isDirectory()) await visit(file);
      else if (item.name.endsWith(".jsx")) {
        const source = await fs.readFile(file, "utf8");
        for (const match of source.matchAll(
          /(?:<Icon\s+name|\bicon)="([a-z_]+)"/g,
        )) {
          assert.ok(ICON_PATHS[match[1]], `${file}: missing ${match[1]}`);
        }
      }
    }
  }
  await visit(path.resolve(import.meta.dirname, "../src"));
  assert.ok(Object.keys(ICON_PATHS).length >= 40);
});

test("flashcard scene disables filters while preserving 3D flip, and icons use independent ink", async () => {
  const ast = postcss.parse(await compileDesign());
  const rules = [];
  ast.walkRules((rule) => rules.push(rule));
  const scene = rules.find((rule) =>
    rule.selector.includes(":root body button.flip-stage .flip-inner"),
  );
  for (const property of [
    "filter",
    "backdrop-filter",
    "-webkit-backdrop-filter",
  ]) {
    assert.ok(
      scene.nodes.some(
        (d) => d.prop === property && d.value === "none" && d.important,
      ),
    );
  }
  assert.ok(
    rules
      .find((r) => r.selector === ".flip-inner")
      .nodes.some(
        (d) => d.prop === "transform-style" && d.value === "preserve-3d",
      ),
  );
  const icons = rules.find((r) => r.selector === ":root body svg.app-icon");
  assert.ok(
    icons.nodes.some(
      (d) => d.prop === "color" && d.value === "var(--icon-ink)",
    ),
  );
  const material = rules.find((r) =>
    r.selector.includes('[data-interface="studio"]') && r.selector.includes(".glass,"),
  );
  assert.ok(
    material.nodes.some(
      (d) => d.prop === "backdrop-filter" && d.value === "none" && d.important,
    ),
  );
});
