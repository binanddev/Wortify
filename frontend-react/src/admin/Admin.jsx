import BackendLogs from "./BackendLogs";
import { useState } from "react";
import { request, useResource, useAction } from "../core";
import {
  Page,
  Heading,
  Btn,
  Icon,
  Field,
  Select,
  SidebarTools,
  Status,
  Loading,
  Glass,
  Editor,
} from "../ui";
import { PracticeModal } from "../practice-workspace";
import UserData from "./UserData";

function DeleteDialog({ user, onClose, onDone }) {
  const [confirm, setConfirm] = useState("");
  const action = useAction();
  return (
    <PracticeModal
      title={`Xóa tài khoản ${user.username}`}
      onClose={onClose}
      pending={action.pending}
      size="md"
    >
      <p>
        Tài khoản và dữ liệu thuộc sở hữu của người này sẽ bị xóa vĩnh viễn, ở
        cả tiếng Anh và tiếng Đức.
      </p>
      <Field
        label={`Nhập ${user.username} để xác nhận`}
        value={confirm}
        onChange={setConfirm}
      />
      <Status error={action.error} />
      <Btn
        icon="trash"
        isDisabled={confirm !== user.username}
        isLoading={action.pending}
        onClick={() =>
          action.run(async (signal) => {
            await request(
              `/api/manage/users/${user.id}/`,
              "DELETE",
              undefined,
              signal,
            );
            onDone();
            onClose();
          })
        }
      >
        Xóa tài khoản
      </Btn>
    </PracticeModal>
  );
}
function Overview() {
  const resource = useResource("/api/manage/overview/");
  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Hệ thống</h1>
        <Btn icon="refresh" onClick={resource.reload}>
          Cập nhật
        </Btn>
      </div>
      <Loading resource={resource}>
        {(d) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Object.entries({
                "Tài khoản": d.users.total,
                "Đang hoạt động": d.users.active,
                "Mới trong 7 ngày": d.users.joined_week,
                "Đăng nhập trong 7 ngày": d.users.seen_week,
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
                <h2 className="text-xl font-bold">Kỹ thuật</h2>
                <p>Cơ sở dữ liệu: {d.system.database} · Kết nối tốt</p>
                <p>
                  Django {d.system.django} · Python {d.system.python}
                </p>
                <p>
                  {d.system.debug ? "Chế độ phát triển" : "Chế độ production"}
                </p>
                <p>
                  {d.system.pending_migrations
                    ? `${d.system.pending_migrations} migration chưa áp dụng`
                    : "Cấu trúc dữ liệu đã cập nhật"}
                </p>
                <small>
                  Kiểm tra lúc {new Date(d.checked_at).toLocaleString("vi-VN")}
                </small>
              </Glass>
              <Glass>
                <h2 className="text-xl font-bold">Nội dung</h2>
                {Object.entries({
                  "Bộ thẻ": d.content.decks,
                  Thẻ: d.content.cards,
                  "Mục bài tập": d.content.practice,
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
            <h2 className="mb-3 text-xl font-bold">Hoạt động quản trị</h2>
            <div className="grid gap-2">
              {d.logs.map((l, i) => (
                <div key={i} className="rounded-xl border border-(--line) p-4">
                  <p className="font-semibold">
                    {l.actor} · {l.target}
                  </p>
                  <p className="break-words text-sm">{l.message}</p>
                  <small>{new Date(l.at).toLocaleString("vi-VN")}</small>
                </div>
              ))}
              {!d.logs.length && <p>Chưa có hoạt động.</p>}
            </div>
          </>
        )}
      </Loading>
    </>
  );
}
export default function Admin({ user }) {
  const [tab, setTab] = useState(user.superuser ? "system" : "users");
  const [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  const [edit, setEdit] = useState(null),
    [remove, setRemove] = useState(null),
    [logs, setLogs] = useState(null),
    [target, setTarget] = useState(null);
  const resource = useResource(
      `/api/manage/users/?q=${encodeURIComponent(search)}&page=${page}`,
    ),
    action = useAction();
  return (
    <Page>
      <SidebarTools navOnly>
        <div className="flash-icon-row">
          {user.superuser && (
            <Btn
              icon="settings"
              aria-pressed={tab === "system"}
              onClick={() => {
                setTab("system");
                setTarget(null);
              }}
            >
              Hệ thống
            </Btn>
          )}
          <Btn
            icon="user"
            aria-pressed={tab === "users"}
            onClick={() => {
              setTab("users");
              setTarget(null);
            }}
          >
            Người dùng
          </Btn>
        </div>
        {tab === "users" && !target && (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSearch(query);
                setPage(1);
              }}
              className="grid gap-3"
            >
              <Field label="Tên hoặc email" value={query} onChange={setQuery} />
              <Btn icon="search" type="submit">
                Tìm kiếm
              </Btn>
            </form>
            <div className="flash-icon-row">
              <Btn
                icon="plus"
                primary
                onClick={() =>
                  setEdit({ create: true, role: "user", is_active: true })
                }
              >
                Tạo tài khoản
              </Btn>
              <Btn icon="refresh" onClick={resource.reload}>
                Cập nhật
              </Btn>
            </div>
          </>
        )}
      </SidebarTools>
      <Status error={action.error} />
      {tab === "system" && user.superuser ? (
        <Overview />
      ) : target ? (
        <UserData
          key={target.id}
          user={target}
          onClose={() => setTarget(null)}
        />
      ) : (
        <>
          <Heading title="Người dùng" />
          <Loading resource={resource}>
            {(data) => (
              <>
                <p className="mb-4 text-sm text-(--muted)">
                  {data.total} tài khoản
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  {data.users.map((u) => (
                    <Glass key={u.id}>
                      <div className="flex items-center gap-3">
                        <Icon name="user" />
                        <h2 className="truncate text-xl font-bold">
                          {u.username}
                          {u.id === user.id ? " · Bạn" : ""}
                        </h2>
                      </div>
                      <p className="truncate">{u.email || "—"}</p>
                      <p className="text-sm text-(--muted)">
                        {u.is_superuser
                          ? "Superuser"
                          : u.is_staff
                            ? "Staff"
                            : "User"}{" "}
                        · {u.is_active ? "Hoạt động" : "Đã khóa"}
                      </p>
                      <div className="flash-icon-row">
                        <Btn
                          icon="edit"
                          onClick={() =>
                            setEdit({
                              ...u,
                              role: u.is_superuser
                                ? "superuser"
                                : u.is_staff
                                  ? "staff"
                                  : "user",
                            })
                          }
                        >
                          Chỉnh sửa tài khoản
                        </Btn>
                        <Btn icon="folder" onClick={() => setTarget(u)}>
                          Quản lý dữ liệu
                        </Btn>
                        <Btn
                          icon="history"
                          onClick={() =>
                            action.run(async (signal) =>
                              setLogs({
                                name: u.username,
                                ...(await request(
                                  `/api/manage/users/${u.id}/`,
                                  "GET",
                                  undefined,
                                  signal,
                                )),
                              }),
                            )
                          }
                        >
                          Nhật ký
                        </Btn>
                        <Btn
                          icon="logout"
                          isDisabled={u.id === user.id}
                          onClick={() =>
                            action.run(async (signal) => {
                              await request(
                                `/api/manage/users/${u.id}/`,
                                "PATCH",
                                { revoke_sessions: true },
                                signal,
                              );
                              resource.reload();
                            })
                          }
                        >
                          Đăng xuất mọi thiết bị
                        </Btn>
                        <Btn
                          icon="trash"
                          isDisabled={u.id === user.id}
                          onClick={() => setRemove(u)}
                        >
                          Xóa tài khoản
                        </Btn>
                      </div>
                    </Glass>
                  ))}
                </div>
                <div className="toolbar centered">
                  <Btn
                    icon="chevron_left"
                    isDisabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Trang trước
                  </Btn>
                  <span>{page}</span>
                  <Btn
                    icon="chevron_right"
                    isDisabled={page * 50 >= data.total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Trang sau
                  </Btn>
                </div>
              </>
            )}
          </Loading>
        </>
      )}
      {edit && (
        <Editor
          title={edit.create ? "Tạo tài khoản" : edit.username}
          initial={edit}
          fields={[
            { name: "username", label: "Tên tài khoản", isRequired: true },
            { name: "email", label: "Email", type: "email" },
            {
              name: "password",
              label: edit.create
                ? "Mật khẩu"
                : "Mật khẩu mới · để trống nếu giữ nguyên",
              type: "password",
              isRequired: !!edit.create,
              autoComplete: "new-password",
            },
          ]}
          onClose={() => setEdit(null)}
          onSave={async (v, signal) => {
            await request(
              `/api/manage/users/${edit.create ? "" : `${edit.id}/`}`,
              edit.create ? "POST" : "PATCH",
              {
                username: v.username,
                email: v.email,
                password: v.password,
                role: v.role,
                is_active: v.is_active,
              },
              signal,
            );
            resource.reload();
          }}
        >
          {(v, set) => (
            <>
              {user.superuser && (
                <Select
                  label="Vai trò"
                  value={v.role}
                  disabled={edit.id === user.id}
                  onChange={(role) => set({ ...v, role })}
                >
                  <option value="user">User</option>
                  <option value="staff">Staff</option>
                  <option value="superuser">Superuser</option>
                </Select>
              )}
              {!edit.create && (
                <label className="check-line">
                  <input
                    type="checkbox"
                    checked={v.is_active}
                    disabled={edit.id === user.id}
                    onChange={(e) => set({ ...v, is_active: e.target.checked })}
                  />
                  Tài khoản hoạt động
                </label>
              )}
            </>
          )}
        </Editor>
      )}
      {remove && (
        <DeleteDialog
          user={remove}
          onClose={() => setRemove(null)}
          onDone={resource.reload}
        />
      )}
      {logs && (
        <PracticeModal
          title={`Nhật ký · ${logs.name}`}
          onClose={() => setLogs(null)}
        >
          {logs.logs.map((l, i) => (
            <p key={i}>
              {new Date(l.at).toLocaleString("vi-VN")} · {l.actor}: {l.message}
            </p>
          ))}
          {!logs.logs.length && <p>Chưa có thay đổi.</p>}
        </PracticeModal>
      )}
    </Page>
  );
}
