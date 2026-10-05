import { useState } from "react";
import { useResource } from "../core";
import { Page, Btn, Glass, Loading, Field } from "../ui";
import Users from "./Users";
import Content from "./Content";
import SystemOverview from "./SystemOverview";
import Appearance from "./Appearance";
import ApiDocs from "./ApiDocs";
import { Pagination, dateText } from "./shared";

function Dashboard({ user, open }) {
  const resource = useResource("/api/manage/summary/");
  return (
    <Loading label="Đang tải dữ liệu quản trị…" resource={resource}>
      {(d) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Tài khoản", d.users, "users"],
              ["Tài khoản đang khóa", d.inactive, "users"],
              ["Nội dung công khai", d.public, "content"],
              ["Nội dung riêng tư", d.private, "content"],
            ].map(([label, count, target]) => (
              <Glass key={label}>
                <span className="text-sm text-(--muted)">{label}</span>
                <strong className="my-2 block text-3xl">{count}</strong>
                <Btn onClick={() => open(target)}>Xem danh sách</Btn>
              </Glass>
            ))}
          </div>
          <section className="my-6 rounded-2xl border border-(--line) p-5">
            <h2 className="text-xl font-bold">Công việc hôm nay</h2>
            <p className="my-2 text-(--muted)">
              {d.new_users} tài khoản mới trong 7 ngày.{" "}
              {user.superuser
                ? "Bạn có thể phân quyền Staff, quản lý nội dung và kiểm tra hệ thống."
                : "Bạn có thể biên tập nội dung học tập, hỗ trợ tài khoản thường và xem nhật ký của mình."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Btn primary onClick={() => open("content")}>
                Quản lý nội dung
              </Btn>
              <Btn onClick={() => open("users")}>Hỗ trợ người dùng</Btn>
            </div>
          </section>
          <h2 className="mb-3 text-xl font-bold">Nội dung vừa cập nhật</h2>
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
                    {n.visibility === "public" ? "Công khai" : "Riêng tư"}
                  </p>
                </div>
                <small>{dateText(n.updated_at)}</small>
              </div>
            ))}
            {!d.recent_content.length && (
              <p className="p-6">
                Chưa có nội dung. Mở thư viện để tạo thư mục và bài học đầu
                tiên.
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
          ? "Lịch sử thao tác của các quản trị viên và nhân viên."
          : "Lịch sử những thao tác bạn đã thực hiện."}
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
          label="Tìm nội dung hoặc người thực hiện"
          value={query}
          onChange={setQuery}
        />
        <Btn type="submit">Tìm kiếm</Btn>
        <Btn onClick={resource.reload}>Làm mới</Btn>
      </form>
      <Loading label="Đang tải dữ liệu quản trị…" resource={resource}>
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
                <p className="py-10 text-center">Chưa có hoạt động phù hợp.</p>
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
    ["dashboard", "Tổng quan"],
    ["users", "Người dùng"],
    ["content", "Nội dung"],
    ["activity", "Nhật ký"],
    ...(user.superuser
      ? [
          ["system", "Hệ thống"],
          ["api", "Tài liệu API"],
          ["appearance", "Giao diện chung"],
        ]
      : []),
  ];
  return (
    <Page>
      <div className="mb-5">
        <p className="mb-1 text-sm font-semibold text-(--muted)">
          {user.superuser ? "ADMIN" : "STAFF"} · {user.username}
        </p>
        <h1 className="text-3xl font-bold">Trung tâm quản trị</h1>
      </div>
      <nav
        aria-label="Chức năng quản trị"
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
