import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import postcss from "postcss";
test("Windows libraries are scoped, valid and do not inject global fonts or resets", async () => {
  const css = await fs.readFile(
    new URL("../src/vendor/windows-libraries.css", import.meta.url),
    "utf8",
  );
  const ast = postcss.parse(css);
  ast.walkRules((rule) => {
    for (const selector of rule.selectors) {
      assert.ok(
        selector.startsWith(':root[data-interface="xp"] body '),
        selector,
      );
      assert.doesNotMatch(selector, /\)-[a-z]/);
    }
  });
  ast.walkAtRules((rule) =>
    assert.ok(!["import", "font-face"].includes(rule.name)),
  );
  assert.match(css, /fieldset/);
  assert.match(css, /win-title-bar/);
  assert.match(css, /sunken-panel/);
  assert.doesNotMatch(css, /url\(["']?https?:/);
});
