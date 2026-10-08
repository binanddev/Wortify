import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";
import {
  fingerprint,
  compileDesign,
  designRoot,
} from "../scripts/design-system.mjs";
for (const name of ["react"]) {
  test(`${name}: compiled Tailwind preserves migrated selectors, cascade families, media states and keyframes`, async () => {
    const expected = JSON.parse(
      await fs.readFile(
        new URL(`./fixtures/${name}-style-baseline.json`, import.meta.url),
        "utf8",
      ),
    );
    assert.deepEqual(fingerprint(await compileDesign()), expected);
  });
}
test("application styling has one entry and uses Tailwind composition outside tokens and keyframes", async () => {
  const styleRoot = path.resolve(designRoot, "..");
  const names = (await fs.readdir(styleRoot, { recursive: true })).filter((name) => /^(design-system|themes)[\\/]/.test(name));
  for (const name of names.filter((n) => n.endsWith(".css"))) {
    const ast = postcss.parse(
      await fs.readFile(path.join(styleRoot, name), "utf8"),
    );
    ast.walkDecls((decl) => {
      if (decl.prop.startsWith("--")) return;
      let parent = decl.parent;
      while (parent) {
        if (parent.type === "atrule" && /keyframes|theme/.test(parent.name))
          return;
        parent = parent.parent;
      }
      assert.fail(
        `${name}: use a Tailwind utility for ${decl.prop} rather than adding another CSS override`,
      );
    });
  }
  const main = await fs.readFile(
    path.resolve(designRoot, "../main.jsx"),
    "utf8",
  );
  assert.match(main, /design-system\/index\.css/);
  for (const old of [
    "styles.css",
    "glass.css",
    "practice-ux.css",
    "profile.css",
  ]) {
    await assert.rejects(fs.access(path.resolve(designRoot, "..", old)));
  }
});
