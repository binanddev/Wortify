import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { getLanguage, t } from "../../../i18n/index.js";
export default function GameFrame({ initialDeck, lang, userId, onClose }) {
  const frame = useRef(null),
    latest = useRef(null);
  latest.current = { initialDeck, lang, userId, onClose };
  useEffect(() => {
    const previous = document.activeElement,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const receive = (event) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== frame.current?.contentWindow
      )
        return;
      if (event.data?.type === "wortify-game-ready") {
        const { initialDeck, lang, userId } = latest.current;
        frame.current.contentWindow.postMessage(
          {
            type: "wortify-game-init",
            initialDeck,
            lang,
            userId,
            locale: getLanguage(),
          },
          window.location.origin,
        );
      }
      if (event.data?.type === "wortify-game-close") latest.current.onClose();
    };
    window.addEventListener("message", receive);
    return () => {
      window.removeEventListener("message", receive);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("Game")}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "#080e1c",
      }}
    >
      <iframe
        ref={frame}
        src="/game.html"
        title={t("Game")}
        allow="autoplay; fullscreen"
        style={{ display: "block", width: "100%", height: "100%", border: 0 }}
      />
      <button
        type="button"
        aria-label={t("Close")}
        onClick={onClose}
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          width: 24,
          height: 24,
          border: 0,
          borderRadius: 4,
          background: "#17253b",
          color: "white",
          cursor: "pointer",
        }}
      >
        ×
      </button>
    </div>,
    document.body,
  );
}
