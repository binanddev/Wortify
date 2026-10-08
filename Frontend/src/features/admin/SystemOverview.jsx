import BackendLogs from "./BackendLogs.jsx";
import { useResource } from "../../lib/core.js";
import { Btn, Loading, Glass } from "../../components/ui/ui.jsx";
export default function SystemOverview() {
  const resource = useResource("/api/manage/overview/");
  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-3xl font-bold">System</h1>
        <Btn icon="refresh" onClick={resource.reload}>
          Update
        </Btn>
      </div>
      <Loading label="Loading admin data…" resource={resource}>
        {(d) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Object.entries({
                "Accounts": d.users.total,
                "Active": d.users.active,
                "Joined in 7 days": d.users.joined_week,
                "Signed in within 7 days": d.users.seen_week,
                Staff: d.users.staff,
                Superuser: d.users.superusers,
              }).map(([label, value]) => (
                <Glass key={label}>
                  <span className="text-sm text-(--muted)">{label}</span>
                  <strong className="text-3xl">{value}</strong>
                </Glass>
              ))}
            </div>
            <section className="my-6 grid gap-4 lg:grid-cols-2">
              <Glass>
                <h2 className="text-xl font-bold">Technical</h2>
                <p>Database: {d.system.database} · Connected</p>
                <p>
                  Django {d.system.django} · Python {d.system.python}
                </p>
                <p>
                  {d.system.debug ? "Development mode" : "Production mode"}
                </p>
                <p>
                  {d.system.pending_migrations
                    ? `${d.system.pending_migrations} pending migrations`
                    : "Data structure updated"}
                </p>
                <small>
                  Checked at {new Date(d.checked_at).toLocaleString("en-GB")}
                </small>
              </Glass>
              <Glass>
                <h2 className="text-xl font-bold">Content</h2>
                {Object.entries({
                  "Decks": d.content.decks,
                  Card: d.content.cards,
                  "Exercise items": d.content.practice,
                  Media: d.content.media,
                  Lớp: d.content.classes,
                }).map(([k, v]) => (
                  <p key={k}>
                    {k}: {v}
                  </p>
                ))}
              </Glass>
            </section>
            <BackendLogs />
            <h2 className="mb-3 text-xl font-bold">Admin activity</h2>
            <div className="grid gap-2">
              {d.logs.map((l, i) => (
                <div key={i} className="rounded-xl border border-(--line) p-4">
                  <p className="font-semibold">
                    {l.actor} · {l.target}
                  </p>
                  <p className="break-words text-sm">{l.message}</p>
                  <small>{new Date(l.at).toLocaleString("en-GB")}</small>
                </div>
              ))}
              {!d.logs.length && <p>No activity yet.</p>}
            </div>
          </>
        )}
      </Loading>
    </>
  );
}
