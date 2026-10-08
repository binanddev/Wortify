import { useState } from "react";
import { request, useResource } from "../../lib/core.js";
import { Btn, Field, Select, Loading, Editor, Status } from "../../components/ui/ui.jsx";
import UserData from "./UserData.jsx";
import { ActionDialog, Pagination, roleName, dateText } from "./shared.jsx";

export default function Users({ user }) {
  const [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [role, setRole] = useState(""),
    [status, setStatus] = useState(""),
    [sort, setSort] = useState("newest"),
    [page, setPage] = useState(1);
  const [edit, setEdit] = useState(null),
    [operation, setOperation] = useState(null),
    [target, setTarget] = useState(null),
    [notice, setNotice] = useState("");
  const resource = useResource(
    `/api/manage/users/?q=${encodeURIComponent(search)}&page=${page}&role=${role}&status=${status}&sort=${sort}`,
  );
  const reload = (message) => {
    setNotice(message);
    resource.reload();
  };
  const filter = (setter) => (value) => {
    setter(value);
    setPage(1);
  };
  if (target)
    return (
      <>
        <Btn onClick={() => setTarget(null)}>← User list</Btn>
        <UserData
          key={target.id}
          user={target}
          onClose={() => setTarget(null)}
        />
      </>
    );
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">User management</h2>
        <div className="flex gap-2">
          <Btn onClick={resource.reload}>Refresh</Btn>
          <Btn
            primary
            onClick={() =>
              setEdit({
                create: true,
                role: "user",
                username: "",
                email: "",
                first_name: "",
                last_name: "",
              })
            }
          >
            Create account
          </Btn>
        </div>
      </div>
      {!user.superuser && (
        <p className="mb-4 text-sm text-(--muted)">
          Staff support regular users. Admins manage roles and admin/staff accounts.
        </p>
      )}
      <form
        className="mb-5 grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(query);
          setPage(1);
        }}
      >
        <Field
          label="Username or email"
          value={query}
          onChange={setQuery}
        />
        {user.superuser && (
          <Select label="Role" value={role} onChange={filter(setRole)}>
            <option value="">All roles</option>
            <option value="user">Users</option>
            <option value="staff">Staff</option>
            <option value="superuser">Admin</option>
          </Select>
        )}
        <Select label="Status" value={status} onChange={filter(setStatus)}>
          <option value="">All statuses</option>
          <option value="active">Activity</option>
          <option value="inactive">Locked</option>
        </Select>
        <Select label="Sort" value={sort} onChange={filter(setSort)}>
          <option value="newest">Newest</option>
          <option value="username">Name A–Z</option>
          <option value="recent">Recently signed in</option>
        </Select>
        <Btn primary type="submit">
          Search
        </Btn>
      </form>
      <Status>{notice}</Status>
      <Loading label="Loading admin data…" resource={resource}>
        {(d) => (
          <>
            <div className="grid gap-3">
              {d.users.map((u) => (
                <article
                  key={u.id}
                  className="rounded-2xl border border-(--line) bg-(--surface) p-5"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words text-lg font-bold">
                        {u.username}
                        {u.id === user.id ? " · You" : ""}
                      </h3>
                      <p className="break-all text-sm text-(--muted)">
                        {[u.last_name, u.first_name]
                          .filter(Boolean)
                          .join(" ") || "No name provided"}{" "}
                        · {u.email || "No email provided"}
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="rounded-full border border-(--line) px-3 py-1 text-xs">
                        {roleName(u)}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs ${u.is_active ? "bg-emerald-500/10 text-emerald-700" : "bg-rose-500/10 text-rose-700"}`}
                      >
                        {u.is_active ? "Activity" : "Locked"}
                      </span>
                    </div>
                  </div>
                  <p className="my-3 text-xs text-(--muted)">
                    Create: {dateText(u.date_joined)} · Sign in:{" "}
                    {dateText(u.last_login)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Btn onClick={() => setEdit({ ...u })}>Edit details</Btn>
                    <Btn onClick={() => setTarget(u)}>Learning data</Btn>
                    {user.superuser && (
                      <Btn
                        isDisabled={u.id === user.id}
                        onClick={() =>
                          setEdit({
                            ...u,
                            permissions: true,
                            role: u.is_superuser
                              ? "superuser"
                              : u.is_staff
                                ? "staff"
                                : "user",
                          })
                        }
                      >
                        Assign roles
                      </Btn>
                    )}
                    <details className="min-w-0">
                      <summary className="cursor-pointer rounded-xl border border-(--line) px-3 py-2 text-sm">
                        Account actions
                      </summary>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Btn
                          isDisabled={u.id === user.id}
                          onClick={() => setOperation({ u, kind: "status" })}
                        >
                          {u.is_active ? "Lock account" : "Unlock"}
                        </Btn>
                        <Btn
                          isDisabled={u.id === user.id}
                          onClick={() => setOperation({ u, kind: "sessions" })}
                        >
                          Sign out all devices
                        </Btn>
                        <Btn onClick={() => setEdit({ ...u, reset: true })}>
                          Reset password
                        </Btn>
                        <Btn
                          isDisabled={u.id === user.id}
                          onClick={() => setOperation({ u, kind: "delete" })}
                        >
                          Delete account
                        </Btn>
                      </div>
                    </details>
                  </div>
                </article>
              ))}
              {!d.users.length && (
                <div className="py-12 text-center">
                  <p>No matching accounts.</p>
                  <Btn
                    onClick={() => {
                      setQuery("");
                      setSearch("");
                      setRole("");
                      setStatus("");
                      setPage(1);
                    }}
                  >
                    Clear filters
                  </Btn>
                </div>
              )}
            </div>
            <Pagination
              page={page}
              total={d.total}
              size={50}
              onChange={setPage}
            />
          </>
        )}
      </Loading>
      {edit && (
        <Editor
          title={
            edit.permissions
              ? `Assign roles · ${edit.username}`
              : edit.reset
                ? `Reset password · ${edit.username}`
                : edit.create
                  ? "Create account"
                  : `Details · ${edit.username}`
          }
          initial={edit}
          onClose={() => setEdit(null)}
          fields={
            edit.permissions
              ? []
              : edit.reset
                ? [
                    {
                      name: "password",
                      label: "New password",
                      type: "password",
                      isRequired: true,
                      autoComplete: "new-password",
                    },
                  ]
                : [
                    {
                      name: "username",
                      label: "Username",
                      isRequired: true,
                    },
                    { name: "email", label: "Email", type: "email" },
                    { name: "last_name", label: "Last name" },
                    { name: "first_name", label: "Name" },
                    ...(edit.create
                      ? [
                          {
                            name: "password",
                            label: "Initial password",
                            type: "password",
                            isRequired: true,
                            autoComplete: "new-password",
                          },
                        ]
                      : []),
                  ]
          }
          onSave={async (v, signal) => {
            const data = edit.permissions
              ? { role: v.role }
              : edit.reset
                ? { password: v.password }
                : {
                    username: v.username,
                    email: v.email,
                    first_name: v.first_name,
                    last_name: v.last_name,
                    ...(edit.create
                      ? { password: v.password, role: v.role }
                      : {}),
                  };
            await request(
              `/api/manage/users/${edit.create ? "" : `${edit.id}/`}`,
              edit.create ? "POST" : "PATCH",
              data,
              signal,
            );
            reload(
              edit.permissions
                ? "Permissions updated. Existing account sessions have been signed out."
                : "Account saved.",
            );
          }}
        >
          {(v, set) => (
            <>
              {(edit.permissions || (edit.create && user.superuser)) && (
                <>
                  <Select
                    label="Account role"
                    value={v.role}
                    onChange={(role) => set({ ...v, role })}
                  >
                    <option value="user">
                      Users — learn and create personal content
                    </option>
                    <option value="staff">
                      Staff — content and user support
                    </option>
                    <option value="superuser">
                      Admin — full system access
                    </option>
                  </Select>
                  <p className="my-3 text-sm text-(--muted)">
                    Admins can assign roles, lock accounts and delete users. Grant this role only to system administrators.
                  </p>
                </>
              )}
              {edit.reset && (
                <p className="mt-3 text-sm">
                  The new password takes effect immediately. Other devices must sign in again.
                </p>
              )}
            </>
          )}
        </Editor>
      )}
      {operation && (
        <ActionDialog
          title={`${operation.kind === "delete" ? "Delete account" : operation.kind === "sessions" ? "Sign out all devices" : operation.u.is_active ? "Lock account" : "Unlock"} · ${operation.u.username}`}
          description={
            operation.kind === "delete"
              ? "Permanently delete this account and its data in both languages. This cannot be undone."
              : operation.kind === "sessions"
                ? "Users will need to sign in again. Learning data is preserved."
                : "Update account access. Learning data is preserved."
          }
          confirmText={
            operation.kind === "delete" ? operation.u.username : undefined
          }
          label={operation.kind === "delete" ? "Delete permanently" : "Confirm"}
          onClose={() => setOperation(null)}
          onConfirm={async (values, signal) => {
            await request(
              `/api/manage/users/${operation.u.id}/`,
              operation.kind === "delete" ? "DELETE" : "PATCH",
              {
                ...values,
                ...(operation.kind === "status"
                  ? { is_active: !operation.u.is_active }
                  : operation.kind === "sessions"
                    ? { revoke_sessions: true }
                    : {}),
              },
              signal,
            );
            reload("Action completed.");
          }}
        />
      )}
    </>
  );
}
