export function TheoryActivity({ payload }) {
  const escaped = String(payload.content || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  const content =
    payload.format === "html"
      ? payload.content
      : escaped
          .replace(/^### (.+)$/gm, "<h3>$1</h3>")
          .replace(/^## (.+)$/gm, "<h2>$1</h2>")
          .replace(/^# (.+)$/gm, "<h1>$1</h1>")
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          .replace(/\n/g, "<br/>");
  return (
    <iframe
      className="hub-theory"
      sandbox=""
      title="Nội dung lý thuyết"
      srcDoc={`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{font:19px/1.8 system-ui;margin:24px;color:#17253d;background:#f6f9fd}img,video{max-width:100%}pre{white-space:pre-wrap}a{color:#1854cf}</style>${content}`}
    />
  );
}
