import { t as tr, useLocale } from "../../i18n/index.js";
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
  useLocale();
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
        <Btn onClick={() => setTarget(null)}>{tr("← User list")}</Btn>
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
        <h2 className="text-xl font-bold">{tr("User management")}</h2>
        <div className="flex gap-2">
          <Btn onClick={resource.reload}>{tr("Refresh")}</Btn>
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
          >{tr("Create account")}</Btn>
        </div>
      </div>
      {!user.superuser && (
        <p className="mb-4 text-sm text-(--muted)">{tr("Staff support regular users. Admins manage roles and admin/staff accounts.")}</p>
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
          label={tr("Username or email")}
          value={query}
          onChange={setQuery}
        />
        <Btn primary type="submit">{tr("Search")}</Btn>
      </form>
      <Status>{notice}</Status>
      <Loading label={tr("Loading admin data…")} resource={resource}>
        {(d) => (
          <>
            <DataGrid id="users" label={tr("Accounts")} rows={d.users} sort={sort} onSort={next=>{setSort(next);setPage(1);}} columns={[
 {key:'username',label:'Username',required:true,render:u=><strong>{u.username}{u.id===user.id?tr(" · You"):''}</strong>},
 {key:'email',label:'Email'},
 {key:'name',label:'Name',sortable:false,render:u=>[u.first_name,u.last_name].filter(Boolean).join(' ')||'—'},
 {key:'role',label:'Role',filtered:!!role,filter:<Select label={tr("Filter role")} value={role} onChange={filter(setRole)}><option value="">{tr("All roles")}</option><option value="user">{tr("User")}</option><option value="staff">{tr("Staff")}</option><option value="superuser">{tr("Admin")}</option></Select>,render:u=><InlineSelect label={tr("Role for {v0}", { v0: u.username })} value={u.is_superuser?'superuser':u.is_staff?'staff':'user'} options={[["user","User"],["staff","Staff"],["superuser","Admin"]]} disabled={!user.superuser||u.id===user.id} onSave={async role=>{await request(`/api/manage/users/${u.id}/`,'PATCH',{role});reload('Role updated. Existing sessions were signed out.');}}/>},
 {key:'is_active',label:'Status',filtered:!!status,filter:<Select label={tr("Filter status")} value={status} onChange={filter(setStatus)}><option value="">{tr("All statuses")}</option><option value="active">{tr("Active")}</option><option value="inactive">{tr("Locked")}</option></Select>,render:u=><InlineSelect label={tr("Status for {v0}", { v0: u.username })} value={u.is_active?'active':'inactive'} options={[["active","Active"],["inactive","Locked"]]} disabled={u.id===user.id} onSave={async status=>{await request(`/api/manage/users/${u.id}/`,'PATCH',{is_active:status==='active'});reload('Status updated.');}}/>},
 {key:'date_joined',label:'Created',numeric:true,render:u=>dateText(u.date_joined)},
 {key:'last_login',label:'Last sign-in',numeric:true,render:u=>dateText(u.last_login)},
 {key:'id',label:'ID',numeric:true},
 {key:'actions',label:'Actions',sortable:false,required:true,render:u=><RowActions label={tr("Actions for {v0}", { v0: u.username })} items={[
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
                  ? tr("Create account")
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
                    label={tr("Account role")}
                    value={v.role}
                    onChange={(role) => set({ ...v, role })}
                  >
                    <option value="user">{tr("Users — learn and create personal content")}</option>
                    <option value="staff">{tr("Staff — content and user support")}</option>
                    <option value="superuser">{tr("Admin — full system access")}</option>
                  </Select>
                  <p className="my-3 text-sm text-(--muted)">{tr("Admins can assign roles, lock accounts and delete users. Grant this role only to system administrators.")}</p>
                </>
              )}
              {edit.reset && (
                <p className="mt-3 text-sm">{tr("The new password takes effect immediately. Other devices must sign in again.")}</p>
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
              ? tr("Permanently delete this account and its data in both languages. This cannot be undone.")
              : operation.kind === "sessions"
                ? tr("Users will need to sign in again. Learning data is preserved.")
                : tr("Update account access. Learning data is preserved.")
          }
          confirmText={
            operation.kind === "delete" ? operation.u.username : undefined
          }
          label={operation.kind === "delete" ? tr("Delete permanently") : tr("Confirm")}
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
