import { useState } from "react";
import { NAV_BASE, NAV_MIN, NAV_MAX } from "./navigation-settings";
const BASE = NAV_BASE,
  MIN = NAV_MIN,
  MAX = NAV_MAX;
export function NavResize({ width, setWidth }) {
  const [drag, setDrag] = useState(null);
  return (
    <div
      role="separator"
      aria-label="Kích thước thanh điều hướng"
      aria-orientation="vertical"
      aria-valuemin={MIN}
      aria-valuemax={MAX}
      aria-valuenow={width}
      aria-valuetext={`${Math.round((width / BASE) * 100)}%`}
      tabIndex={0}
      className="nav-resize"
      title="Kéo để đổi độ rộng · nhấp đúp để đặt lại"
      onDoubleClick={() => setWidth(BASE)}
      onKeyDown={(e) => {
        const next = {
          ArrowLeft: width - 16,
          ArrowRight: width + 16,
          Home: MIN,
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
