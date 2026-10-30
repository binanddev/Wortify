import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createPdfDocumentCache } from "../src/features/teaching/pdf-document-cache.js";
import { drawPaper, drawStroke } from "../src/features/teaching/board-model.js";
import { PDFDocument, rgb, degrees } from "pdf-lib";
const source = await readFile(
  new URL("../src/features/teaching/pdf.js", import.meta.url),
  "utf8",
);
test("PDF export contains every page, imported backgrounds and visible annotations in order", async (t) => {
  let native;
  try {
    native = await import("@napi-rs/canvas");
  } catch {
    t.skip("Optional native canvas is unavailable");
    return;
  }
  globalThis.DOMMatrix ||= native.DOMMatrix;
  globalThis.Path2D ||= native.Path2D;
  globalThis.ImageData ||= native.ImageData;
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const fixture = await PDFDocument.create(),
    page = fixture.addPage([400, 600]);
  page.drawRectangle({
    x: 0,
    y: 0,
    width: 400,
    height: 600,
    color: rgb(0.2, 0.4, 0.8),
  });
  page.setRotation(degrees(90));
  const bytes = await fixture.save();
  let result;
  const document = {
    createElement(kind) {
      if (kind === "a") return { click() {} };
      const canvas = native.createCanvas(1, 1);
      canvas.toBlob = (callback) =>
        callback(new Blob([canvas.toBuffer("image/png")]));
      return canvas;
    },
  };
  const exporter = new Function(
    "drawPaper",
    "drawStroke",
    "pdfLibrary",
    "document",
    "URL",
    "Blob",
    "setTimeout",
    "loadPDFLib",
    "createPdfDocumentCache",
    source
      .slice(source.indexOf("export async function exportLesson"))
      .replace("export async function", "async function")
      .replace(/await import\(["\']pdf-lib["\']\)/, "await loadPDFLib()") +
      ";return exportLesson;",
  );
  const run = exporter(
    drawPaper,
    drawStroke,
    async () => ({
      getDocument: () =>
        pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }),
    }),
    document,
    {
      createObjectURL(blob) {
        result = blob;
        return "memory:download";
      },
      revokeObjectURL() {},
    },
    Blob,
    (fn, delay) => {
      if (!delay) fn();
    },
    async () => ({ PDFDocument }),
    createPdfDocumentCache,
  );
  const state = {
    pages: [
      { id: "blank", width: 400, height: 300, paper: "grid" },
      {
        id: "pdf",
        width: 600,
        height: 400,
        paper: "plain",
        pdf: "asset",
        pdfPage: 1,
      },
    ],
    strokes: {
      s: {
        id: "s",
        page: "pdf",
        tool: "pen",
        width: 10,
        color: "#ff0000",
        visible: true,
        points: [
          [20, 20],
          [100, 20],
        ],
      },
      hidden: {
        id: "hidden",
        page: "pdf",
        tool: "pen",
        width: 20,
        color: "#00ff00",
        visible: false,
        points: [
          [20, 100],
          [100, 100],
        ],
      },
    },
  };
  await run(
    state,
    (id) => `memory:${id}`,
    "Unterricht · Test",
    () => {},
  );
  assert.equal(result.type, "application/pdf");
  const raw = new Uint8Array(await result.arrayBuffer());
  const exported = await PDFDocument.load(raw);
  assert.equal(exported.getPageCount(), 2);
  assert.deepEqual(exported.getPage(1).getSize(), { width: 600, height: 400 });
  assert.equal(exported.getTitle(), "Unterricht · Test");
  const rendered = await pdfjs.getDocument({
    data: raw,
    isEvalSupported: false,
  }).promise;
  const sheet = await rendered.getPage(2),
    canvas = native.createCanvas(600, 400),
    ctx = canvas.getContext("2d");
  await sheet.render({
    canvasContext: ctx,
    viewport: sheet.getViewport({ scale: 1 }),
  }).promise;
  const ink = ctx.getImageData(50, 20, 1, 1).data;
  assert.ok(
    ink[0] > 200 && ink[1] < 60 && ink[2] < 60,
    "red ink appears in correct location over rotated PDF",
  );
  const background = ctx.getImageData(50, 100, 1, 1).data;
  assert.ok(
    background[2] > 150 && background[1] < 150,
    "PDF background remains and hidden green stroke is absent",
  );
  await rendered.destroy();
});
