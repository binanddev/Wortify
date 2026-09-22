import { useState } from "react";
import { request, useResource, useAction } from "../../frontend-react/src/core";
import {
  Page,
  Heading,
  Btn,
  Field,
  Select,
  SidebarTools,
  Status,
  Loading,
  Glass,
  Editor,
  Confirm,
} from "../../frontend-react/src/ui";
export default function Admin({ user }) {
  const [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [edit, setEdit] = useState(null),
    [remove, setRemove] = useState(null),
    [logs, setLogs] = useState(null);
  const resource = useResource(
      `/api/manage/users/?q=${encodeURIComponent(search)}&page=${page}`,
    ),
    action = useAction();
  return (
    <Page>
      <Heading
        title="Quản trị người dùng"
        description="Superuser quản lý tài khoản. Staff hiện có cùng tính năng với người dùng thông thường."
      />
      <SidebarTools>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(query);
            setPage(1);
          }}
        >
          <Field
            label="Tên tài khoản hoặc email"
            value={query}
            onChange={setQuery}
          />
          <Btn type="submit">Tìm kiếm</Btn>
        </form>
        <Btn
          primary
          onClick={() =>
            setEdit({ create: true, role: "user", is_active: true })
          }
        >
          Tạo tài khoản
        </Btn>
      </SidebarTools>
      <Status error={action.error} />
      <Loading resource={resource}>
        {(data) => (
          <>
            <p>{data.total} tài khoản</p>
            <div className="admin-user-list">
              {data.users.map((u) => (
                <Glass key={u.id}>
                  <h2>
                    {u.username}
                    {u.id === user.id ? " · Bạn" : ""}
                  </h2>
                  <p>{u.email || "Chưa có email"}</p>
                  <p>
                    {u.is_superuser
                      ? "Superuser"
                      : u.is_staff
                        ? "Staff"
                        : "User"}{" "}
                    · {u.is_active ? "Hoạt động" : "Đã khóa"}
                  </p>
                  <div className="toolbar">
                    <Btn
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
                      Chỉnh sửa
                    </Btn>
                    <Btn
                      onClick={() =>
                        action.run(async (s) =>
                          setLogs(
                            await request(
                              `/api/manage/users/${u.id}/`,
                              "GET",
                              undefined,
                              s,
                            ),
                          ),
                        )
                      }
                    >
                      Nhật ký
                    </Btn>
                    <Btn
                      isDisabled={u.id === user.id}
                      onClick={() =>
                        action.run(async (s) => {
                          await request(
                            `/api/manage/users/${u.id}/`,
                            "PATCH",
                            { revoke_sessions: true },
                            s,
                          );
                        })
                      }
                    >
                      Đăng xuất mọi thiết bị
                    </Btn>
                    <Btn
                      isDisabled={u.id === user.id}
                      onClick={() => setRemove(u)}
                    >
                      Xóa tài khoản
                    </Btn>
                  </div>
                </Glass>
              ))}
            </div>
            <div className="toolbar">
              <Btn isDisabled={page === 1} onClick={() => setPage(page - 1)}>
                Trước
              </Btn>
              <span>Trang {page}</span>
              <Btn
                isDisabled={page * 50 >= data.total}
                onClick={() => setPage(page + 1)}
              >
                Sau
              </Btn>
            </div>
          </>
        )}
      </Loading>
      {edit && (
        <Editor
          title={edit.create ? "Tạo tài khoản" : `Quản lý ${edit.username}`}
          fields={[
            { name: "username", label: "Tên tài khoản", isRequired: true },
            { name: "email", label: "Email", type: "email" },
            {
              name: "password",
              label: edit.create
                ? "Mật khẩu"
                : "Mật khẩu mới · để trống nếu không đổi",
              type: "password",
              isRequired: !!edit.create,
              autoComplete: "new-password",
            },
          ]}
          initial={edit}
          onClose={() => setEdit(null)}
          onSave={async (v, s) => {
            await request(
              `/api/manage/users/${edit.create ? "" : `${edit.id}/`}`,
              edit.create ? "POST" : "PATCH",
              v,
              s,
            );
            resource.reload();
          }}
        >
          {(v, set) => (
            <>
              <Select
                label="Vai trò"
                value={v.role}
                onChange={(role) => set({ ...v, role })}
                disabled={edit.id === user.id}
              >
                <option value="user">User</option>
                <option value="staff">Staff · tính năng như User</option>
                <option value="superuser">
                  Superuser · quản trị người dùng
                </option>
              </Select>
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
        <Confirm
          title={`Xóa ${remove.username}?`}
          description="Xóa tài khoản cùng dữ liệu học tập và nội dung thuộc tài khoản này."
          onClose={() => setRemove(null)}
          onConfirm={async (s) => {
            await request(
              `/api/manage/users/${remove.id}/`,
              "DELETE",
              undefined,
              s,
            );
            setRemove(null);
            resource.reload();
          }}
        />
      )}
      {logs && (
        <Glass>
          <h2>Nhật ký quản trị</h2>
          {logs.logs.map((l, i) => (
            <p key={i}>
              {new Date(l.at).toLocaleString("vi-VN")} · {l.actor}: {l.message}
            </p>
          ))}
          {!logs.logs.length && <p>Chưa có thay đổi.</p>}
          <Btn onClick={() => setLogs(null)}>Đóng</Btn>
        </Glass>
      )}
    </Page>
  );
}
