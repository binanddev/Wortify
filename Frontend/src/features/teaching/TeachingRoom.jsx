import { lazy, Suspense, useEffect, useState } from "react";
import { Presentation, Plus, ArrowUpRight } from "lucide-react";
import { endpoint, request, useRoute } from "../../lib/core.js";
import { t, useLocale } from "../../i18n/index.js";
import { Editor } from "../../components/ui/ui.jsx";
import { pollLessons, sameLessons } from "./lesson-poll.js";
import "./teaching.css";
const Whiteboard = lazy(() => import("./Whiteboard.jsx"));
export default function TeachingRoom({ lang, classId, manage }) {
  useLocale();
  const [boards, setBoards] = useState([]),
    [selected, select] = useState(null),
    [creating, setCreating] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const route = useRoute(),
    opened = useState(() =>
      new URLSearchParams(route.split("?")[1]).get("lesson"),
    )[0];
  useEffect(() => {
    if (opened && boards.length)
      select(boards.find((item) => item.id === opened) || null);
  }, [opened, loading]);
  const base = endpoint(lang, `classes/${classId}/boards/`);
  useEffect(() => {
    // The open board has its own transport; its lesson list does not need polling.
    if (selected) return;
    const poll = pollLessons({
      load: (signal) => request(base, "GET", undefined, signal),
      visible: () => !document.hidden,
      onData: (data) => {
        setBoards((previous) =>
          sameLessons(previous, data.boards) ? previous : data.boards,
        );
        setError("");
        setLoading(false);
      },
      onError: (error) => {
        setError(error.message);
        setLoading(false);
      },
    });
    const visible = () => {
      if (!document.hidden) poll.refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      poll.stop();
      document.removeEventListener("visibilitychange", visible);
    };
  }, [base, Boolean(selected)]);
  async function create(values, signal) {
    const board = await request(
      base,
      "POST",
      { title: values.title?.trim() },
      signal,
    );
    const item = { id: board.id, title: values.title.trim() };
    setBoards((list) => [item, ...list]);
    select(item);
  }
  return (
    <section className="teaching-room" aria-label={t("Teaching studio")}>
      <div className="teaching-intro">
        <div className="teaching-emblem">
          <Presentation size={26} />
        </div>
        <div>
          <p className="teaching-eyebrow">WORTIFY · {t("LIVE CLASSROOM")}</p>
          <h2>{t("Teaching studio")}</h2>
          <p>
            {t("A shared board. A focused lesson. Everything in one place.")}
          </p>
        </div>
        <span className="teaching-tag">{t("PDF + Whiteboard")}</span>
      </div>
      {manage && (
        <div className="teaching-create">
          <button type="button" onClick={() => setCreating(true)}>
            <Plus size={18} />
            {t("New lesson")}
          </button>
        </div>
      )}
      {creating && (
        <Editor
          title={t("New lesson")}
          submitLabel="Create lesson"
          fields={[
            {
              name: "title",
              label: "Lesson title",
              isRequired: true,
              maxLength: 120,
              autoFocus: true,
            },
          ]}
          onSave={create}
          onClose={() => setCreating(false)}
        />
      )}
      {loading ? (
        <p role="status">{t("Loading lessons…")}</p>
      ) : !boards.length ? (
        <div className="teaching-empty">
          <Presentation size={36} />
          <h3>{t("Your classroom, ready to teach")}</h3>
          <p>
            {t(
              manage
                ? "Create a lesson, write on the board or bring your own PDF."
                : "Your teacher’s lessons will appear here.",
            )}
          </p>
          <small>{t("Fixed pages · PDF up to 300 MB · Live sharing")}</small>
        </div>
      ) : (
        <div className="teaching-lessons">
          {boards.map((board, index) => (
            <button key={board.id} onClick={() => select(board)}>
              <span className="teaching-lesson-icon">
                <Presentation size={22} />
              </span>
              <span>
                <small>
                  {t("LESSON")} {String(boards.length - index).padStart(2, "0")}
                </small>
                <strong>{board.title}</strong>
                <small>
                  {t(manage ? "Open teaching board" : "Join the lesson")}
                </small>
              </span>
              <ArrowUpRight size={20} />
            </button>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="teaching-error">
          {t(error)}
        </p>
      )}
      {selected && (
        <Suspense fallback={<p role="status">{t("Opening board…")}</p>}>
          <Whiteboard
            key={selected.id}
            board={selected}
            base={`${base}${selected.id}/`}
            manage={manage}
            onClose={() => {
              select(null);
            }}
          />
        </Suspense>
      )}
    </section>
  );
}
