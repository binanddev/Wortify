import { drawPaper, drawStroke } from "./board-model.js";
import { createPdfDocumentCache } from "./pdf-document-cache.js";
let library;
export async function pdfLibrary() {
  if (!library)
    library = import("pdfjs-dist").then(async (pdf) => {
      const { default: worker } = await import(
        "pdfjs-dist/build/pdf.worker.min.mjs?url"
      );
      pdf.GlobalWorkerOptions.workerSrc = worker;
      return pdf;
    });
  return library;
}
export async function exportLesson(state, assetUrl, title, onProgress) {
  const { PDFDocument } = await import("pdf-lib");
  const output = await PDFDocument.create(),
    strokesByPage = new Map();
  for (const stroke of Object.values(state.strokes))
    if (stroke.visible) {
      if (!strokesByPage.has(stroke.page)) strokesByPage.set(stroke.page, []);
      strokesByPage.get(stroke.page).push(stroke);
    }
  const documents = createPdfDocumentCache(async (id) => {
    const pdf = await pdfLibrary();
    return pdf.getDocument({ url: assetUrl(id), isEvalSupported: false });
  });
  try {
    for (let i = 0; i < state.pages.length; i++) {
      const page = state.pages[i];
      onProgress(`${i + 1} / ${state.pages.length}`);
      // Render one page at a time. This handles rotated and cropped PDF pages exactly like the board.
      const canvas = document.createElement("canvas"),
        scale = 1.5;
      canvas.width = Math.ceil(page.width * scale);
      canvas.height = Math.ceil(page.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.scale(scale, scale);
      drawPaper(ctx, page);
      if (page.pdf) {
        const source = await (
            await documents.get(page.pdf)
          ).getPage(page.pdfPage),
          v = source.getViewport({ scale: 1 });
        const viewport = source.getViewport({
          scale: Math.min(page.width / v.width, page.height / v.height),
        });
        await source.render({ canvasContext: ctx, viewport }).promise;
        source.cleanup();
      }
      for (const stroke of strokesByPage.get(page.id) || [])
        drawStroke(ctx, stroke);
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("Unable to render the PDF page.");
      const image = await output.embedPng(await blob.arrayBuffer());
      output.addPage([page.width, page.height]).drawImage(image, {
        x: 0,
        y: 0,
        width: page.width,
        height: page.height,
      });
      canvas.width = canvas.height = 0;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    output.setTitle(title);
    const blob = new Blob([await output.save()], { type: "application/pdf" }),
      url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 100) || "lesson"}.pdf`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } finally {
    await documents.clear();
  }
}
