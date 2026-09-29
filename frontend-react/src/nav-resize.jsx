import { useState } from "react";
import { readPreference, savePreference } from "./core";
const BASE = 422,
  MAX = 633;
export function useNavWidth(userId) {
  const key = `nav-width:${userId}`;
  const clamp = (value) => Math.max(BASE, Math.min(MAX, Number(value) || BASE));
  const [width, update] = useState(() => clamp(readPreference(key, BASE)));
  const setWidth = (value) => {
    const next = clamp(value);
    update(next);
    savePreference(key, next);
  };
  return [width, setWidth];
}
export function NavResize({ width, setWidth }) {
  const [drag, setDrag] = useState(null);
  return (
    <div
      role="separator"
      aria-label="Độ rộng thanh điều hướng"
      aria-orientation="vertical"
      aria-valuemin={BASE}
      aria-valuemax={MAX}
      aria-valuenow={width}
      tabIndex={0}
      className="nav-resize"
      title="Kéo để đổi độ rộng · nhấp đúp để đặt lại"
      onDoubleClick={() => setWidth(BASE)}
      onKeyDown={(e) => {
        const next = {
          ArrowLeft: width - 16,
          ArrowRight: width + 16,
          Home: BASE,
          End: MAX,
        }[e.key];
        if (next !== undefined) {
          e.preventDefault();
          setWidth(next);
        }
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag({ x: e.clientX, width });
      }}
      onPointerMove={(e) => {
        if (drag) setWidth(drag.width + e.clientX - drag.x);
      }}
      onPointerUp={(e) => {
        setDrag(null);
        e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={() => setDrag(null)}
      onLostPointerCapture={() => setDrag(null)}
    />
  );
}
