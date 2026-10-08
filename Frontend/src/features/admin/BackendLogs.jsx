import { useState } from "react";
import { useResource } from "../../lib/core.js";
import { Btn, Loading } from "../../components/ui/ui.jsx";
export default function BackendLogs() {
  const [page, setPage] = useState(1),
    [failures, setFailures] = useState(false);
  const resource = useResource(
    `/api/manage/monitor/?page=${page}&failures=${failures ? 1 : 0}`,
  );
  const labels = {
    timeout: "Request timed out",
    network: "Network error",
    http: "Backend error",
    "invalid-response": "Invalid response",
  };
  return (
    <section className="my-8 grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Frontend → backend connection</h2>
        <div className="flash-icon-row">
          <Btn
            icon="eye"
            aria-pressed={failures}
            onClick={() => {
              setFailures((v) => !v);
              setPage(1);
            }}
          >
            Errors only
          </Btn>
          <Btn icon="refresh" onClick={resource.reload}>
            Update log
          </Btn>
        </div>
      </div>
      <p className="text-sm text-(--muted)">
        The frontend server checks the backend every 10 minutes, independently of users. Logs are retained for 30 days.
      </p>
      <Loading label="Loading admin data…" resource={resource}>
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
                      {new Date(log.at).toLocaleString("en-GB")}
                    </p>
                  </div>
                  <span
                    className={log.ok ? "text-emerald-600" : "text-rose-600"}
                  >
                    {log.ok
                      ? "Connected"
                      : labels[log.error] || "Disconnected"}{" "}
                    · {log.latency_ms} ms
                  </span>
                </div>
              ))}
              {!data.logs.length && <p>No matching logs.</p>}
            </div>
            <div className="toolbar centered">
              <Btn
                icon="chevron_left"
                isDisabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
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
