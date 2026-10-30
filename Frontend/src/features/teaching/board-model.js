export const uid = () => crypto.randomUUID();
export function applyOperation(state, op) {
  if (op.kind === "page")
    state.pages.push({
      id: op.id,
      width: op.width,
      height: op.height,
      paper: op.paper,
    });
  else if (op.kind === "active") state.active = op.page;
  else if (op.kind === "ink") {
    const stroke = (state.strokes[op.id] ||= {
      id: op.id,
      page: op.page,
      tool: op.tool,
      color: op.color,
      width: op.width,
      points: [],
      visible: true,
    });
    if (stroke.points.length === op.offset)
      stroke.points.push(...op.points.map((p) => [...p]));
  } else if (op.kind === "visibility")
    for (const id of op.ids)
      if (state.strokes[id]) state.strokes[id].visible = op.visible;
  return state;
}
export function drawStroke(ctx, s) {
  if (!s.visible || !s.points.length) return;
  ctx.save();
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalAlpha = s.tool === "marker" ? 0.28 : s.tool === "pencil" ? 0.65 : 1;
  const [a, b = a] = [s.points[0], s.points.at(-1)];
  ctx.beginPath();
  if (s.tool === "rectangle")
    ctx.rect(
      Math.min(a[0], b[0]),
      Math.min(a[1], b[1]),
      Math.abs(b[0] - a[0]),
      Math.abs(b[1] - a[1]),
    );
  else if (s.tool === "ellipse")
    ctx.ellipse(
      (a[0] + b[0]) / 2,
      (a[1] + b[1]) / 2,
      Math.abs(b[0] - a[0]) / 2,
      Math.abs(b[1] - a[1]) / 2,
      0,
      0,
      Math.PI * 2,
    );
  else {
    ctx.moveTo(...a);
    if (s.tool === "line") ctx.lineTo(...b);
    else for (let i = 1; i < s.points.length; i++) ctx.lineTo(...s.points[i]);
  }
  if (s.points.length === 1) {
    ctx.arc(...a, s.width / 2, 0, Math.PI * 2);
    ctx.fill();
  } else ctx.stroke();
  ctx.restore();
}
export function drawPaper(ctx, page) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, page.width, page.height);
  if (page.paper === "plain") return;
  ctx.strokeStyle = "#dce6ef";
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let y = 32; y < page.height; y += 32) {
    ctx.moveTo(0, y);
    ctx.lineTo(page.width, y);
  }
  if (page.paper === "grid")
    for (let x = 32; x < page.width; x += 32) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, page.height);
    }
  ctx.stroke();
}
const boundsCache = new WeakMap();
export function strokeBounds(stroke) {
  const points = stroke.points;
  let record = boundsCache.get(stroke);
  if (!record || record.points !== points || record.count > points.length) {
    record = {
      points,
      count: 0,
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
    };
    boundsCache.set(stroke, record);
  }
  for (let i = record.count; i < points.length; i++) {
    const [x, y] = points[i];
    record.minX = Math.min(record.minX, x);
    record.minY = Math.min(record.minY, y);
    record.maxX = Math.max(record.maxX, x);
    record.maxY = Math.max(record.maxY, y);
  }
  record.count = points.length;
  return record;
}
export function hitsStroke(stroke, point, radius = 12) {
  const pts = stroke.points;
  if (!pts.length) return false;
  const bounds = strokeBounds(stroke),
    margin = radius + stroke.width / 2;
  if (
    point[0] < bounds.minX - margin ||
    point[0] > bounds.maxX + margin ||
    point[1] < bounds.minY - margin ||
    point[1] > bounds.maxY + margin
  )
    return false;
  const distance = (a, b) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      n = dx * dx + dy * dy;
    const t = n
      ? Math.max(
          0,
          Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / n),
        )
      : 0;
    return (
      Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy) <=
      radius + stroke.width / 2
    );
  };
  if (stroke.tool === "rectangle") {
    const a = pts[0],
      b = pts.at(-1);
    return [a, [b[0], a[1]], b, [a[0], b[1]], a].some(
      (p, i, arr) => i && distance(arr[i - 1], p),
    );
  }
  if (stroke.tool === "ellipse") {
    const a = pts[0],
      b = pts.at(-1),
      cx = (a[0] + b[0]) / 2,
      cy = (a[1] + b[1]) / 2,
      rx = Math.abs(a[0] - b[0]) / 2,
      ry = Math.abs(a[1] - b[1]) / 2;
    const outline = Array.from({ length: 65 }, (_, i) => [
      cx + rx * Math.cos((i * Math.PI) / 32),
      cy + ry * Math.sin((i * Math.PI) / 32),
    ]);
    return outline.some((p, i) => i && distance(outline[i - 1], p));
  }
  return pts.length === 1
    ? distance(pts[0], pts[0])
    : pts.some((p, i) => i && distance(pts[i - 1], p));
}

// Bound HTTP/WS envelopes even after a long offline drawing session.
export function takeOperations(queue, maxBytes = 180000) {
  const encoder = new TextEncoder();
  let bytes = 200,
    count = 0;
  for (const operation of queue) {
    const size = encoder.encode(JSON.stringify(operation)).length + 1;
    if (bytes + size > maxBytes || count === 128) break;
    bytes += size;
    count++;
  }
  if (!count && queue.length)
    throw new Error("A board operation is too large. Keep a recovery copy.");
  return queue.splice(0, count);
}
