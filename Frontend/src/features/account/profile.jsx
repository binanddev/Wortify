import { t as tr, useLocale, dateLocale } from "../../i18n/index.js";
import { useEffect, useState } from "react";
import { endpoint, request, useResource } from "../../lib/core.js";
import {
  Page,
  Btn,
  Icon,
  Link,
  Editor,
  Loading,
  Status,
  SidebarTools,
} from "../../components/ui/ui.jsx";

export default function LearningProfile({ lang }) {
  useLocale();
  const resource = useResource(endpoint(lang, "profile/"), true);
  useEffect(() => {
    let timer;
    const updated = (event) => {
      if (event.detail?.lang !== lang || !event.detail?.accepted?.length)
        return;
      clearTimeout(timer);
      timer = setTimeout(() => resource.reload(), 350);
    };
    window.addEventListener("learning-synced", updated);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("learning-synced", updated);
    };
  }, [lang]);
  return (
    <Loading resource={resource}>
      {(data) => <ProfileContent key={lang} initial={data} lang={lang} />}
    </Loading>
  );
}

function ProfileContent({ initial, lang }) {
  useLocale();
  const [data, setData] = useState(initial),
    [period, setPeriod] = useState("7"),
    [filter, setFilter] = useState("all"),
    [limit, setLimit] = useState(8),
    [edit, setEdit] = useState(null);
  useEffect(() => setData(initial), [initial]);
  const stats = data.periods[period],
    cards = data.cards;
  const goalRatio = Math.min(
    100,
    (100 * data.today_questions) / data.daily_goal,
  );
  const timeline = data.timeline.filter(
    (row) =>
      filter === "all" ||
      (filter === "practice"
        ? row.kind === "practice"
        : row.kind !== "practice"),
  );
  const next =
    data.resume ||
    (data.decks[0]
      ? `/${lang}/flashcard/deck/${data.decks[0].id}`
      : `/${lang}/flashcard`);
  const editGoal = () => setEdit("goal");
  return (
    <Page>
      <div className="learner-profile">
        <SidebarTools>
          <nav className="profile-index" aria-label={tr("Profile contents")}>
            <a href="#profile-overview">{tr("Overview")}</a>
            <a href="#profile-progress">{tr("Progress")}</a>
            <a href="#profile-history">{tr("History")}</a>
          </nav>
          <Btn onClick={() => setEdit("identity")}>
            <Icon name="user" />{tr(" Edit profile")}</Btn>
          <Btn onClick={editGoal}>
            <Icon name="settings" />{tr(" Daily goal")}</Btn>
        </SidebarTools>
        <header className="profile-identity" id="profile-overview">
          <div className="profile-avatar" aria-hidden="true">
            {(data.display_name || data.username).slice(0, 1).toUpperCase()}
          </div>
          <div className="profile-name">
            <span className="profile-language">
              {lang === "de" ? "DE · Deutsch" : "EN · English"}
            </span>
            <h1>{data.display_name || data.username}</h1>
            {data.bio && <p>{data.bio}</p>}
          </div>
          <button
            className="profile-edit"
            onClick={() => setEdit("identity")}
            aria-label={tr("Edit profile")}
            title={tr("Edit profile")}
          >
            <Icon name="user" />
          </button>
        </header>
        <div className="profile-focus-grid">
          <section
            className="profile-panel profile-goal"
            aria-labelledby="goal-title"
          >
            <div className="profile-section-title">
              <h2 id="goal-title">{tr("Today")}</h2>
              <button
                onClick={editGoal}
                aria-label={tr("Change daily goal")}
                title={tr("Change goal")}
              >
                <Icon name="settings" size={19} />
              </button>
            </div>
            <div className="profile-goal-body">
              <div
                className="profile-goal-ring"
                style={{ "--goal": `${goalRatio}%` }}
                role="img"
                aria-label={tr("{v0}/{v1} questions today", { v0: data.today_questions, v1: data.daily_goal })}
              >
                <strong>{data.today_questions}</strong>
                <span>/ {data.daily_goal}{tr(" questions")}</span>
              </div>
              <div>
                <span
                  className={`profile-goal-state ${goalRatio >= 100 ? "complete" : ""}`}
                >
                  {goalRatio >= 100
                    ? tr("✓ Goal reached")
                    : `${Math.max(0, data.daily_goal - data.today_questions)} questions remaining`}
                </span>
                <Link className="btn primary profile-continue" to={next}>
                  {data.resume
                    ? tr("Continue session")
                    : cards.due
                      ? tr("Review due cards")
                      : tr("Continue learning")}
                  <Icon name="arrow" />
                </Link>
                {cards.due > 0 && (
                  <span className="profile-due">{cards.due}{tr(" due cards")}</span>
                )}
              </div>
            </div>
          </section>
          <section
            className="profile-panel profile-calendar"
            aria-labelledby="calendar-title"
          >
            <div className="profile-section-title">
              <h2 id="calendar-title">{tr("Learning rhythm")}</h2>
              <span className="profile-streak">
                <svg
                  aria-hidden="true"
                  width="19"
                  height="23"
                  viewBox="0 0 20 24"
                  fill="currentColor"
                >
                  <path d="M11 1c2 6-4 7-1 12 1-2 3-3 3-6 8 8 5 16-3 16S-1 15 4 9c-1 6 2 7 3 6C4 8 11 7 11 1Z" />
                </svg>
                {data.streak}{tr(" days")}</span>
            </div>
            <div className="profile-week-labels" aria-hidden="true">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div
              className="profile-calendar-grid"
              role="group"
              aria-label={tr("Activity over four weeks, in Vietnam time")}
            >
              {data.calendar.map((day) => (
                <span
                  key={day.date}
                  className={`profile-day level-${day.future ? 0 : day.total >= 20 ? 4 : day.total >= 10 ? 3 : day.total >= 5 ? 2 : day.total > 0 || day.completed ? 1 : 0} ${day.future ? "future" : ""} ${day.date === data.today ? "today" : ""}`}
                  title={`${dateLabel(day.date)} · ${day.future ? "Not due yet" : `${day.total} questions · ${day.completed} completed exercises`}`}
                  aria-label={`${dateLabel(day.date)}: ${day.future ? "not due yet" : `${day.total} questions`}`}
                >
                  {Number(day.date.slice(-2))}
                </span>
              ))}
            </div>
            <div className="profile-calendar-foot">
              <span>{tr("Longest ")}<strong>{data.longest_streak}{tr(" days")}</strong>
              </span>
              <span>
                <i />{tr(" Studied")}</span>
            </div>
          </section>
        </div>
        <section className="profile-overview" id="profile-progress">
          <div className="profile-section-title">
            <h2>{tr("Learning progress")}</h2>
            <div
              className="profile-periods"
              role="group"
              aria-label={tr("Time range")}
            >
              {["7", "30", "90"].map((value) => (
                <button
                  key={value}
                  aria-pressed={period === value}
                  onClick={() => setPeriod(value)}
                >
                  {value}{tr(" days")}</button>
              ))}
            </div>
          </div>
          <div className="profile-metrics">
            {[
              [stats.active_days, "Study days", "calendar"],
              [stats.questions, "Answered questions", "edit"],
              [
                stats.accuracy === null ? "—" : `${stats.accuracy}%`,
                "Accuracy",
                "check",
              ],
              [stats.completed, "Completed exercises", "book"],
            ].map(([value, label, icon]) => (
              <div className="profile-panel profile-metric" key={tr(label)}>
                <Icon name={icon === "calendar" ? "class" : icon} />
                <strong>{value}</strong>
                <span>{tr(label)}</span>
              </div>
            ))}
          </div>
        </section>
        <div className="profile-detail-grid">
          <section className="profile-panel" aria-labelledby="vocabulary-title">
            <div className="profile-section-title">
              <h2 id="vocabulary-title">{tr("Flashcards")}</h2>
              <Link to={`/${lang}/flashcard`} aria-label={tr("Open flashcard library")}>
                <Icon name="arrow" />
              </Link>
            </div>
            <div className="profile-mastery-number">
              <strong>{cards.mastered}</strong>
              <span>/ {cards.total}{tr(" mastered cards")}</span>
            </div>
            <div
              className="profile-mastery-bar"
              role="img"
              aria-label={tr("{v0} mastered, {v1} familiar, {v2} not studied", { v0: cards.mastered, v1: cards.familiar, v2: cards.new })}
            >
              {["mastered", "familiar", "new"].map((stage) => (
                <span
                  className={stage}
                  key={stage}
                  style={{
                    width: `${cards.total ? (100 * cards[stage]) / cards.total : stage === "new" ? 100 : 0}%`,
                  }}
                />
              ))}
            </div>
            <div className="profile-mastery-key">
              {[
                ["mastered", "Mastered"],
                ["familiar", "Familiar"],
                ["new", "Not studied"],
              ].map(([stage, label]) => (
                <span key={stage}>
                  <i className={stage} />
                  {tr(label)}
                  <b>{cards[stage]}</b>
                </span>
              ))}
            </div>
            <div className="profile-milestones">
              {data.milestones.map((m) => (
                <span
                  key={m.label}
                  className={m.earned ? "earned" : ""}
                  title={m.earned ? tr("Achieved") : tr("Not yet mastered")}
                >
                  <Icon name={m.earned ? "check" : "spark"} size={16} />
                  {m.label}
                </span>
              ))}
            </div>
          </section>
          <section className="profile-panel" aria-labelledby="continue-title">
            <div className="profile-section-title">
              <h2 id="continue-title">{tr("Continue learning")}</h2>
              <Icon name="cards" />
            </div>
            {data.decks.length ? (
              data.decks.map((deck) => (
                <Link
                  className="profile-deck"
                  key={deck.id}
                  to={`/${lang}/flashcard/deck/${deck.id}`}
                >
                  <span className="profile-deck-icon">
                    <Icon name="cards" />
                  </span>
                  <div>
                    <strong>{deck.title}</strong>
                    <span>
                      {deck.mastered}/{deck.total}{tr(" mastered cards")}{deck.due ? ` · ${deck.due} due` : ""}
                    </span>
                    <progress
                      value={deck.mastered}
                      max={deck.total}
                      aria-label={tr("Progress {v0}", { v0: deck.title })}
                    />
                  </div>
                  <Icon name="arrow" size={18} />
                </Link>
              ))
            ) : (
              <div className="profile-empty">
                <Icon name="cards" size={30} />
                <p>{tr("No decks yet")}</p>
                <Link className="btn" to={`/${lang}/flashcard`}>{tr("Create deck")}</Link>
              </div>
            )}
            <Link className="profile-practice-link" to={`/${lang}/practice`}>
              <Icon name="book" />{tr(" Practice Hub ")}<Icon name="arrow" size={18} />
            </Link>
          </section>
        </div>
        <section className="profile-panel profile-history" id="profile-history">
          <div className="profile-section-title">
            <h2>{tr("Learning history")}</h2>
            <div
              className="profile-periods"
              role="group"
              aria-label={tr("Activity type")}
            >
              {[
                ["all", "All"],
                ["practice", "Exercises"],
                ["flashcard", "Flashcard"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  aria-pressed={filter === value}
                  onClick={() => {
                    setFilter(value);
                    setLimit(8);
                  }}
                >
                  {tr(label)}
                </button>
              ))}
            </div>
          </div>
          {timeline.length ? (
            <>
              <div className="profile-history-list">
                {timeline.slice(0, limit).map((row) => {
                  const content = (
                    <>
                      <span className={`profile-history-icon ${row.kind}`}>
                        <Icon
                          name={row.kind === "practice" ? "book" : "cards"}
                        />
                      </span>
                      <div className="profile-history-copy">
                        <strong>{row.title}</strong>
                        <span>
                          {row.kind === "practice"
                            ? tr("Exercises")
                            : row.kind === "test"
                              ? tr("Check")
                              : tr("Review")}{" "}
                          ·{" "}
                          {new Date(row.date).toLocaleString(dateLocale(), {
                            timeZone: "Asia/Ho_Chi_Minh",
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <span
                        className={`profile-score ${row.total && row.score === row.total ? "perfect" : ""}`}
                      >
                        {row.score}/{row.total}
                      </span>
                      {row.path && <Icon name="arrow" size={16} />}
                    </>
                  );
                  return row.path ? (
                    <Link
                      key={row.id}
                      className="profile-history-row"
                      to={row.path}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div key={row.id} className="profile-history-row">
                      {content}
                    </div>
                  );
                })}
              </div>
              {timeline.length > limit && (
                <Btn icon="more" onClick={() => setLimit((v) => v + 8)}>{tr("Show more")}</Btn>
              )}
            </>
          ) : (
            <div className="profile-empty">
              <Icon name="book" size={30} />
              <p>{tr("No completed exercises yet")}</p>
              <Link className="btn" to={`/${lang}/practice`}>{tr("Open Practice Hub")}</Link>
            </div>
          )}
        </section>
        {edit && (
          <Editor
            title={edit === "goal" ? tr("Daily goal") : tr("Profile")}
            fields={
              edit === "goal"
                ? [
                    {
                      name: "daily_goal",
                      label: "Questions per day",
                      type: "number",
                      min: 1,
                      max: 500,
                      isRequired: true,
                    },
                  ]
                : [
                    {
                      name: "display_name",
                      label: "Display name",
                      maxLength: 100,
                    },
                    {
                      name: "bio",
                      label: "Introduction",
                      multiline: true,
                      maxLength: 2000,
                    },
                  ]
            }
            initial={
              edit === "goal"
                ? { daily_goal: data.daily_goal }
                : { display_name: data.display_name, bio: data.bio }
            }
            onClose={() => setEdit(null)}
            onSave={async (values, signal) => {
              setData(
                await request(
                  endpoint(lang, "profile/"),
                  "PATCH",
                  edit === "goal"
                    ? { daily_goal: Number(values.daily_goal) }
                    : values,
                  signal,
                ),
              );
            }}
          />
        )}
      </div>
    </Page>
  );
}
function dateLabel(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(dateLocale(), {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}
