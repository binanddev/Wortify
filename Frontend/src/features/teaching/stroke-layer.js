import { drawStroke } from "./board-model.js";
const painted = new WeakMap();

// Keep the committed layer intact while only the active, separate draft changes.
// Appended points/visibility changes/snapshot replacement still invalidate it.
export function paintStrokeLayer(
  canvas,
  page,
  strokes,
  { scale = 1, exclude, draw = drawStroke } = {},
) {
  const width = Math.ceil(page.width * scale),
    height = Math.ceil(page.height * scale);
  const snapshot = [];
  for (const stroke of strokes)
    if (stroke.id !== exclude)
      snapshot.push({
        stroke,
        points: stroke.points,
        count: stroke.points?.length,
        visible: stroke.visible,
        color: stroke.color,
        width: stroke.width,
        tool: stroke.tool,
      });
  const previous = painted.get(canvas);
  if (
    canvas.width === width &&
    canvas.height === height &&
    previous?.page === page.id &&
    previous.scale === scale &&
    previous.strokes.length === snapshot.length &&
    snapshot.every((item, i) => {
      const old = previous.strokes[i];
      return (
        old.stroke === item.stroke &&
        old.points === item.points &&
        old.count === item.count &&
        old.visible === item.visible &&
        old.color === item.color &&
        old.width === item.width &&
        old.tool === item.tool
      );
    })
  )
    return false;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  for (const item of snapshot) draw(ctx, item.stroke);
  painted.set(canvas, { page: page.id, scale, strokes: snapshot });
  return true;
}
