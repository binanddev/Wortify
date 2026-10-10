import RowActions from "./RowActions.jsx";
import DataGrid from "./DataGrid.jsx";
import InlineSelect from "./InlineSelect.jsx";
import {sortQuery} from "./grid-state.js";
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
    [sort, setSort] = useState([{key:"date_joined",desc:true}]),
    [page, setPage] = useState(1);
  const [edit, setEdit] = useState(null),
    [operation, setOperation] = useState(null),
    [target, setTarget] = useState(null),
    [notice, setNotice] = useState("");
  const resource = useResource(
    `/api/manage/users/?q=${encodeURIComponent(search)}&page=${page}&role=${role}&status=${status}&ordering=${sortQuery(sort)}`,
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
        className="mb-3 flex flex-wrap items-end gap-2"
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
        <Btn primary type="submit">
          Search
        </Btn>
      </form>
      <Status>{notice}</Status>
      <Loading label="Loading admin data…" resource={resource}>
        {(d) => (
          <>
            <DataGrid id="users" label="Accounts" rows={d.users} sort={sort} onSort={next=>{setSort(next);setPage(1);}} columns={[
 {key:'username',label:'Username',required:true,render:u=><strong>{u.username}{u.id===user.id?' · You':''}</strong>},
 {key:'email',label:'Email'},
 {key:'name',label:'Name',sortable:false,render:u=>[u.first_name,u.last_name].filter(Boolean).join(' ')||'—'},
 {key:'role',label:'Role',filtered:!!role,filter:<Select label="Filter role" value={role} onChange={filter(setRole)}><option value="">All roles</option><option value="user">User</option><option value="staff">Staff</option><option value="superuser">Admin</option></Select>,render:u=><InlineSelect label={`Role for ${u.username}`} value={u.is_superuser?'superuser':u.is_staff?'staff':'user'} options={[["user","User"],["staff","Staff"],["superuser","Admin"]]} disabled={!user.superuser||u.id===user.id} onSave={async role=>{await request(`/api/manage/users/${u.id}/`,'PATCH',{role});reload('Role updated. Existing sessions were signed out.');}}/>},
 {key:'is_active',label:'Status',filtered:!!status,filter:<Select label="Filter status" value={status} onChange={filter(setStatus)}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Locked</option></Select>,render:u=><InlineSelect label={`Status for ${u.username}`} value={u.is_active?'active':'inactive'} options={[["active","Active"],["inactive","Locked"]]} disabled={u.id===user.id} onSave={async status=>{await request(`/api/manage/users/${u.id}/`,'PATCH',{is_active:status==='active'});reload('Status updated.');}}/>},
 {key:'date_joined',label:'Created',numeric:true,render:u=>dateText(u.date_joined)},
 {key:'last_login',label:'Last sign-in',numeric:true,render:u=>dateText(u.last_login)},
 {key:'id',label:'ID',numeric:true},
 {key:'actions',label:'Actions',sortable:false,required:true,render:u=><RowActions label={`Actions for ${u.username}`} items={[
 {key:'edit',label:'Edit details',run:()=>setEdit({...u})},
 {key:'learning',label:'Learning data',run:()=>setTarget(u)},
 {key:'sessions',label:'Sign out devices',disabled:u.id===user.id,run:()=>setOperation({u,kind:'sessions'})},
 {key:'password',label:'Reset password',run:()=>setEdit({...u,reset:true})},
 {key:'delete',label:'Delete account',danger:true,disabled:u.id===user.id,run:()=>setOperation({u,kind:'delete'})}
 ]}/>}
 ]}/>
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
