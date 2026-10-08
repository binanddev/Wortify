import { useState } from "react";
import { useResource } from "../../lib/core.js";
import { Page, Btn, Glass, Loading, Field } from "../../components/ui/ui.jsx";
import Users from "./Users.jsx";
import Content from "./Content.jsx";
import SystemOverview from "./SystemOverview.jsx";
import Appearance from "./Appearance.jsx";
import ApiDocs from "./ApiDocs.jsx";
import { Pagination, dateText } from "./shared.jsx";

function Dashboard({ user, open }) {
  const resource = useResource("/api/manage/summary/");
  return (
    <Loading label="Loading admin data…" resource={resource}>
      {(d) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Accounts", d.users, "users"],
              ["Locked accounts", d.inactive, "users"],
              ["Public content", d.public, "content"],
              ["Private content", d.private, "content"],
            ].map(([label, count, target]) => (
              <Glass key={label}>
                <span className="text-sm text-(--muted)">{label}</span>
                <strong className="my-2 block text-3xl">{count}</strong>
                <Btn onClick={() => open(target)}>View list</Btn>
              </Glass>
            ))}
          </div>
          <section className="my-6 rounded-2xl border border-(--line) p-5">
            <h2 className="text-xl font-bold">Today's tasks</h2>
            <p className="my-2 text-(--muted)">
              {d.new_users} new accounts in 7 days.{" "}
              {user.superuser
                ? "You can assign staff roles, manage content and inspect the system."
                : "You can edit learning content, support regular accounts and view your activity log."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Btn primary onClick={() => open("content")}>
                Manage content
              </Btn>
              <Btn onClick={() => open("users")}>User support</Btn>
            </div>
          </section>
          <h2 className="mb-3 text-xl font-bold">Recently updated content</h2>
          <div className="grid gap-3">
            {d.recent_content.map((n) => (
              <div
                key={n.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-(--line) p-4"
              >
                <div>
                  <strong>{n.title}</strong>
                  <p className="text-sm text-(--muted)">
                    {n.owner.username} · {n.language.toUpperCase()} ·{" "}
                    {n.visibility === "public" ? "Public" : "Private"}
                  </p>
                </div>
                <small>{dateText(n.updated_at)}</small>
              </div>
            ))}
            {!d.recent_content.length && (
              <p className="p-6">
                No content yet. Open the library to create your first folder and lesson.
              </p>
            )}
          </div>
        </>
      )}
    </Loading>
  );
}
function Activity({ user }) {
  const [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  const resource = useResource(
    `/api/manage/activity/?page=${page}&q=${encodeURIComponent(search)}`,
  );
  return (
    <>
      <p className="mb-4 text-(--muted)">
        {user.superuser
          ? "Admin and staff activity history."
          : "Your activity history."}
      </p>
      <form
        className="mb-5 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(query);
          setPage(1);
        }}
      >
        <Field
          label="Search content or actor"
          value={query}
          onChange={setQuery}
        />
        <Btn type="submit">Search</Btn>
        <Btn onClick={resource.reload}>Refresh</Btn>
      </form>
      <Loading label="Loading admin data…" resource={resource}>
        {(d) => (
          <>
            <div className="grid gap-3">
              {d.rows.map((row) => (
                <article
                  className="rounded-xl border border-(--line) p-4"
                  key={row.id}
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong>
                      {row.actor} · {row.target}
                    </strong>
                    <time className="text-sm text-(--muted)">
                      {dateText(row.at)}
                    </time>
                  </div>
                  <p className="mt-2 break-words text-sm">{row.message}</p>
                </article>
              ))}
              {!d.rows.length && (
                <p className="py-10 text-center">No matching activity.</p>
              )}
            </div>
            <Pagination page={page} total={d.total} onChange={setPage} />
          </>
        )}
      </Loading>
    </>
  );
}
export default function Admin({ user }) {
  const [tab, setTab] = useState("dashboard");
  const tabs = [
    ["dashboard", "Overview"],
    ["users", "Users"],
    ["content", "Content"],
    ["activity", "Activity log"],
    ...(user.superuser
      ? [
          ["system", "System"],
          ["api", "API documentation"],
          ["appearance", "Appearance chung"],
        ]
      : []),
  ];
  return (
    <Page>
      <div className="mb-5">
        <p className="mb-1 text-sm font-semibold text-(--muted)">
          {user.superuser ? "ADMIN" : "STAFF"} · {user.username}
        </p>
        <h1 className="text-3xl font-bold">Admin center</h1>
      </div>
      <nav
        aria-label="Admin features"
        className="mb-6 flex flex-wrap gap-2 border-b border-(--line) pb-4"
      >
        {tabs.map(([key, label]) => (
          <Btn
            key={key}
            primary={tab === key}
            aria-current={tab === key ? "page" : undefined}
            onClick={() => setTab(key)}
          >
            {label}
          </Btn>
        ))}
      </nav>
      {tab === "dashboard" && <Dashboard user={user} open={setTab} />}
      {tab === "users" && <Users user={user} />}
      {tab === "content" && <Content user={user} />}
      {tab === "activity" && <Activity user={user} />}
      {tab === "system" && user.superuser && <SystemOverview />}
      {tab === "api" && user.superuser && <ApiDocs />}
      {tab === "appearance" && user.superuser && <Appearance />}
    </Page>
  );
}
