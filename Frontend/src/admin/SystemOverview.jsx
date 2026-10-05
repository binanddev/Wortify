import BackendLogs from "./BackendLogs";
import { useResource } from "../core";
import { Btn, Loading, Glass } from "../ui";
export default function SystemOverview() {
  const resource = useResource("/api/manage/overview/");
  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Hệ thống</h1>
        <Btn icon="refresh" onClick={resource.reload}>
          Cập nhật
        </Btn>
      </div>
      <Loading label="Đang tải dữ liệu quản trị…" resource={resource}>
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
