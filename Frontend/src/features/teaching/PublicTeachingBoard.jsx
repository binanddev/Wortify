import { lazy, Suspense, useEffect, useState } from "react";
import { endpoint, request } from "../../lib/core.js";
import { t, useLocale } from "../../i18n/index.js";
import "./teaching.css";
const Whiteboard = lazy(() => import("./Whiteboard.jsx"));
export default function PublicTeachingBoard({ lang, token }) {
  useLocale();
  const [board, setBoard] = useState(null),
    [error, setError] = useState(""),
    [open, setOpen] = useState(true),
    [retry, setRetry] = useState(0);
  const base = endpoint(lang, `classes/public/${token}/`);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    request(`${base}info/`, "GET", undefined, controller.signal)
      .then(setBoard)
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            e.status === 404
              ? t(
                  "This public lesson is unavailable. The teacher may have stopped sharing.",
                )
              : e.message,
          );
      });
    return () => controller.abort();
  }, [base, retry]);
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow, noarchive";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
  return (
    <main className="teaching-public-page">
      <section className="teaching-public-card">
        <p className="teaching-eyebrow">WORTIFY · {t("PUBLIC LESSON")}</p>
        <h1>{board?.title || t("Public lesson")}</h1>
        <p>{t("Watch the teacher’s board live. No account is required.")}</p>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button
              onClick={() => {
                setBoard(null);
                setRetry((n) => n + 1);
              }}
            >
              {t("Try again")}
            </button>
          </>
        ) : board ? (
          <button onClick={() => setOpen(true)}>
            {t("Open public lesson")}
          </button>
        ) : (
          <p role="status">{t("Opening board…")}</p>
        )}
        <small>
          {t(
            "View only. This link does not give access to class members or assignments.",
          )}
        </small>
      </section>
      {board && open && (
        <Suspense fallback={<p role="status">{t("Opening board…")}</p>}>
          <Whiteboard
            board={board}
            base={base}
            manage={false}
            publicView
            onClose={() => setOpen(false)}
          />
        </Suspense>
      )}
    </main>
  );
}
