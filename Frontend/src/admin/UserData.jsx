import { useState } from "react";
import { request, useResource, useAction } from "../core";
import {
  Btn,
  Icon,
  Field,
  Select,
  SidebarTools,
  Status,
  Loading,
  Confirm,
} from "../ui";
import { PracticeModal } from "../practice-workspace";
const labels = {
  name: "Tên",
  title: "Tiêu đề",
  description: "Mô tả",
  parent: "Folde chứa · ID",
  folder: "Folde · ID",
  deck: "Bộ thẻ · ID",
  card: "Thẻ · ID",
  node: "Bài tập · ID",
  language: "Ngôn ngữ",
  kind: "Loại",
  payload: "Nội dung",
  german_text: "Thuật ngữ",
  vietnamese_meaning: "Định nghĩa",
  display_name: "Tên hiển thị",
  bio: "Giới thiệu",
  position: "Vị trí",
  visibility: "Chia sẻ",
  preferences: "Tùy chọn",
  theory_content: "Lý thuyết",
  theory_format: "Định dạng lý thuyết",
};
function RecordEditor({ row, schema, url, onClose, onSaved }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      schema.map((f) => {
        const value =
          row?.values?.[f.name] ??
          f.default ??
          (f.type === "BooleanField"
            ? false
            : f.choices.length
              ? f.choices[0][0]
              : "");
        return [
          f.name,
          f.type === "JSONField"
            ? JSON.stringify(value === "" ? {} : value, null, 2)
            : value,
        ];
      }),
    ),
  );
  const [dirty, setDirty] = useState(() => new Set());
  const updateValue = (name, value) => {
    setValues((previous) => ({ ...previous, [name]: value }));
    setDirty((previous) => new Set([...previous, name]));
  };
  const action = useAction();
  const save = () =>
    action.run(async (signal) => {
      const data = {};
      for (const f of schema) {
        if (row && !dirty.has(f.name)) continue;
        let v = values[f.name];
        if (f.type === "JSONField") {
          try {
            v = JSON.parse(v);
          } catch {
            throw new Error(`${labels[f.name] || f.name}: JSON không hợp lệ.`);
          }
        } else if (
          v === "" &&
          !f.required &&
          (f.type.includes("Integer") ||
            f.type === "ForeignKey" ||
            f.type === "DateTimeField" ||
            f.type === "FloatField")
        )
          v = null;
        else if (
          f.type.includes("Integer") ||
          f.type === "FloatField" ||
          f.type === "ForeignKey"
        )
          v = Number(v);
        data[f.name] = v;
      }
      await request(
        `${url}${row ? `${row.id}/` : ""}`,
        row ? "PATCH" : "POST",
        data,
        signal,
      );
      onSaved();
      onClose();
    });
  return (
    <PracticeModal
      title={row ? `Chỉnh sửa · ${row.label}` : "Thêm dữ liệu"}
      onClose={onClose}
      pending={action.pending}
    >
      <div className="grid gap-4">
        {schema.map((f) =>
          f.type === "BooleanField" ? (
            <label key={f.name} className="check-line">
              <input
                type="checkbox"
                checked={!!values[f.name]}
                onChange={(e) => updateValue(f.name, e.target.checked)}
              />
              {labels[f.name] || f.name}
            </label>
          ) : f.choices.length ? (
            <Select
              key={f.name}
              label={labels[f.name] || f.name}
              value={values[f.name]}
              onChange={(v) => updateValue(f.name, v)}
            >
              {!f.required && <option value="">—</option>}
              {f.choices.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          ) : (
            <Field
              key={f.name}
              label={labels[f.name] || f.name}
              value={values[f.name] ?? ""}
              multiline={f.type === "JSONField" || f.type === "TextField"}
              onChange={(v) => updateValue(f.name, v)}
            />
          ),
        )}
      </div>
      <Status error={action.error} />
      <Btn icon="save" primary isLoading={action.pending} onClick={save}>
        Lưu
      </Btn>
    </PracticeModal>
  );
}
export default function UserData({ user, onClose }) {
  const base = `/api/manage/users/${user.id}/data/`;
  const summary = useResource(base);
  const [kind, setKind] = useState("decks"),
    [page, setPage] = useState(1),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState("");
  const [edit, setEdit] = useState(null),
    [remove, setRemove] = useState(null),
    [purge, setPurge] = useState(false),
    [confirm, setConfirm] = useState("");
  const resource = useResource(
      `${base}${kind}/?page=${page}&q=${encodeURIComponent(search)}`,
    ),
    action = useAction();
  const reload = () => {
    resource.reload();
    summary.reload();
  };
  return (
    <>
      <SidebarTools navOnly>
        <div className="flash-icon-row">
          <Btn icon="undo" onClick={onClose}>
            Về người dùng
          </Btn>
          <Btn icon="refresh" onClick={reload}>
            Cập nhật
          </Btn>
          <Btn
            icon="plus"
            isDisabled={!resource.data?.can_create}
            onClick={() => setEdit({ create: true })}
          >
            Thêm dữ liệu
          </Btn>
          {!user.is_staff && !user.is_superuser && (
            <Btn
              icon="trash"
              onClick={() => {
                setPurge(true);
                setConfirm("");
              }}
            >
              Xóa toàn bộ dữ liệu
            </Btn>
          )}
        </div>
        <Select
          label="Dữ liệu"
          value={kind}
          onChange={(value) => {
            setKind(value);
            setPage(1);
            setQuery("");
            setSearch("");
          }}
        >
          {summary.data?.collections.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label} · {c.count}
            </option>
          ))}
        </Select>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(query);
            setPage(1);
          }}
          className="grid gap-2"
        >
          <Field label="Tìm theo tên" value={query} onChange={setQuery} />
          <Btn icon="search" type="submit">
            Tìm
          </Btn>
        </form>
      </SidebarTools>
      <h1 className="mb-2 text-3xl font-bold">{user.username}</h1>
      <p className="mb-6 text-(--muted)">
        {summary.data?.collections.find((c) => c.key === kind)?.label}
      </p>
      <Status error={summary.error || action.error} />
      <Loading resource={resource}>
        {(data) => (
          <>
            <div className="grid gap-3">
              {data.rows.map((row) => (
                <div
                  key={row.id}
                  className="flex min-w-0 items-center gap-3 rounded-2xl border border-(--line) bg-(--surface) p-4"
                >
                  <Icon name="folder" />
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate">{row.label}</strong>
                    <small>
                      #{row.id}
                      {row.values.language
                        ? ` · ${row.values.language.toUpperCase()}`
                        : ""}
                    </small>
                  </div>
                  <Btn icon="edit" onClick={() => setEdit(row)}>
                    Xem và sửa
                  </Btn>
                  <Btn icon="trash" onClick={() => setRemove(row)}>
                    Xóa
                  </Btn>
                </div>
              ))}
              {!data.rows.length && (
                <p className="py-12 text-center text-(--muted)">
                  Chưa có dữ liệu.
                </p>
              )}
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
                {page} · {data.total} mục
              </span>
              <Btn
                icon="chevron_right"
                isDisabled={page * 25 >= data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Sau
              </Btn>
            </div>
          </>
        )}
      </Loading>
      {edit && resource.data && (
        <RecordEditor
          key={`${kind}:${edit.id || "new"}`}
          row={edit.create ? null : edit}
          schema={resource.data.fields}
          url={`${base}${kind}/`}
          onClose={() => setEdit(null)}
          onSaved={reload}
        />
      )}
      {remove && (
        <Confirm
          title={`Xóa ${remove.label}?`}
          description="Các dữ liệu phụ thuộc mục này cũng có thể bị xóa. Thao tác không thể hoàn tác."
          onClose={() => setRemove(null)}
          onConfirm={async (signal) => {
            await request(
              `${base}${kind}/${remove.id}/`,
              "DELETE",
              undefined,
              signal,
            );
            reload();
          }}
        />
      )}
      {purge && (
        <PracticeModal
          title={`Xóa dữ liệu · ${user.username}`}
          onClose={() => setPurge(false)}
          pending={action.pending}
          size="md"
        >
          <p>
            Xóa toàn bộ folde, bộ thẻ, bài tập, tiến độ, lịch sử học, hồ sơ và
            lớp sở hữu trong cả hai ngôn ngữ. Giữ tài khoản và mật khẩu; đăng
            xuất các phiên hiện tại. Không thể hoàn tác.
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
                await request(base, "DELETE", { confirm }, signal);
                setPurge(false);
                setPage(1);
                reload();
              })
            }
          >
            Xóa toàn bộ dữ liệu
          </Btn>
        </PracticeModal>
      )}
    </>
  );
}
