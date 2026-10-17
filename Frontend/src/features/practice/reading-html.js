export function readingImageSource(value) {
  const source = String(value || "").trim();
  if (/^\/(?!\/)[^\\\s]+$/.test(source)) return source;
  try { const url = new URL(source); return url.protocol === "https:" && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function readingStyle(value) {
  const style = {};
  for (const part of String(value || "").split(";")) {
    const index = part.indexOf(":");
    const name = part.slice(0,index).trim().toLowerCase(), val = part.slice(index+1).trim().toLowerCase();
    if (["width","height","max-width"].includes(name)) {
      const m = /^(\d+(?:\.\d+)?)(px|%)$/.exec(val);
      if (m) style[name === "max-width" ? "maxWidth" : name] = `${Math.min(Number(m[1]),m[2] === "%" ? 100 : 1200)}${m[2]}`;
    }
    if (name === "text-align" && ["left","center","right","justify"].includes(val)) style.textAlign = val;
    if (name === "float" && ["left","right","none"].includes(val)) style.float = val;
    if (name === "object-fit" && ["cover","contain"].includes(val)) style.objectFit = val;
    if (name === "margin" && /^(\d+(?:\.\d+)?)px$/.test(val)) style.margin = `${Math.min(parseFloat(val),48)}px`;
    if (name === "font-size" && /^\d+px$/.test(val)) style.fontSize = `${Math.max(12,Math.min(parseInt(val),36))}px`;
    if (name === "color" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/.test(val)) style.color = val;
  }
  return style;
}
