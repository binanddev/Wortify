import test from "node:test";
import assert from "node:assert/strict";
import postcss from "postcss";
import { compileDesign } from "../scripts/design-system.mjs";
import { navScale, navWidth } from "../src/components/navigation/navigation-settings.js";

test("navigation scales both below and above its original size within bounds", () => {
  assert.equal(navWidth(50), 211);
  assert.equal(navWidth(100), 422);
  assert.equal(navWidth(150), 633);
  assert.equal(navScale(100.25), 100.25);
  assert.equal(navScale(-1), 50);
  assert.equal(navScale(999), 150);
  assert.equal(navScale("invalid"), 100);
  assert.equal(navScale(Infinity), 100);
});

test("compiled mobile navigation opens, fits the viewport and reserves space for its controls", async () => {
  const ast = postcss.parse(await compileDesign());
  const values = (selector, property, mobile = false) => {
    const result = [];
    ast.walkRules(selector, (rule) => {
      const isMobile =
        rule.parent.type === "atrule" &&
        rule.parent.params.includes("max-width: 1024px");
      if (mobile !== isMobile) return;
      rule.walkDecls(property, (decl) => result.push(decl.value));
    });
    return result;
  };
  assert.equal(values(".mobile-nav-bar", "display", true).at(-1), "flex");
  assert.equal(values(".nav-flip.open", "visibility", true).at(-1), "visible");
  assert.equal(values(".main-shell", "margin-left", true).at(-1), "0");
  assert.match(values(".main-shell", "padding-top", true).at(-1), /64px/);
  assert.match(
    values(".nav-flip", "width", true).at(-1),
    /min\(var\(--nav-width.*100vw/,
  );
  assert.equal(values(".nav-flip-inner", "scale").at(-1), "1");
  assert.ok(
    Number(values("#modal-root", "z-index").at(-1)) >
      Number(values(".nav-flip", "z-index").at(-1)),
  );
  assert.equal(values("#modal-root", "isolation").at(-1), "isolate");
  assert.equal(values("#modal-root", "pointer-events").at(-1), "none");
  assert.equal(
    values("#modal-root .app-modal-body", "overflow-y").at(-1),
    "auto",
  );
  assert.match(values("#modal-root .app-modal", "max-height").at(-1), /100dvh/);
  assert.match(values("#modal-root .app-modal", "width").at(-1), /100vw/);
  // Preserve the requested dialog size while bounding it to the viewport.
  assert.equal(values("#modal-root .app-modal", "max-width").length, 0);
});
