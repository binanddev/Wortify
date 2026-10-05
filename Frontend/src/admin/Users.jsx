import { useState } from "react";
import { request, useResource } from "../core";
import { Btn, Field, Select, Loading, Editor, Status } from "../ui";
import UserData from "./UserData";
import { ActionDialog, Pagination, roleName, dateText } from "./shared";

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
        <Btn onClick={() => setTarget(null)}>← Danh sách người dùng</Btn>
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
        <h2 className="text-xl font-bold">Quản lý người dùng</h2>
        <div className="flex gap-2">
          <Btn onClick={resource.reload}>Làm mới</Btn>
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
            Tạo tài khoản
          </Btn>
        </div>
      </div>
      {!user.superuser && (
        <p className="mb-4 text-sm text-(--muted)">
          Staff hỗ trợ tài khoản thường. Phân quyền và tài khoản Admin/Staff do
          Admin quản lý.
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
          label="Tên tài khoản hoặc email"
          value={query}
          onChange={setQuery}
        />
        {user.superuser && (
          <Select label="Vai trò" value={role} onChange={filter(setRole)}>
            <option value="">Tất cả vai trò</option>
            <option value="user">Người dùng</option>
            <option value="staff">Staff</option>
            <option value="superuser">Admin</option>
          </Select>
        )}
        <Select label="Trạng thái" value={status} onChange={filter(setStatus)}>
          <option value="">Tất cả trạng thái</option>
          <option value="active">Hoạt động</option>
          <option value="inactive">Đã khóa</option>
        </Select>
        <Select label="Sắp xếp" value={sort} onChange={filter(setSort)}>
          <option value="newest">Mới nhất</option>
          <option value="username">Tên A–Z</option>
          <option value="recent">Đăng nhập gần đây</option>
        </Select>
        <Btn primary type="submit">
          Tìm kiếm
        </Btn>
      </form>
      <Status>{notice}</Status>
      <Loading label="Đang tải dữ liệu quản trị…" resource={resource}>
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
                        {u.id === user.id ? " · Bạn" : ""}
                      </h3>
                      <p className="break-all text-sm text-(--muted)">
                        {[u.last_name, u.first_name]
                          .filter(Boolean)
                          .join(" ") || "Chưa có họ tên"}{" "}
                        · {u.email || "Chưa có email"}
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="rounded-full border border-(--line) px-3 py-1 text-xs">
                        {roleName(u)}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs ${u.is_active ? "bg-emerald-500/10 text-emerald-700" : "bg-rose-500/10 text-rose-700"}`}
                      >
                        {u.is_active ? "Hoạt động" : "Đã khóa"}
                      </span>
                    </div>
                  </div>
                  <p className="my-3 text-xs text-(--muted)">
                    Tạo: {dateText(u.date_joined)} · Đăng nhập:{" "}
                    {dateText(u.last_login)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Btn onClick={() => setEdit({ ...u })}>Sửa thông tin</Btn>
                    <Btn onClick={() => setTarget(u)}>Dữ liệu học tập</Btn>
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
                        Phân quyền
                      </Btn>
                    )}
                    <details className="min-w-0">
                      <summary className="cursor-pointer rounded-xl border border-(--line) px-3 py-2 text-sm">
                        Thao tác tài khoản
                      </summary>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Btn
                          isDisabled={u.id === user.id}
                          onClick={() => setOperation({ u, kind: "status" })}
                        >
                          {u.is_active ? "Khóa tài khoản" : "Mở khóa"}
                        </Btn>
                        <Btn
                          isDisabled={u.id === user.id}
                          onClick={() => setOperation({ u, kind: "sessions" })}
                        >
                          Đăng xuất mọi thiết bị
                        </Btn>
                        <Btn onClick={() => setEdit({ ...u, reset: true })}>
                          Đặt lại mật khẩu
                        </Btn>
                        <Btn
                          isDisabled={u.id === user.id}
                          onClick={() => setOperation({ u, kind: "delete" })}
                        >
                          Xóa tài khoản
                        </Btn>
                      </div>
                    </details>
                  </div>
                </article>
              ))}
              {!d.users.length && (
                <div className="py-12 text-center">
                  <p>Không có tài khoản phù hợp.</p>
                  <Btn
                    onClick={() => {
                      setQuery("");
                      setSearch("");
                      setRole("");
                      setStatus("");
                      setPage(1);
                    }}
                  >
                    Xóa bộ lọc
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
              ? `Phân quyền · ${edit.username}`
              : edit.reset
                ? `Đặt lại mật khẩu · ${edit.username}`
                : edit.create
                  ? "Tạo tài khoản"
                  : `Thông tin · ${edit.username}`
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
                      label: "Mật khẩu mới",
                      type: "password",
                      isRequired: true,
                      autoComplete: "new-password",
                    },
                  ]
                : [
                    {
                      name: "username",
                      label: "Tên tài khoản",
                      isRequired: true,
                    },
                    { name: "email", label: "Email", type: "email" },
                    { name: "last_name", label: "Họ" },
                    { name: "first_name", label: "Tên" },
                    ...(edit.create
                      ? [
                          {
                            name: "password",
                            label: "Mật khẩu ban đầu",
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
                ? "Đã cập nhật quyền. Các phiên cũ của tài khoản được đăng xuất."
                : "Đã lưu tài khoản.",
            );
          }}
        >
          {(v, set) => (
            <>
              {(edit.permissions || (edit.create && user.superuser)) && (
                <>
                  <Select
                    label="Vai trò tài khoản"
                    value={v.role}
                    onChange={(role) => set({ ...v, role })}
                  >
                    <option value="user">
                      Người dùng — học và tạo nội dung cá nhân
                    </option>
                    <option value="staff">
                      Staff — nội dung và hỗ trợ người dùng
                    </option>
                    <option value="superuser">
                      Admin — toàn quyền hệ thống
                    </option>
                  </Select>
                  <p className="my-3 text-sm text-(--muted)">
                    Admin có thể phân quyền, khóa và xóa tài khoản khác. Chỉ cấp
                    quyền này cho người quản trị hệ thống.
                  </p>
                </>
              )}
              {edit.reset && (
                <p className="mt-3 text-sm">
                  Mật khẩu mới có hiệu lực ngay. Các thiết bị khác phải đăng
                  nhập lại.
                </p>
              )}
            </>
          )}
        </Editor>
      )}
      {operation && (
        <ActionDialog
          title={`${operation.kind === "delete" ? "Xóa tài khoản" : operation.kind === "sessions" ? "Đăng xuất mọi thiết bị" : operation.u.is_active ? "Khóa tài khoản" : "Mở khóa"} · ${operation.u.username}`}
          description={
            operation.kind === "delete"
              ? "Xóa vĩnh viễn tài khoản và dữ liệu thuộc sở hữu của người này ở cả hai ngôn ngữ. Không thể hoàn tác."
              : operation.kind === "sessions"
                ? "Người dùng sẽ cần đăng nhập lại. Dữ liệu học tập được giữ nguyên."
                : "Cập nhật quyền đăng nhập của tài khoản. Dữ liệu học tập được giữ nguyên."
          }
          confirmText={
            operation.kind === "delete" ? operation.u.username : undefined
          }
          label={operation.kind === "delete" ? "Xóa vĩnh viễn" : "Xác nhận"}
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
            reload("Đã thực hiện thao tác.");
          }}
        />
      )}
    </>
  );
}
