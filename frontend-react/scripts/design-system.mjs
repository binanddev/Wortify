import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import postcss from "postcss";
import { compile } from "@tailwindcss/node";
export const designRoot = path.resolve(
  import.meta.dirname,
  "../src/design-system",
);
const normalize = (value) =>
  value
    .replace(/(^|[^\w-])\.(\d)/g, "$10.$2")
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\s+/g, (match) =>
      /^\s+$/.test(match) ? "" : match,
    );
export function propertyFamily(prop) {
  const name = prop.replace(/^-(webkit|moz|ms)-/, "");
  if (
    ["top", "right", "bottom", "left"].includes(name) ||
    name.startsWith("inset")
  )
    return "position-offset";
  if (name === "line-height") return "font";
  if (["row-gap", "column-gap", "gap"].includes(name)) return "gap";
  if (/^(align|justify|place)-/.test(name)) return "alignment";
  return name.split("-")[0];
}
export function fingerprint(css) {
  const groups = new Map();
  postcss.parse(css).walkDecls((decl) => {
    const ancestry = [];
    let node = decl.parent;
    while (node && node.type !== "root") {
      ancestry.unshift(
        node.type === "rule"
          ? node.selector
              .replace(/=([a-zA-Z_][\w-]*)\]/g, '="$1"]')
              .replace(/\s+/g, " ")
              .replace(/\s*([,>+~])\s*/g, "$1")
              .trim()
          : `@${node.name} ${normalize(node.params)}`,
      );
      node = node.parent;
    }
    const family = decl.prop.startsWith("--")
      ? decl.prop
      : propertyFamily(decl.prop);
    const key = ancestry.some((a) => a.startsWith("@keyframes"))
      ? `keyframes:${family}`
      : family;
    const rows = groups.get(key) || [];
    rows.push([
      ancestry,
      decl.prop,
      normalize(decl.value),
      Boolean(decl.important),
    ]);
    groups.set(key, rows);
  });
  return Object.fromEntries(
    [...groups]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([family, rows]) => [
        family,
        {
          count: rows.length,
          sha256: createHash("sha256")
            .update(JSON.stringify(rows))
            .digest("hex"),
        },
      ]),
  );
}
export async function compileDesign() {
  let input = await fs.readFile(path.join(designRoot, "index.css"), "utf8");
  input = input
    .replace('@import "tailwindcss";', '@reference "tailwindcss";')
    .replace(/^@(?:plugin|source|custom-variant).*$/gm, "")
    .replace(/@theme\s*\{[^}]*\}/g, "");
  return (
    await compile(input, { base: designRoot, onDependency: () => {} })
  ).build([]);
}
if (process.argv.includes("--snapshot")) {
  for (const name of ["react"]) {
    const destination = path.resolve(
      import.meta.dirname,
      `../tests/fixtures/${name}-style-baseline.json`,
    );
    await fs.writeFile(
      destination,
      JSON.stringify(fingerprint(await compileDesign()), null, 2) + "\n",
    );
  }
  console.log("Updated style baselines for an intentional design change.");
}
