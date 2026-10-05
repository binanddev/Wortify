import { useState } from "react";
import { useResource } from "../core";
import { Btn, Loading } from "../ui";
export default function BackendLogs() {
  const [page, setPage] = useState(1),
    [failures, setFailures] = useState(false);
  const resource = useResource(
    `/api/manage/monitor/?page=${page}&failures=${failures ? 1 : 0}`,
  );
  const labels = {
    timeout: "Quá thời gian chờ",
    network: "Lỗi mạng",
    http: "Backend báo lỗi",
    "invalid-response": "Phản hồi không hợp lệ",
  };
  return (
    <section className="my-8 grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Kết nối frontend → backend</h2>
        <div className="flash-icon-row">
          <Btn
            icon="eye"
            aria-pressed={failures}
            onClick={() => {
              setFailures((v) => !v);
              setPage(1);
            }}
          >
            Chỉ xem lỗi
          </Btn>
          <Btn icon="refresh" onClick={resource.reload}>
            Cập nhật log
          </Btn>
        </div>
      </div>
      <p className="text-sm text-(--muted)">
        Máy chủ frontend kiểm tra backend mỗi 10 phút, không phụ thuộc người
        dùng. Giữ log 30 ngày.
      </p>
      <Loading label="Đang tải dữ liệu quản trị…" resource={resource}>
        {(data) => (
          <>
            <div className="grid gap-2">
              {data.logs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-(--line) p-3"
                >
                  <div>
                    <strong>{log.source}</strong>
                    <p className="text-sm">
                      {new Date(log.at).toLocaleString("vi-VN")}
                    </p>
                  </div>
                  <span
                    className={log.ok ? "text-emerald-600" : "text-rose-600"}
                  >
                    {log.ok
                      ? "Kết nối tốt"
                      : labels[log.error] || "Mất kết nối"}{" "}
                    · {log.latency_ms} ms
                  </span>
                </div>
              ))}
              {!data.logs.length && <p>Chưa có log phù hợp.</p>}
            </div>
            <div className="toolbar centered">
              <Btn
                icon="chevron_left"
                isDisabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Trước
              </Btn>
              <span>
                {page} · {data.total} log
              </span>
              <Btn
                icon="chevron_right"
                isDisabled={page * 50 >= data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Sau
              </Btn>
            </div>
          </>
        )}
      </Loading>
    </section>
  );
}
