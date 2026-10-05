import { useState } from "react";
import { useResource } from "../core";
import { Btn, Field, Select, Loading, Status } from "../ui";

function Snippet({ value, label = "JSON" }) {
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const [message, setMessage] = useState("");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Đã sao chép.");
    } catch {
      setMessage("Chọn đoạn mã bên dưới để sao chép thủ công.");
    }
  };
  return (
    <div className="my-3 min-w-0 rounded-xl border border-(--line)">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-(--line) px-3 py-2">
        <strong className="text-xs">{label}</strong>
        <Btn onClick={copy}>Sao chép</Btn>
      </div>
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all p-4 text-xs leading-relaxed">
        <code>{text}</code>
      </pre>
      {message && (
        <p role="status" className="px-4 pb-3 text-xs">
          {message}
        </p>
      )}
    </div>
  );
}

function Reference({ data }) {
  const [query, setQuery] = useState(""),
    [group, setGroup] = useState(""),
    [method, setMethod] = useState("");
  const rows = data.endpoints.filter(
    (row) =>
      (!group || row.group === group) &&
      (!method || row.methods.includes(method)) &&
      `${row.path} ${row.description} ${row.role}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  return (
    <div className="min-w-0">
      <div className="mb-5 flex flex-wrap justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Tài liệu API</h2>
          <p className="mt-2 text-sm text-(--muted)">
            {data.endpoints.length} đường dẫn · Session & CSRF · Dành cho lập
            trình viên
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            className="btn primary"
            href="/api/manage/api-docs/?format=postman"
            download
          >
            Tải Postman Collection
          </a>
          <a
            className="btn"
            href="/api/manage/api-docs/?format=markdown"
            download
          >
            Tải hướng dẫn Markdown
          </a>
        </div>
      </div>
      <div className="mb-6 rounded-2xl border border-(--line) bg-(--surface) p-5">
        <h3 className="text-lg font-bold">Bắt đầu trong Postman</h3>
        <ol className="my-3 list-decimal space-y-2 pl-5 text-sm">
          <li>
            Import collection, đặt <code>baseUrl</code>, <code>username</code>,{" "}
            <code>password</code> trong Environment riêng.
          </li>
          <li>
            Mở thư mục <strong>00 · Bắt đầu</strong>: nhận CSRF cookie → đăng
            nhập → kiểm tra phiên.
          </li>
          <li>
            Chọn request cần thử. Thay ID và body theo dữ liệu của môi trường
            thử nghiệm.
          </li>
          <li>
            Với nội dung quản trị, đọc chi tiết để lấy <code>version</code>{" "}
            trước khi lưu thay đổi.
          </li>
        </ol>
        <p className="text-sm text-(--muted)">
          Trang này không tự gọi thử API. Collection có cả request sửa/xóa; gửi
          từng request có chủ đích, không chạy toàn bộ tự động.
        </p>
      </div>
      <section aria-label="Hướng dẫn tích hợp" className="mb-7 grid gap-3">
        {data.guide.map((guide, index) => (
          <details
            key={guide.title}
            open={index === 1}
            className="rounded-xl border border-(--line) p-4"
          >
            <summary className="cursor-pointer font-semibold">
              {guide.title}
            </summary>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-(--muted)">
              {guide.text}
            </p>
          </details>
        ))}
      </section>
      <section aria-label="Ví dụ nghiệp vụ" className="mb-7 grid gap-3">
        <h3 className="text-xl font-bold">Ví dụ nghiệp vụ</h3>
        {data.recipes.map((recipe) => (
          <details
            key={recipe.title}
            className="min-w-0 rounded-xl border border-(--line) p-4"
          >
            <summary className="cursor-pointer font-semibold">
              {recipe.title}
            </summary>
            <p className="mt-3 break-all text-sm">
              <code>
                {recipe.method} {recipe.path}
              </code>
            </p>
            <p className="mt-3 text-sm leading-relaxed text-(--muted)">
              {recipe.description}
            </p>
            <Snippet value={recipe.body} label="Body · application/json" />
          </details>
        ))}
      </section>
      <h3 className="mb-3 text-xl font-bold">Danh mục endpoint</h3>
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <Field
          label="Tìm đường dẫn, chức năng hoặc quyền"
          value={query}
          onChange={setQuery}
        />
        <Select label="Nhóm API" value={group} onChange={setGroup}>
          <option value="">Tất cả nhóm</option>
          {[...new Set(data.endpoints.map((r) => r.group))].map((g) => (
            <option key={g}>{g}</option>
          ))}
        </Select>
        <Select label="HTTP method" value={method} onChange={setMethod}>
          <option value="">Tất cả method</option>
          {["GET", "POST", "PATCH", "DELETE", "HEAD"].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </Select>
      </div>
      <p className="mb-3 text-sm text-(--muted)">
        {rows.length} đường dẫn phù hợp. Các giá trị ID, tên và response minh
        họa không phải dữ liệu thật.
      </p>
      <div className="grid gap-3">
        {rows.map((row) => (
          <details
            key={row.path}
            className="min-w-0 rounded-2xl border border-(--line) bg-(--surface) p-4"
          >
            <summary className="cursor-pointer">
              <span className="mr-2 inline-flex flex-wrap gap-1">
                {row.methods.map((m) => (
                  <span
                    key={m}
                    className={`rounded px-2 py-1 text-xs font-bold ${m === "DELETE" ? "bg-rose-500/10 text-rose-700" : "bg-blue-500/10 text-blue-700"}`}
                  >
                    {m}
                  </span>
                ))}
              </span>
              <code className="break-all text-sm">{row.path}</code>
              <span className="mt-2 block text-xs text-(--muted)">
                {row.group} · {row.role}
              </span>
            </summary>
            <div className="mt-4 min-w-0 border-t border-(--line) pt-4">
              <p className="whitespace-pre-line text-sm leading-relaxed">
                {row.description}
              </p>
              {row.parameters.length > 0 && (
                <p className="my-3 text-sm">
                  <strong>Path parameters:</strong> {row.parameters.join(", ")}.
                  Thay bằng ID thật; language=en/de, fmt=json/csv.
                </p>
              )}
              {Object.entries(row.examples).map(([verb, value]) => (
                <Snippet
                  key={verb}
                  value={value}
                  label={`Body ${verb} · application/json`}
                />
              ))}
              {row.multipart.length > 0 && (
                <div className="my-4">
                  <strong className="text-sm">POST · form-data</strong>
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    {row.multipart.map(([name, type, value]) => (
                      <li key={name}>
                        <code>{name}</code> ·{" "}
                        {type === "file"
                          ? "File — chọn tệp trong Postman"
                          : `Text — ${value}`}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-(--muted)">
                    Không tự đặt Content-Type; Postman tạo multipart boundary.
                  </p>
                </div>
              )}
              {row.response_example && (
                <Snippet
                  label="Response thành công minh họa · không phải dữ liệu thật"
                  value={row.response_example}
                />
              )}
              <p className="mt-3 text-xs text-(--muted)">
                Xử lý tại <code>{row.source}</code>. Request ghi dùng cookie
                phiên + X-CSRFToken, trừ API monitor dùng khóa máy chủ.
              </p>
            </div>
          </details>
        ))}
        {!rows.length && <Status>Không có endpoint phù hợp với bộ lọc.</Status>}
      </div>
    </div>
  );
}

export default function ApiDocs() {
  const resource = useResource("/api/manage/api-docs/");
  return (
    <Loading resource={resource} label="Đang tải tài liệu API…">
      {(data) => <Reference data={data} />}
    </Loading>
  );
}
