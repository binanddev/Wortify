import { useRef, useState } from "react";
import { readPreference, savePreference } from "../../lib/core.js";
import { Icon } from "../../components/ui/ui.jsx";
const icons = {
  flashcard: "cards",
  practice: "book",
  explore: "search",
  create: "edit",
  profile: "user",
  classes: "users",
  settings: "settings",
  admin: "settings",
};
export default function DesktopShortcut({ id, label, index, onOpen }) {
  const key = "wortify:windows-shortcut:" + id;
  const [position, setPosition] = useState(() => readPreference(key, null));
  const gesture = useRef(null),
    moved = useRef(false);
  const rows = Math.max(1, Math.floor((innerHeight - 90) / 104));
  const point = position || {
    x: 12 + Math.floor(index / rows) * 112,
    y: 12 + (index % rows) * 104,
  };
  const bounded = {
    x: Math.max(0, Math.min(innerWidth - 110, Number(point.x) || 0)),
    y: Math.max(0, Math.min(innerHeight - 155, Number(point.y) || 0)),
  };
  const move = (x, y) => {
    const next = {
      x: Math.max(0, Math.min(innerWidth - 110, x)),
      y: Math.max(0, Math.min(innerHeight - 155, y)),
    };
    setPosition(next);
    savePreference(key, next);
  };
  return (
    <button
      className="xp-desktop-shortcut"
      data-app={id}
      style={{ left: bounded.x, top: bounded.y }}
      title={`${label} — drag to move; Enter to open`}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        moved.current = false;
        gesture.current = { x: e.clientX, y: e.clientY, origin: bounded };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = gesture.current;
        if (!d) return;
        const dx = e.clientX - d.x,
          dy = e.clientY - d.y;
        if (Math.abs(dx) + Math.abs(dy) > 5) moved.current = true;
        if (moved.current) move(d.origin.x + dx, d.origin.y + dy);
      }}
      onPointerUp={() => (gesture.current = null)}
      onPointerCancel={() => {
        gesture.current = null;
        moved.current = true;
      }}
      onClick={() => {
        if (!moved.current) onOpen();
        moved.current = false;
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") moved.current = false;
        if (
          e.altKey &&
          ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
        ) {
          e.preventDefault();
          move(
            bounded.x + ({ ArrowLeft: -16, ArrowRight: 16 }[e.key] || 0),
            bounded.y + ({ ArrowUp: -16, ArrowDown: 16 }[e.key] || 0),
          );
        }
      }}
    >
      <span className="xp-shortcut-art">
        <Icon name={icons[id]} size={38} />
        <span className="xp-shortcut-arrow" aria-hidden="true">
          ↗
        </span>
      </span>
      <span>{label}</span>
    </button>
  );
}
