import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { parsers } from "prettier/plugins/babel";
const vietnamese = /[ĐđĂăÂâÊêÔôƠơƯưẠ-ỹÀÁÃÈÉÌÍÒÓÕÙÚÝàáãèéìíòóõùúý]/;
// Learning examples and a legacy sync receipt are data, not interface labels.
const allowed = new Set([
  "xin chào",
  "Translate: xin chào",
  "QUESTION: cat\nANSWER: mèo\nQUESTION: dog\nANSWER: chó",
  "Nội dung không còn truy cập được.",
]);
test("Interface copy stays English while multilingual learning examples remain intact", async () => {
  const failures = [];
  function walk(node, file) {
    if (!node || typeof node !== "object") return;
    if (["StringLiteral", "JSXText", "TemplateElement"].includes(node.type)) {
      const value =
        node.type === "TemplateElement" ? node.value.raw : node.value;
      if (vietnamese.test(value) && !allowed.has(value.trim()))
        failures.push(file + ": " + value.trim());
    }
    for (const [key, value] of Object.entries(node)) {
      if (["loc", "extra", "comments"].includes(key)) continue;
      if (Array.isArray(value)) value.forEach((v) => walk(v, file));
      else if (value && typeof value === "object") walk(value, file);
    }
  }
  async function scan(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await scan(file);
      else if (/\.(js|jsx)$/.test(file))
        walk(
          parsers.babel.parse(await fs.readFile(file, "utf8"), {
            filepath: file,
          }),
          file,
        );
    }
  }
  await scan(
    new URL("../src", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"),
  );
  assert.deepEqual(failures, []);
  const html = await fs.readFile(
    new URL("../index.html", import.meta.url),
    "utf8",
  );
  assert.match(html, /lang="en"/);
});
