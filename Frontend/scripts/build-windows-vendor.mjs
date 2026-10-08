import fs from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";
const root = path.resolve(import.meta.dirname, "..");
const out = postcss.root();
out.append(
  postcss.comment({
    text: "Generated scoped adaptation of 98.css and XP.css (MIT). Regenerate with scripts/build-windows-vendor.mjs; no global reset.",
  }),
);
for (const [pkg, file] of [
  ["98.css", "dist/98.css"],
  ["xp.css", "dist/XP.css"],
]) {
  const ast = postcss.parse(
    await fs.readFile(path.join(root, "node_modules", pkg, file), "utf8"),
  );
  ast.walkRules((rule) => {
    const selectors = rule.selectors.filter((s) =>
      pkg === "98.css"
        ? /^(fieldset|legend|table|thead|tbody|th\b|td\b|\.sunken-panel|\.status-bar|ul\.tree-view)/.test(
            s,
          )
        : /^(\.window\b|\.title-bar\b|button(?=[:\s\[]|$))/.test(s),
    );
    if (!selectors.length) return;
    const copy = rule.clone();
    copy.selector = selectors
      .map((s) => {
        if (pkg === "xp.css")
          s = s
            .replace(
              /\.window(?![\w-])/g,
              ':is(.win-window,.glass,.work-paper,.nav-face,.flip-face,[role="dialog"])',
            )
            .replace(/\.title-bar(?![\w-])/g, ":is(.win-title-bar,.nav-static)")
            .replace(
              /^button\b/,
              ":is(.btn,.next-question,.check-action,.exercise-next)",
            );
        return ':root[data-interface="xp"] body ' + s;
      })
      .join(",\n");
    // Retain conditionals; omit bundled fonts in favour of readable system Tahoma.
    let wrapped = copy;
    for (let p = rule.parent; p && p.type !== "root"; p = p.parent) {
      if (p.type === "atrule") {
        const a = p.clone({ nodes: [] });
        a.append(wrapped);
        wrapped = a;
      }
    }
    out.append(wrapped);
  });
}
await fs.writeFile(
  path.join(root, "src/vendor/windows-libraries.css"),
  out.toString(),
);
