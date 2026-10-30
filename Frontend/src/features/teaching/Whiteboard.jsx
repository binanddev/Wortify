import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  PenLine,
  Pencil,
  Highlighter,
  Eraser,
  Minus,
  Square,
  Circle,
  Undo2,
  Redo2,
  Plus,
  Download,
  Upload,
  ChevronLeft,
  ChevronRight,
  X,
  Maximize,
  Minimize,
  Trash2,
  Link2,
  Share2,
  CloudCheck,
  CloudOff,
  LoaderCircle,
  Presentation,
  FileText,
  MousePointer2,
} from "lucide-react";
import BoardSharing from "./BoardSharing.jsx";
import { request } from "../../lib/core.js";
import { t, useLocale } from "../../i18n/index.js";
import { useBoard } from "./use-board.js";
import { uid, drawPaper, hitsStroke } from "./board-model.js";
import { pdfLibrary, exportLesson } from "./pdf.js";
import { createPdfDocumentCache } from "./pdf-document-cache.js";
import { paintStrokeLayer } from "./stroke-layer.js";
const TOOLS = [
  ["pen", "Pen", PenLine],
  ["pencil", "Pencil", Pencil],
  ["marker", "Highlighter", Highlighter],
  ["eraser", "Stroke eraser", Eraser],
  ["line", "Line", Minus],
  ["rectangle", "Rectangle", Square],
  ["ellipse", "Ellipse", Circle],
];
const COLORS = [
  "#172f43",
  "#2563eb",
  "#dc3545",
  "#159570",
  "#e39816",
  "#9333ea",
  "#ffffff",
];
function ToolButton({ label, children, selected, ...props }) {
  return (
    <button
      type="button"
      title={t(label)}
      aria-label={t(label)}
      aria-pressed={selected}
      className={selected ? "is-selected" : ""}
      {...props}
    >
      {children}
    </button>
  );
}
export default function Whiteboard({
  board,
  base,
  manage,
  onClose,
  publicView = false,
}) {
  useLocale();
  const sync = useBoard(base, manage),
    doc = sync.model.current;
  const [sharingOpen, setSharingOpen] = useState(false);
  const [pageId, setPage] = useState(null),
    [follow, setFollow] = useState(true),
    [tool, setTool] = useState("pen"),
    [color, setColor] = useState(COLORS[0]),
    [width, setWidth] = useState(3),
    [paper, setPaper] = useState("plain"),
    [format, setFormat] = useState("landscape"),
    [zoom, setZoom] = useState(100),
    [error, setError] = useState(""),
    [working, setWorking] = useState(""),
    [confirm, setConfirm] = useState(""),
    [historyVersion, setHistoryVersion] = useState(0),
    [full, setFull] = useState(false),
    [pdfReady, setPdfReady] = useState("");
  const root = useRef(),
    canvas = useRef(),
    overlay = useRef(),
    draftCanvas = useRef(),
    file = useRef(),
    gesture = useRef(null),
    undo = useRef([]),
    redo = useRef([]),
    pdfCache = useRef(null),
    renderJob = useRef(null),
    previewFrame = useRef(0),
    blocked = useRef(false),
    keyHandler = useRef(null);
  const effective = (!manage && follow ? doc?.active : pageId) || doc?.active,
    page = doc?.pages.find((p) => p.id === effective) || doc?.pages[0],
    pageIndex = doc?.pages.indexOf(page) || 0;
  const strokes = useMemo(
    () =>
      doc && page
        ? Object.values(doc.strokes).filter(
            (s) => s.page === page.id && s.visible,
          )
        : [],
    [doc, sync.version, page?.id],
  );
  const locked =
    !doc ||
    !manage ||
    sync.status === "loading" ||
    sync.status === "conflict" ||
    !!working;
  blocked.current = locked;
  const assetUrl = (id) => `${base}pdfs/${id}/`;
  useEffect(() => {
    const previousFocus = document.activeElement;
    root.current?.focus();
    const handler = (e) => keyHandler.current?.(e);
    document.addEventListener("keydown", handler);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = overflow;
      cancelAnimationFrame(previewFrame.current);
      renderJob.current?.cancel();
      pdfCache.current?.clear();
      pdfCache.current = null;
      previousFocus?.focus();
    };
  }, []);
  useEffect(() => {
    if (confirm)
      root.current?.querySelector("[role=alertdialog] button")?.focus();
  }, [confirm]);
  useEffect(() => {
    function changed() {
      setFull(document.fullscreenElement === root.current);
    }
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
  useEffect(() => {
    if (!page || !canvas.current) {
      pdfCache.current?.clear();
      pdfCache.current = null;
      return;
    }
    let cancelled = false;
    const target = canvas.current;
    setPdfReady("");
    renderJob.current?.cancel();
    async function render() {
      const scale = Math.min(2, window.devicePixelRatio || 1),
        ctx = target.getContext("2d");
      // Wait for the old PDF render to release this canvas before resizing it.
      if (renderJob.current) await renderJob.current.promise.catch(() => {});
      if (cancelled) return;
      target.width = Math.ceil(page.width * scale);
      target.height = Math.ceil(page.height * scale);
      ctx.scale(scale, scale);
      if (!page.pdf) {
        pdfCache.current?.clear();
        pdfCache.current = null;
      }
      drawPaper(ctx, page);
      if (page.pdf) {
        try {
          if (!pdfCache.current)
            pdfCache.current = createPdfDocumentCache(async (id) => {
              const lib = await pdfLibrary();
              return lib.getDocument({
                url: assetUrl(id),
                isEvalSupported: false,
              });
            });
          const pdf = await pdfCache.current.get(page.pdf),
            source = await pdf.getPage(page.pdfPage);
          if (cancelled) {
            source.cleanup();
            return;
          }
          const v = source.getViewport({ scale: 1 }),
            viewport = source.getViewport({
              scale: Math.min(page.width / v.width, page.height / v.height),
            });
          const job = source.render({ canvasContext: ctx, viewport });
          renderJob.current = job;
          try {
            await job.promise;
          } finally {
            source.cleanup();
          }
          if (cancelled) return;
          setPdfReady(page.id);
        } catch (e) {
          if (!cancelled && e.name !== "RenderingCancelledException")
            setError(t("Unable to load the PDF. Reopen the lesson to retry."));
        }
      } else setPdfReady(page.id);
    }
    render().catch((e) => {
      if (!cancelled) setError(e.message);
    });
    return () => {
      cancelled = true;
      renderJob.current?.cancel();
    };
  }, [page?.id]);
  useEffect(() => {
    if (!page || !overlay.current) return;
    const scale = Math.min(2, window.devicePixelRatio || 1);
    paintStrokeLayer(overlay.current, page, strokes, {
      scale,
      exclude: gesture.current?.stroke?.id,
    });
  }, [sync.version, page?.id, historyVersion]);
  function schedulePreview() {
    if (previewFrame.current) return;
    previewFrame.current = requestAnimationFrame(() => {
      previewFrame.current = 0;
      const stroke = gesture.current?.stroke;
      if (draftCanvas.current && page)
        paintStrokeLayer(draftCanvas.current, page, stroke ? [stroke] : [], {
          scale: Math.min(2, window.devicePixelRatio || 1),
        });
    });
  }
  function remember(back, forward) {
    undo.current.push({ back, forward });
    if (undo.current.length > 100) undo.current.shift();
    redo.current = [];
    setHistoryVersion((v) => v + 1);
  }
  function changePage(p) {
    finish();
    if (manage) sync.dispatch({ kind: "active", page: p.id });
    else setFollow(false);
    setPage(p.id);
  }
  function point(e, r = overlay.current.getBoundingClientRect()) {
    return [
      Math.round(
        Math.max(
          0,
          Math.min(page.width, ((e.clientX - r.left) * page.width) / r.width),
        ) * 10,
      ) / 10,
      Math.round(
        Math.max(
          0,
          Math.min(page.height, ((e.clientY - r.top) * page.height) / r.height),
        ) * 10,
      ) / 10,
    ];
  }
  function erase(p) {
    const ids = strokes
      .filter((s) => s.visible && hitsStroke(s, p, Math.max(10, width * 2)))
      .map((s) => s.id);
    if (ids.length) {
      const op = { kind: "visibility", page: page.id, ids, visible: false };
      sync.dispatch(op);
      const g = gesture.current;
      for (const id of ids)
        if (!g.erasedIds.has(id)) {
          g.erasedIds.add(id);
          g.erased.push(id);
        }
    }
  }
  function start(e) {
    if (locked || e.button !== 0 || gesture.current) return;
    e.preventDefault();
    overlay.current.setPointerCapture(e.pointerId);
    const p = point(e);
    if (tool === "eraser") {
      gesture.current = {
        pointer: e.pointerId,
        erased: [],
        erasedIds: new Set(),
      };
      erase(p);
      return;
    }
    const stroke = {
      id: uid(),
      page: page.id,
      tool,
      color,
      width: tool === "marker" ? width * 5 : width,
      points: [p],
      visible: true,
    };
    gesture.current = {
      pointer: e.pointerId,
      stroke,
      offset: 0,
      last: performance.now(),
      shape: ["line", "rectangle", "ellipse"].includes(tool),
    };
    schedulePreview();
    if (!gesture.current.shape) flushInk();
  }
  function flushInk() {
    const g = gesture.current;
    if (!g?.stroke || g.shape) return;
    const s = g.stroke,
      pts = s.points.slice(g.offset);
    if (!pts.length) return;
    for (let i = 0; i < pts.length; i += 2048) {
      const part = pts.slice(i, i + 2048);
      sync.dispatch({
        kind: "ink",
        id: s.id,
        page: s.page,
        tool: s.tool,
        color: s.color,
        width: s.width,
        offset: g.offset,
        points: part,
      });
      g.offset += part.length;
    }
    g.last = performance.now();
  }
  function move(e) {
    const g = gesture.current;
    if (!g || e.pointerId !== g.pointer || blocked.current) return;
    e.preventDefault();
    if (g.erased) {
      erase(point(e));
      return;
    }
    const events = e.nativeEvent.getCoalescedEvents?.() || [e],
      rect = overlay.current.getBoundingClientRect();
    for (const event of events) {
      const p = point(event, rect),
        last = g.stroke.points.at(-1);
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.8) continue;
      if (g.shape) g.stroke.points = [g.stroke.points[0], p];
      else g.stroke.points.push(p);
    }
    schedulePreview();
    if (!g.shape && performance.now() - g.last > 80) flushInk();
    if (g.stroke.points.length > 20000) finish();
  }
  function finish() {
    const g = gesture.current;
    if (!g) return;
    cancelAnimationFrame(previewFrame.current);
    previewFrame.current = 0;
    if (draftCanvas.current && page)
      paintStrokeLayer(draftCanvas.current, page, [], {
        scale: Math.min(2, window.devicePixelRatio || 1),
      });
    if (g.erased) {
      if (g.erased.length)
        remember(
          { kind: "visibility", page: page.id, ids: g.erased, visible: true },
          { kind: "visibility", page: page.id, ids: g.erased, visible: false },
        );
    } else {
      const s = g.stroke;
      if (g.shape)
        sync.dispatch({
          kind: "ink",
          id: s.id,
          page: s.page,
          tool: s.tool,
          color: s.color,
          width: s.width,
          offset: 0,
          points: s.points,
        });
      else flushInk();
      remember(
        { kind: "visibility", page: s.page, ids: [s.id], visible: false },
        { kind: "visibility", page: s.page, ids: [s.id], visible: true },
      );
    }
    gesture.current = null;
  }
  function historyMove(from, to, key) {
    finish();
    const item = from.current.pop();
    if (item) {
      sync.dispatch(item[key]);
      to.current.push(item);
      setHistoryVersion((v) => v + 1);
    }
  }
  function clear() {
    finish();
    const ids = strokes.map((s) => s.id);
    if (ids.length) {
      const op = { kind: "visibility", page: page.id, ids, visible: false };
      sync.dispatch(op);
      remember({ ...op, visible: true }, op);
    }
    setConfirm("");
  }
  function addPage() {
    finish();
    const id = uid(),
      [w, h] = format === "portrait" ? [792, 1120] : [1120, 792];
    sync.dispatch({ kind: "page", id, width: w, height: h, paper });
    sync.dispatch({ kind: "active", page: id });
    setPage(id);
  }
  async function importPDF(e) {
    const source = e.target.files?.[0];
    e.target.value = "";
    if (!source) return;
    finish();
    setError("");
    if (source.size > 300 * 1024 * 1024) {
      setError(t("PDF files must not exceed 300 MB."));
      return;
    }
    if (!source.name.toLowerCase().endsWith(".pdf")) {
      setError(t("Choose a PDF file."));
      return;
    }
    setWorking(t("Importing PDF…"));
    try {
      await sync.drain();
      const data = new FormData();
      data.append("file", source);
      const result = await request(`${base}pdfs/`, "POST", data);
      await sync.replace(result);
      setPage(result.state.active);
      undo.current = [];
      redo.current = [];
      setHistoryVersion((v) => v + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      sync.resume();
      setWorking("");
    }
  }
  async function download() {
    finish();
    setWorking(t("Exporting PDF…"));
    setError("");
    try {
      await exportLesson(
        structuredClone(doc),
        assetUrl,
        board.title,
        (progress) => setWorking(`${t("Exporting PDF…")} ${progress}`),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setWorking("");
    }
  }
  function close() {
    if (working) return;
    finish();
    if (sync.pending()) setConfirm("close");
    else onClose();
  }
  keyHandler.current = (e) => {
    if (sharingOpen || e.target.closest?.("#modal-root")) return;
    if (e.key === "Escape") {
      e.preventDefault();
      if (confirm) setConfirm("");
      else close();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !locked) {
      e.preventDefault();
      historyMove(
        e.shiftKey ? redo : undo,
        e.shiftKey ? undo : redo,
        e.shiftKey ? "forward" : "back",
      );
    }
    if (e.key === "Tab") {
      const scope =
          root.current.querySelector("[role=alertdialog]") || root.current,
        items = [
          ...scope.querySelectorAll(
            "button:not(:disabled),input:not(:disabled):not([hidden]),select:not(:disabled)",
          ),
        ].filter((el) => el.getClientRects().length);
      if (!items.length) return;
      const first = items[0],
        last = items.at(-1);
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          !scope.contains(document.activeElement))
      ) {
        e.preventDefault();
        last.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          !scope.contains(document.activeElement))
      ) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  const labels = {
    error: "Unable to connect",
    unavailable: "Lesson access ended",
    loading: "Connecting…",
    saving: "Saving changes…",
    saved: manage
      ? "All changes saved"
      : sync.mode === "live"
        ? "Live · following the classroom"
        : "Updates every 10 seconds",
    offline: "Connection lost · retrying",
    conflict: "Sync paused · keep your draft",
  };
  return createPortal(
    <div className="wb-backdrop">
      <section
        className="wb-studio"
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-label={board.title}
        tabIndex={-1}
      >
        <header className="wb-header">
          <div className="wb-brand">
            <Presentation size={23} />
            <div>
              <small>{t("TEACHING STUDIO")}</small>
              <h2>{board.title}</h2>
            </div>
          </div>
          <span className={`wb-connection wb-${sync.status}`} role="status">
            {sync.status === "saved" ? (
              <CloudCheck size={16} />
            ) : sync.status === "offline" || sync.status === "conflict" ? (
              <CloudOff size={16} />
            ) : (
              <LoaderCircle size={16} />
            )}{" "}
            {t(labels[sync.status])}
          </span>
          <div className="wb-header-actions">
            {manage && (
              <ToolButton
                label="Lesson sharing"
                disabled={!!working}
                onClick={async () => {
                  finish();
                  if (document.fullscreenElement)
                    await document.exitFullscreen();
                  setSharingOpen(true);
                }}
              >
                <Share2 size={18} />
              </ToolButton>
            )}
            <button disabled={!doc || !!working} onClick={download}>
              <Download size={17} />
              <span>{t("Export PDF")}</span>
            </button>
            <ToolButton
              label="Copy lesson link"
              onClick={async () => {
                try {
                  const parts = base.split("/");
                  await navigator.clipboard.writeText(
                    publicView
                      ? `${location.origin}${location.pathname}`
                      : `${location.origin}/${parts[2]}/classes/${parts[4]}?lesson=${board.id}`,
                  );
                  setError(
                    t(
                      publicView
                        ? "Public lesson link copied."
                        : "Lesson link copied. Only class members can open it.",
                    ),
                  );
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              <Link2 size={18} />
            </ToolButton>
            <ToolButton
              label="Fullscreen"
              onClick={async () => {
                try {
                  if (document.fullscreenElement)
                    await document.exitFullscreen();
                  else await root.current.requestFullscreen();
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              {full ? <Minimize size={18} /> : <Maximize size={18} />}
            </ToolButton>
            <ToolButton
              label="Close board"
              disabled={!!working}
              onClick={close}
            >
              <X size={20} />
            </ToolButton>
          </div>
        </header>
        {manage ? (
          <div
            className="wb-toolbar"
            role="toolbar"
            aria-label={t("Drawing tools")}
          >
            <div className="wb-tool-group">
              {TOOLS.map(([key, label, Glyph]) => (
                <ToolButton
                  key={key}
                  label={label}
                  selected={tool === key}
                  disabled={locked}
                  onClick={() => {
                    finish();
                    setTool(key);
                  }}
                >
                  <Glyph size={19} />
                </ToolButton>
              ))}
            </div>
            <div className="wb-tool-group wb-colors">
              {COLORS.map((c) => (
                <button
                  key={c}
                  title={c}
                  aria-label={`${t("Ink color")} ${c}`}
                  aria-pressed={color === c}
                  className={color === c ? "is-selected" : ""}
                  style={{ "--ink": c }}
                  disabled={locked}
                  onClick={() => {
                    finish();
                    setColor(c);
                  }}
                />
              ))}
              <input
                type="color"
                title={t("Custom color")}
                aria-label={t("Custom color")}
                value={color}
                disabled={locked}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>
            <label className="wb-width">
              {t("Size")}
              <input
                type="range"
                min="1"
                max="8"
                step=".5"
                value={width}
                disabled={locked}
                onChange={(e) => {
                  finish();
                  setWidth(Number(e.target.value));
                }}
              />
              <span>{width}</span>
            </label>
            <div className="wb-tool-group">
              <ToolButton
                label="Undo"
                disabled={locked || !undo.current.length}
                onClick={() => historyMove(undo, redo, "back")}
              >
                <Undo2 size={19} />
              </ToolButton>
              <ToolButton
                label="Redo"
                disabled={locked || !redo.current.length}
                onClick={() => historyMove(redo, undo, "forward")}
              >
                <Redo2 size={19} />
              </ToolButton>
              <ToolButton
                label="Clear annotations"
                disabled={locked || !strokes.length}
                onClick={() => setConfirm("clear")}
              >
                <Trash2 size={18} />
              </ToolButton>
            </div>
            <button
              className="wb-import"
              disabled={locked}
              onClick={() => file.current.click()}
            >
              <Upload size={17} />
              {t("Import PDF")}
              <small>300 MB</small>
            </button>
            <input
              hidden
              ref={file}
              type="file"
              accept="application/pdf,.pdf"
              onChange={importPDF}
            />
          </div>
        ) : (
          <div className="wb-student-bar">
            <MousePointer2 size={17} />
            {t(
              publicView
                ? "Public view · only the teacher can write"
                : "View only · your teacher writes on this board",
            )}
            <label>
              <input
                type="checkbox"
                checked={follow}
                onChange={(e) => setFollow(e.target.checked)}
              />
              {t("Follow teacher")}
            </label>
          </div>
        )}
        {sync.mode === "fallback" && (
          <div className="wb-alert" role="status">
            {t("Realtime is unavailable. Changes refresh every 10 seconds.")}
          </div>
        )}
        {sync.warning && (
          <div className="wb-alert" role="status">
            {t(sync.warning)}
          </div>
        )}
        {(error || sync.error) && (
          <div className="wb-alert" role="alert">
            {t(error || sync.error)}
            <button onClick={() => setError("")} aria-label={t("Dismiss")}>
              ×
            </button>
            {sync.status === "conflict" && (
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(doc)], {
                      type: "application/json",
                    }),
                    url = URL.createObjectURL(blob),
                    a = document.createElement("a");
                  a.href = url;
                  a.download = "lesson-recovery.json";
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 10000);
                }}
              >
                {t("Download recovery copy")}
              </button>
            )}
            {sync.status === "conflict" && (
              <button onClick={() => setConfirm("reload")}>
                {t("Reload saved lesson")}
              </button>
            )}
          </div>
        )}
        <div className="wb-workspace">
          <aside className="wb-pages" aria-label={t("Lesson pages")}>
            <div className="wb-pages-heading">
              {t("PAGES")} <span>{doc?.pages.length || 0}</span>
            </div>
            {doc?.pages.map((p, i) => (
              <button
                key={p.id}
                className={p.id === page?.id ? "is-current" : ""}
                aria-current={p.id === page?.id ? "page" : undefined}
                onClick={() => changePage(p)}
                disabled={!!working}
              >
                <span className={`wb-page-preview wb-paper-${p.paper}`}>
                  {p.pdf ? <FileText size={27} /> : <PenLine size={25} />}
                  <small>
                    {p.pdf ? `PDF · ${p.pdfPage}` : t("Whiteboard")}
                  </small>
                </span>
                <span>
                  {String(i + 1).padStart(2, "0")}
                  <small>
                    {p.pdf
                      ? p.name
                      : t(
                          p.paper === "grid"
                            ? "Grid paper"
                            : p.paper === "ruled"
                              ? "Ruled paper"
                              : "Blank page",
                        )}
                  </small>
                </span>
              </button>
            ))}
            {manage && (
              <div className="wb-new-page">
                <select
                  aria-label={t("Page format")}
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                >
                  <option value="landscape">{t("Landscape")}</option>
                  <option value="portrait">{t("Portrait")}</option>
                </select>
                <select
                  aria-label={t("Paper style")}
                  value={paper}
                  onChange={(e) => setPaper(e.target.value)}
                >
                  <option value="plain">{t("Blank page")}</option>
                  <option value="grid">{t("Grid paper")}</option>
                  <option value="ruled">{t("Ruled paper")}</option>
                </select>
                <button
                  disabled={locked || doc?.pages.length >= 200}
                  onClick={addPage}
                >
                  <Plus size={16} />
                  {t("Add page")}
                </button>
              </div>
            )}
          </aside>
          <main className="wb-stage" aria-label={t("Whiteboard page")}>
            <div className="wb-stage-meta">
              <span>
                {page?.pdf ? (
                  <>
                    <FileText size={14} />
                    {page.name} · {page.pdfPage}
                  </>
                ) : (
                  <>
                    <PenLine size={14} />
                    {t("Fixed-size whiteboard")}
                  </>
                )}
              </span>
              <span>
                {manage
                  ? t("Teacher")
                  : t(publicView ? "Public viewer" : "Student")}
              </span>
            </div>
            {page ? (
              <div className="wb-paper-wrap">
                <div
                  className="wb-paper"
                  style={{
                    aspectRatio: `${page.width} / ${page.height}`,
                    width: `${zoom}%`,
                    maxWidth: zoom === 100 ? `${page.width}px` : "none",
                  }}
                >
                  <canvas ref={canvas} aria-hidden="true" />
                  <canvas
                    ref={overlay}
                    className={manage ? "wb-draw" : "wb-view"}
                    style={{
                      cursor: !manage
                        ? "default"
                        : tool === "eraser"
                          ? "cell"
                          : "crosshair",
                    }}
                    aria-label={t("Drawing surface")}
                    onPointerDown={start}
                    onPointerMove={move}
                    onPointerUp={(e) => {
                      if (e.pointerId === gesture.current?.pointer) finish();
                    }}
                    onPointerCancel={finish}
                    onLostPointerCapture={finish}
                  />
                  <canvas
                    ref={draftCanvas}
                    aria-hidden="true"
                    style={{ pointerEvents: "none" }}
                  />
                  {pdfReady !== page.id && (
                    <div className="wb-paper-loading" role="status">
                      {t("Preparing page…")}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="wb-loading" role="status">
                <LoaderCircle size={25} />
                {t(
                  sync.status === "unavailable"
                    ? "Lesson access ended"
                    : "Opening board…",
                )}
              </div>
            )}
          </main>
        </div>
        <footer className="wb-footer">
          <span>{t("Fixed pages. Ready for PDF.")}</span>
          <div>
            <ToolButton
              label="Previous page"
              disabled={!doc || pageIndex === 0 || !!working}
              onClick={() => changePage(doc.pages[pageIndex - 1])}
            >
              <ChevronLeft size={17} />
            </ToolButton>
            <span>
              {pageIndex + 1} / {doc?.pages.length || "—"}
            </span>
            <ToolButton
              label="Next page"
              disabled={!doc || pageIndex >= doc.pages.length - 1 || !!working}
              onClick={() => changePage(doc.pages[pageIndex + 1])}
            >
              <ChevronRight size={17} />
            </ToolButton>
          </div>
          <label>
            {t("Zoom")}
            <select
              aria-label={t("Zoom")}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            >
              {[75, 100, 125, 150, 200].map((n) => (
                <option key={n} value={n}>
                  {n === 100 ? t("Fit page") : `${n}%`}
                </option>
              ))}
            </select>
          </label>
        </footer>
        {sharingOpen && (
          <BoardSharing
            base={base}
            sync={sync}
            onClose={() => setSharingOpen(false)}
          />
        )}
        {working && (
          <div className="wb-progress" role="status">
            <LoaderCircle size={18} />
            {working}
          </div>
        )}
        {confirm && (
          <div className="wb-confirm-shade">
            <div
              className="wb-confirm"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="wb-confirm-title"
            >
              <h3 id="wb-confirm-title">
                {t(
                  confirm === "clear"
                    ? "Clear all annotations on this page?"
                    : confirm === "reload"
                      ? "Replace the local draft with the saved lesson?"
                      : "Changes are still being saved",
                )}
              </h3>
              <p>
                {t(
                  confirm === "clear"
                    ? "Your PDF stays in place. You can undo this action."
                    : confirm === "reload"
                      ? "Download a recovery copy first if you need to keep the unsaved changes."
                      : "Keep the board open to finish syncing. A recovery draft is also stored on this device.",
                )}
              </p>
              <div>
                <button onClick={() => setConfirm("")}>
                  {t("Keep teaching")}
                </button>
                <button
                  className="wb-danger"
                  onClick={async () => {
                    if (confirm === "clear") clear();
                    else if (confirm === "reload") {
                      try {
                        await sync.reset();
                        undo.current = [];
                        redo.current = [];
                        setConfirm("");
                      } catch (e) {
                        setError(e.message);
                      }
                    } else onClose();
                  }}
                >
                  {t(
                    confirm === "clear"
                      ? "Clear annotations"
                      : confirm === "reload"
                        ? "Reload saved lesson"
                        : "Close with local draft",
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>,
    document.body,
  );
}
