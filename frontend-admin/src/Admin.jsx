import { useState } from "react";
import Documents from "./Documents";
import { TYPE_LABELS } from "../../frontend-react/src/books";
import { request, useResource, useAction } from "../../frontend-react/src/core";
import {
  Btn,
  Icon,
  Glass,
  Page,
  Heading,
  Status,
  Loading,
  Field,
  Select,
  Editor,
  Link,
} from "../../frontend-react/src/ui";
export default function Admin({ user }) {
  const [tab, setTab] = useState("books"),
    [book, setBook] = useState(null);
  return (
    <div className="admin-shell">
      <header className="topbar">
        <Link className="brand" to="/">
          lernraum. <span className="admin-badge">STUDIO</span>
        </Link>
        <div className="toolbar">
          <Btn
            onClick={() => {
              setTab("books");
              setBook(null);
            }}
          >
            Nội dung sách
          </Btn>
          <Btn onClick={() => setTab("documents")}>Tài liệu</Btn>
          {user.superuser && (
            <Btn onClick={() => setTab("users")}>Người dùng</Btn>
          )}
          <a href="/admin/">Django Admin ↗</a>
        </div>
      </header>
      <main>
        {tab === "documents" ? (
          <Documents />
        ) : tab === "users" && user.superuser ? (
          <Users user={user} />
        ) : book ? (
          <Book key={book} id={book} onBack={() => setBook(null)} />
        ) : (
          <BookList onSelect={setBook} />
        )}
      </main>
    </div>
  );
}
function Users({ user }) {
  const [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [edit, setEdit] = useState(null),
    [refresh, setRefresh] = useState(0);
  const resource = useResource(
    `/api/manage/users/?q=${encodeURIComponent(query)}&page=${page}&refresh=${refresh}`,
  );
  return (
    <Page>
      <Heading
        eyebrow="QUẢN TRỊ TÀI KHOẢN"
        title="Người dùng."
        description="Quản lý thông tin, trạng thái hoạt động và đặt lại mật khẩu."
      />
      <Field
        label="Tìm theo tài khoản hoặc email"
        value={query}
        onChange={(v) => {
          setQuery(v);
          setPage(1);
        }}
      />
      <Loading resource={resource}>
        {(data) => (
          <>
            <div className="section-heading">
              <p>{data.total} tài khoản</p>
              {data.can_add && (
                <Btn primary onClick={() => setEdit({ create: true })}>
                  Tạo người dùng
                </Btn>
              )}
            </div>
            <div className="admin-user-list">
              {data.users.map((u) => (
                <Glass key={u.id}>
                  <div className="history-row">
                    <div>
                      <h3>
                        {u.username} {u.id === user.id ? "· Bạn" : ""}
                      </h3>
                      <p>{u.email || "Chưa có email"}</p>
                      <small>
                        {u.is_superuser
                          ? "Superuser"
                          : u.is_staff
                            ? "Quản trị"
                            : "Người học"}{" "}
                        · {u.is_active ? "Đang hoạt động" : "Đã khóa"}
                      </small>
                    </div>
                    {data.can_edit && (
                      <Btn onClick={() => setEdit(u)}>Quản lý</Btn>
                    )}
                  </div>
                </Glass>
              ))}
            </div>
            <div className="toolbar centered">
              <Btn isDisabled={page <= 1} onClick={() => setPage(page - 1)}>
                ← Trước
              </Btn>
              <span>Trang {page}</span>
              <Btn
                isDisabled={page * 50 >= data.total}
                onClick={() => setPage(page + 1)}
              >
                Sau →
              </Btn>
            </div>
            {edit && (
              <Editor
                title={
                  edit.create ? "Tạo tài khoản" : `Quản lý ${edit.username}`
                }
                fields={[
                  {
                    name: "username",
                    label: "Tên tài khoản",
                    isRequired: true,
                  },
                  { name: "email", label: "Email", type: "email" },
                  {
                    name: "password",
                    label: edit.create
                      ? "Mật khẩu"
                      : "Mật khẩu mới (để trống nếu không đổi)",
                    type: "password",
                    isRequired: !!edit.create,
                    autoComplete: "new-password",
                  },
                ]}
                initial={edit}
                onClose={() => setEdit(null)}
                onSave={async (v, s) => {
                  await request(
                    `/api/manage/users/${edit.create ? "" : edit.id + "/"}`,
                    edit.create ? "POST" : "PATCH",
                    v,
                    s,
                  );
                  setRefresh((n) => n + 1);
                }}
              >
                {(v, set) => (
                  <>
                    {!edit.create && (
                      <label className="check-line">
                        <input
                          type="checkbox"
                          disabled={edit.id === user.id || edit.is_superuser}
                          checked={v.is_active}
                          onChange={(e) =>
                            set({ ...v, is_active: e.target.checked })
                          }
                        />
                        Tài khoản hoạt động
                      </label>
                    )}
                    {!edit.create && data.superuser && (
                      <label className="check-line">
                        <input
                          type="checkbox"
                          disabled={edit.id === user.id || edit.is_superuser}
                          checked={v.is_staff}
                          onChange={(e) =>
                            set({ ...v, is_staff: e.target.checked })
                          }
                        />
                        Cho phép truy cập quản trị (quyền chi tiết đặt trong
                        Django Admin)
                      </label>
                    )}
                  </>
                )}
              </Editor>
            )}
          </>
        )}
      </Loading>
    </Page>
  );
}
function BookList({ onSelect }) {
  const resource = useResource("/api/manage/books/"),
    [creating, setCreating] = useState(false),
    [guide, setGuide] = useState(false);
  return (
    <Page>
      <Heading
        eyebrow="CONTENT STUDIO"
        title="Thư viện trong tay bạn."
        description="Tạo sách, nhập chương và hoàn thiện học liệu. Mọi nội dung được lưu trong database."
        actions={
          <>
            <Btn onClick={() => setGuide(!guide)}>Hướng dẫn & mẫu JSON</Btn>
            <Btn primary onClick={() => setCreating(true)}>
              ＋ Tạo sách mới
            </Btn>
          </>
        }
      />
      {guide && <JsonGuide />}
      <Loading resource={resource}>
        {(data) => (
          <div className="deck-grid admin-book-grid">
            {data.books.map((b) => (
              <button
                key={b.id}
                onClick={() => onSelect(b.id)}
                className="deck-link text-left"
              >
                <Glass className="deck-tile">
                  <div className="tile-top">
                    <Icon name="book" size={28} />
                    <span className="pill">{b.language.toUpperCase()}</span>
                  </div>
                  <h3>{b.title}</h3>
                  <p>
                    {b.chapter_count} chương · {b.asset_count} tài nguyên
                  </p>
                  <span>Quản lý nội dung →</span>
                </Glass>
              </button>
            ))}
            {!data.books.length && (
              <Glass>
                <h2>Bắt đầu thư viện mới</h2>
                <p>
                  Tạo sách đầu tiên, sau đó tải lên các chương dưới dạng JSON.
                </p>
              </Glass>
            )}
          </div>
        )}
      </Loading>
      {creating && (
        <Editor
          title="Tạo sách mới"
          fields={[
            { name: "title", label: "Tên sách", isRequired: true },
            { name: "author", label: "Tác giả" },
            { name: "description", label: "Giới thiệu", multiline: true },
          ]}
          initial={{ language: "en", level: "" }}
          onClose={() => setCreating(false)}
          onSave={async (v, s) => {
            const r = await request("/api/manage/books/", "POST", v, s);
            onSelect(r.id);
          }}
        >
          {(v, set) => (
            <div className="grid two">
              <Select
                label="Ngôn ngữ"
                value={v.language}
                onChange={(language) => set({ ...v, language })}
              >
                <option value="en">Tiếng Anh</option>
                <option value="de">Tiếng Đức</option>
              </Select>
              <Select
                label="Trình độ (tùy chọn)"
                value={v.level}
                onChange={(level) => set({ ...v, level })}
              >
                <option value="">Không phân cấp</option>
                {["A1", "A2", "B1", "B2", "C1", "C2"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </Select>
            </div>
          )}
        </Editor>
      )}
    </Page>
  );
}
function JsonGuide() {
  const resource = useResource("/api/manage/json-template/");
  return (
    <Glass className="json-guide">
      <h2>Số hóa một lần. Dùng cho nhiều sách.</h2>
      <ol>
        <li>Tạo sách và chọn ngôn ngữ.</li>
        <li>Tải mẫu JSON, nhân bản thành một tệp cho mỗi chương.</li>
        <li>Giữ mã bài ổn định. Thêm chương mới bằng số chương mới.</li>
        <li>
          Tải các JSON trong mục “Thêm chương / JSON”, kiểm tra bản xem trước
          rồi xác nhận.
        </li>
        <li>Tải ảnh/audio vào đúng đường dẫn đã khai báo trong JSON.</li>
      </ol>
      <div className="toolbar">
        <a
          className="download-template"
          href="/api/manage/json-template/"
          download
        >
          Tải mẫu JSON đầy đủ ↓
        </a>
      </div>
      <details>
        <summary>Quy ước cần nhớ</summary>
        <p>
          schema_version: 1. chapter.number xác định chương. exercises[].id xác
          định bài trong chương. Nhập lại cùng mã sẽ cập nhật bài đó; các bài
          khác vẫn được giữ.
        </p>
        <p>
          type: fill_blank / single_choice / multiple_choice / matching /
          wordset / order / free_text. Câu có thể khai báo type riêng để trộn
          nhiều dạng trong một bài.
        </p>
        <p>
          answer là chuỗi hoặc danh sách phương án thay thế. Với multiple_choice
          và wordset, danh sách là toàn bộ đáp án cần có. Với order, danh sách
          là thứ tự id trong tokens. Mỗi ô trong blanks có answer riêng; text
          dùng ký hiệu {"{{1}}"}, {"{{2}}"}…
        </p>
        <p>
          free_text dùng answer: null và grading.mode: manual.
          grading.ignore_case và ignore_punctuation là tùy chọn chấm. Bài thiếu
          đáp án hoặc đáp án không phù hợp sẽ được đánh dấu để rà soát.
        </p>
        <p>
          resources dùng type image hoặc audio, file như images/U01.png. Không
          dùng đường dẫn máy tính hoặc đường dẫn có “..”. Ảnh/audio được tải
          riêng; không nhúng dữ liệu tệp vào JSON.
        </p>
        <p>
          Ngôn ngữ book.language phải khớp sách đang chọn. Mỗi lượt tối đa 20
          JSON, 5 MB/tệp và 20 MB tổng. Có thể xóa thư mục nguồn sau khi đã
          nhập; khi triển khai chỉ cần database, media và mã ứng dụng.
        </p>
      </details>
      <details>
        <summary>Xem mẫu JSON</summary>
        <Loading resource={resource}>
          {(data) => (
            <pre className="json-sample">{JSON.stringify(data, null, 2)}</pre>
          )}
        </Loading>
      </details>
    </Glass>
  );
}
function JsonImport({ id, reload }) {
  const [files, setFiles] = useState([]),
    [preview, setPreview] = useState(null),
    [documents, setDocuments] = useState([]),
    [dirty, setDirty] = useState(false),
    [done, setDone] = useState(null),
    [rawEdit, setRawEdit] = useState(null);
  const action = useAction();
  const validate = async (signal) => {
    let payload;
    if (preview) {
      payload = { documents };
    } else {
      payload = new FormData();
      files.forEach((f) => payload.append("files", f));
    }
    const response = await request(
      `/api/manage/books/${id}/json/preview/`,
      "POST",
      payload,
      signal,
    );
    setPreview(response);
    setDocuments(response.documents);
    setDirty(false);
    setDone(null);
  };
  const changeType = (d, e, type) => {
    setDocuments((docs) =>
      docs.map((doc, i) =>
        i === d
          ? {
              ...doc,
              exercises: doc.exercises.map((x, j) =>
                j === e
                  ? {
                      ...x,
                      type,
                      items: (x.items || []).map(
                        ({ type: oldType, ...item }) => item,
                      ),
                    }
                  : x,
              ),
            }
          : doc,
      ),
    );
    setDirty(true);
  };
  return (
    <Glass className="bulk-upload">
      <h2>Nhập chương & chuẩn hóa bài tập</h2>
      <p>
        Chọn tệp, kiểm tra cách phân loại rồi nhập. Bài chưa rõ sẽ được lưu nháp
        để biên tập, chưa xuất hiện ở trang học.
      </p>
      <input
        aria-label="Chọn các tệp JSON"
        type="file"
        multiple
        accept=".json,application/json"
        disabled={action.pending}
        onChange={(e) => {
          setFiles(Array.from(e.target.files));
          setPreview(null);
          setDone(null);
          setDirty(false);
        }}
      />
      <p>{files.length} tệp đã chọn</p>
      <Btn
        primary
        isDisabled={!files.length && !preview}
        isLoading={action.pending}
        onClick={() => action.run(validate)}
      >
        {preview ? "Kiểm tra lại thay đổi" : "Kiểm tra & xem trước"}
      </Btn>
      {preview && (
        <div className="import-review">
          <h3>Bản xem trước</h3>
          {preview.chapters.map((c, d) => (
            <section key={d} className="import-chapter">
              <div className="book-list-toolbar">
                <div>
                  <h3>
                    Chương {c.number}: {c.title}
                  </h3>
                  <p>
                    {c.action} · {c.exercises} bài · {c.drafts} bài cần biên tập
                  </p>
                </div>
                <Btn
                  onClick={() =>
                    setRawEdit({
                      index: d,
                      json: JSON.stringify(documents[d], null, 2),
                    })
                  }
                >
                  Sửa JSON chương
                </Btn>
              </div>
              {c.classification.map((r, e) => (
                <div className="classification-row" key={e}>
                  <div>
                    <strong>{r.id}</strong>
                    <small>
                      {r.needs_review ? "Nháp · cần kiểm tra" : "Đã nhận diện"}{" "}
                      · nguồn: {r.source_type}
                    </small>
                    {r.warnings.length > 0 && (
                      <details>
                        <summary>{r.warnings.length} lưu ý</summary>
                        {r.warnings.map((w, i) => (
                          <p key={i}>{w}</p>
                        ))}
                      </details>
                    )}
                  </div>
                  <Select
                    label={`Loại bài ${r.id}`}
                    value={documents[d]?.exercises[e]?.type || r.source_type}
                    onChange={(type) => changeType(d, e, type)}
                  >
                    {!TYPE_LABELS[documents[d]?.exercises[e]?.type] && (
                      <option value={documents[d]?.exercises[e]?.type}>
                        {r.source_type} → {TYPE_LABELS[r.type]}
                      </option>
                    )}
                    {Object.entries(TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
            </section>
          ))}
          {dirty && (
            <Status>
              Bạn đã sửa nội dung. Bấm “Kiểm tra lại thay đổi” trước khi nhập.
            </Status>
          )}
          <div className="toolbar">
            <Btn onClick={() => setPreview(null)} isDisabled={action.pending}>
              Chọn lại tệp
            </Btn>
            <Btn
              primary
              isDisabled={dirty}
              isLoading={action.pending}
              onClick={() =>
                action.run(async (signal) => {
                  const r = await request(
                    `/api/manage/books/${id}/json/confirm/`,
                    "POST",
                    { token: preview.token },
                    signal,
                  );
                  setDone(r);
                  setPreview(null);
                  setFiles([]);
                  reload();
                })
              }
            >
              Xác nhận nhập {preview.chapters.length} chương
            </Btn>
          </div>
        </div>
      )}
      <Status error={action.error}>
        {done
          ? `Đã nhập ${done.chapters} chương, cập nhật ${done.updated} bài. ${done.drafts || 0} bài ở trạng thái nháp.`
          : null}
      </Status>
      <details>
        <summary>Hướng dẫn nhập nhanh</summary>
        <JsonGuide />
      </details>
      {rawEdit && (
        <Editor
          title="Sửa JSON trước khi nhập"
          initial={{ json: rawEdit.json }}
          fields={[
            {
              name: "json",
              label: "Nội dung chương",
              multiline: true,
              minRows: 20,
            },
          ]}
          onClose={() => setRawEdit(null)}
          onSave={async (value) => {
            let doc;
            try {
              doc = JSON.parse(value.json);
            } catch (e) {
              throw new Error("JSON chưa đúng cú pháp: " + e.message);
            }
            if (
              !doc ||
              typeof doc !== "object" ||
              !Array.isArray(doc.exercises)
            )
              throw new Error(
                "Chương cần đối tượng JSON với danh sách exercises.",
              );
            setDocuments((docs) =>
              docs.map((d, i) => (i === rawEdit.index ? doc : d)),
            );
            setDirty(true);
          }}
        />
      )}
    </Glass>
  );
}
function Book({ id, onBack }) {
  const resource = useResource(`/api/manage/books/${id}/`, true);
  return (
    <Loading resource={resource}>
      {(data) => (
        <BookContent {...{ data, id, onBack, reload: resource.reload }} />
      )}
    </Loading>
  );
}
function BookContent({ data, id, onBack, reload }) {
  const [tab, setTab] = useState(data.chapters.length ? "media" : "import"),
    [query, setQuery] = useState(""),
    [chapter, setChapter] = useState("all"),
    [onlyMissing, setOnlyMissing] = useState(false),
    [edit, setEdit] = useState(null);
  return (
    <Page>
      <Btn onClick={onBack}>← Thư viện quản trị</Btn>
      <Heading
        eyebrow="BIÊN TẬP SÁCH"
        title={data.book.title}
        actions={
          <Btn onClick={() => setEdit({ type: "book", initial: data.book })}>
            Thông tin sách
          </Btn>
        }
      />
      <div className="stats-strip">
        <div>
          <strong>{data.chapters.length}</strong>
          <span>Chương</span>
        </div>
        <div>
          <strong>{data.exercises.length}</strong>
          <span>Bài tập</span>
        </div>
        <div>
          <strong>{data.resources.filter((r) => !r.uploaded).length}</strong>
          <span>Tệp còn thiếu</span>
        </div>
      </div>
      <div className="folder-tabs">
        {[
          ["import", "Thêm chương / JSON"],
          ["media", "Hình ảnh & âm thanh"],
          ["exercises", "Nội dung bài tập"],
          ["theory", "Lý thuyết"],
        ].map(([key, label]) => (
          <button
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
            key={key}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "import" ? (
        <JsonImport {...{ id, reload }} />
      ) : tab === "media" ? (
        <>
          <BulkUpload {...{ id, resources: data.resources, reload }} />
          <div className="toolbar">
            <Field
              label="Tìm tên tài nguyên"
              value={query}
              onChange={setQuery}
            />
            <label className="check-line">
              <input
                type="checkbox"
                checked={onlyMissing}
                onChange={(e) => setOnlyMissing(e.target.checked)}
              />
              Chỉ hiện tệp còn thiếu
            </label>
          </div>
          <div className="resource-grid">
            {data.resources
              .filter(
                (r) =>
                  (!onlyMissing || !r.uploaded) &&
                  r.file.toLowerCase().includes(query.toLowerCase()),
              )
              .map((r) => (
                <Glass key={r.file}>
                  {r.uploaded ? (
                    r.type === "image" ? (
                      <img
                        className="resource-preview"
                        src={r.url}
                        alt={r.description || r.file}
                      />
                    ) : (
                      <audio controls preload="none" src={r.url} />
                    )
                  ) : (
                    <div className="missing-resource">
                      <Icon
                        name={r.type === "audio" ? "sound" : "book"}
                        size={30}
                      />
                      <span>
                        Chưa có {r.type === "audio" ? "âm thanh" : "hình ảnh"}
                      </span>
                    </div>
                  )}
                  <strong className="resource-key">{r.file}</strong>
                  <small>
                    {r.uses.slice(0, 3).join(" · ")}
                    {r.uses.length > 3
                      ? ` và ${r.uses.length - 3} vị trí khác`
                      : ""}
                  </small>
                  <span className="pill">
                    {r.uploaded ? "Đã cập nhật" : "Cần tải lên"}
                  </span>
                </Glass>
              ))}
          </div>
        </>
      ) : tab === "exercises" ? (
        <>
          <div className="toolbar">
            <Field label="Tìm bài tập" value={query} onChange={setQuery} />
            <Select label="Chương" value={chapter} onChange={setChapter}>
              <option value="all">Tất cả chương</option>
              {data.chapters.map((c) => (
                <option key={c.id} value={c.number}>
                  {c.number}. {c.title}
                </option>
              ))}
            </Select>
          </div>
          {data.exercises
            .filter(
              (e) =>
                (chapter === "all" || String(e.chapter) === chapter) &&
                `${e.number} ${e.title}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
            )
            .map((e) => (
              <Glass key={e.id} className="admin-exercise">
                <div className="history-row">
                  <div>
                    <small>
                      CHƯƠNG {e.chapter} · {e.number} ·{" "}
                      {TYPE_LABELS[e.type] || e.type} ·{" "}
                      {e.published ? "Đã xuất bản" : "Nháp · cần kiểm tra"}
                    </small>
                    <h3>{e.title}</h3>
                    <small>{e.manual ? "Chấm thủ công" : "Tự động chấm"}</small>
                    {e.warnings.length > 0 && (
                      <details>
                        <summary>
                          {e.warnings.length} điểm cần đối chiếu
                        </summary>
                        {e.warnings.map((w, i) => (
                          <p key={i}>{w}</p>
                        ))}
                      </details>
                    )}
                  </div>
                  <Btn onClick={() => setEdit({ type: "exercise", id: e.id })}>
                    Biên tập
                  </Btn>
                </div>
              </Glass>
            ))}
        </>
      ) : (
        data.chapters.map((c) => (
          <div className="history-row" key={c.id}>
            <span>
              {c.number}. {c.title}
            </span>
            <Btn
              onClick={() =>
                setEdit({
                  type: "chapter",
                  id: c.id,
                  initial: {
                    title: c.title,
                    json: JSON.stringify(c.theory, null, 2),
                  },
                })
              }
            >
              Sửa lý thuyết
            </Btn>
          </div>
        ))
      )}
      {edit?.type === "exercise" ? (
        <ExerciseEditor
          id={edit.id}
          onClose={() => setEdit(null)}
          reload={reload}
        />
      ) : (
        edit && (
          <Editor
            title={
              edit.type === "book" ? "Thông tin sách" : "Biên tập lý thuyết"
            }
            initial={edit.initial}
            fields={
              edit.type === "book"
                ? [
                    { name: "title", label: "Tên sách", isRequired: true },
                    { name: "author", label: "Tác giả" },
                    { name: "description", label: "Mô tả", multiline: true },
                  ]
                : [
                    { name: "title", label: "Tên chương", isRequired: true },
                    {
                      name: "json",
                      label: "Nội dung lý thuyết (JSON)",
                      multiline: true,
                      minRows: 14,
                    },
                  ]
            }
            onClose={() => setEdit(null)}
            onSave={async (v, s) => {
              await request(
                `/api/manage/${edit.type === "book" ? `books/${id}` : `chapters/${edit.id}`}/`,
                "PATCH",
                edit.type === "book"
                  ? v
                  : { title: v.title, theory: JSON.parse(v.json) },
                s,
              );
              reload();
            }}
          />
        )
      )}
    </Page>
  );
}
function ExerciseEditor({ id, onClose, reload }) {
  const resource = useResource(`/api/manage/exercises/${id}/`);
  return (
    <Loading resource={resource}>
      {(data) => (
        <Editor
          title="Biên tập nội dung bài"
          initial={{
            ...data.source,
            items: (data.source.items || []).map((item) => ({
              ...item,
              blanks: item.blanks?.map((b) =>
                typeof b === "string" ? { answer: b } : b,
              ),
            })),
          }}
          fields={[
            { name: "title", label: "Tiêu đề bài" },
            {
              name: "instruction",
              label: "Hướng dẫn",
              multiline: true,
              isRequired: true,
            },
            { name: "content", label: "Đoạn văn / ngữ cảnh", multiline: true },
            {
              name: "image",
              label: "Đường dẫn ảnh (ví dụ images/U01.png)",
              advanced: true,
            },
            {
              name: "audio",
              label: "Đường dẫn âm thanh (ví dụ audio/U01.mp3)",
              advanced: true,
            },
          ]}
          onClose={onClose}
          onSave={async (v, s) => {
            await request(
              `/api/manage/exercises/${id}/`,
              "PATCH",
              { source: v },
              s,
            );
            reload();
          }}
        >
          {(values, set) => (
            <div className="item-editor">
              <Select
                label="Loại bài (áp dụng cho tất cả câu)"
                value={values.type}
                onChange={(type) =>
                  set({
                    ...values,
                    type,
                    items: (values.items || []).map(
                      ({ type: oldType, ...item }) => item,
                    ),
                  })
                }
              >
                {!TYPE_LABELS[values.type] && (
                  <option value={values.type}>
                    {values.type} · tên loại nguồn
                  </option>
                )}
                {Object.entries(TYPE_LABELS).map(([id, label]) => (
                  <option value={id} key={id}>
                    {label}
                  </option>
                ))}
              </Select>
              <p>
                Mỗi dòng đáp án là một cách trả lời được chấp nhận. Bài chọn
                nhiều dùng các dòng làm tập đáp án cần chọn.
              </p>
              {(values.items || []).map((item, i) => {
                const update = (key, value) =>
                  set({
                    ...values,
                    items: values.items.map((x, j) =>
                      i === j ? { ...x, [key]: value } : x,
                    ),
                  });
                const format = (a) =>
                  Array.isArray(a)
                    ? a.join("\n")
                    : a == null
                      ? ""
                      : typeof a === "object"
                        ? JSON.stringify(a)
                        : String(a);
                const parse = (v) =>
                  v.includes("\n") ? v.split("\n").filter(Boolean) : v || null;
                return (
                  <details key={i} open={i === 0}>
                    <summary>Câu {i + 1}</summary>
                    <Field
                      label="Nội dung câu hỏi"
                      multiline
                      value={item.text ?? item.question ?? ""}
                      onChange={(v) =>
                        update("text" in item ? "text" : "question", v)
                      }
                    />
                    {item.blanks?.length &&
                    item.blanks.every((b) => b && typeof b === "object") ? (
                      item.blanks.map((b, j) => (
                        <Field
                          key={j}
                          multiline
                          label={`Đáp án ô ${j + 1}`}
                          value={format(b.answer)}
                          onChange={(v) =>
                            update(
                              "blanks",
                              item.blanks.map((x, k) =>
                                j === k ? { ...x, answer: parse(v) } : x,
                              ),
                            )
                          }
                        />
                      ))
                    ) : (
                      <Field
                        multiline
                        label="Đáp án"
                        value={format(item.answer)}
                        onChange={(v) => update("answer", parse(v))}
                      />
                    )}
                    {(item.options || []).map((option, j) => (
                      <Field
                        key={j}
                        label={`Lựa chọn ${typeof option === "object" ? option.id || j + 1 : j + 1}`}
                        value={
                          typeof option === "object" ? option.text : option
                        }
                        onChange={(v) =>
                          update(
                            "options",
                            item.options.map((o, k) =>
                              k === j
                                ? typeof o === "object"
                                  ? { ...o, text: v }
                                  : v
                                : o,
                            ),
                          )
                        }
                      />
                    ))}
                    {item.options?.length > 0 && (
                      <small>
                        Đáp án dùng mã lựa chọn (nếu có), hoặc nguyên văn lựa
                        chọn.
                      </small>
                    )}
                  </details>
                );
              })}
            </div>
          )}
        </Editor>
      )}
    </Loading>
  );
}
function BulkUpload({ id, resources, reload }) {
  const [rows, setRows] = useState([]),
    [result, setResult] = useState(""),
    action = useAction();
  const pick = (files) => {
    const list = Array.from(files);
    if (list.length > 20) {
      action.setError("Chọn tối đa 20 tệp mỗi lượt.");
      return;
    }
    setResult("");
    setRows(
      list.map((file) => {
        const matches = resources.filter(
          (r) =>
            r.file.split("/").pop().toLowerCase() === file.name.toLowerCase(),
        );
        return {
          file,
          key:
            matches.length === 1
              ? matches[0].file
              : `${file.type.startsWith("audio/") ? "audio" : "images"}/${file.name}`,
          description: matches.length === 1 ? matches[0].description : "",
          matched: matches.length === 1,
        };
      }),
    );
  };
  const change = (i, key, value) =>
    setRows(rows.map((r, n) => (n === i ? { ...r, [key]: value } : r)));
  return (
    <Glass className="bulk-upload">
      <h2>Tải tài nguyên hàng loạt</h2>
      <p>
        Chọn tối đa 20 tệp, mỗi tệp 10 MB; tổng 50 MB. Tên trùng được ghép tự
        động. Kiểm tra đường dẫn trước khi tải; tệp đã có sẽ được thay thế.
      </p>
      <label className="upload-zone">
        <Icon name="plus" size={30} />
        <strong>Chọn hình ảnh hoặc âm thanh</strong>
        <span>PNG, JPG, WEBP, GIF · MP3, WAV, OGG, M4A, WEBM</span>
        <input
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.webp,.gif,.mp3,.wav,.ogg,.m4a,.webm"
          onChange={(e) => pick(e.target.files)}
          disabled={action.pending}
        />
      </label>
      {rows.map((r, i) => (
        <div className="upload-row" key={i}>
          <div>
            <strong>{r.file.name}</strong>
            <small>
              {(r.file.size / 1024 / 1024).toFixed(2)} MB ·{" "}
              {r.matched ? "Đã ghép tên" : "Kiểm tra đường dẫn"}
            </small>
          </div>
          <Field
            label="Đường dẫn đích"
            value={r.key}
            onChange={(v) => change(i, "key", v)}
          />
          <Field
            label="Mô tả / văn bản thay thế"
            value={r.description}
            onChange={(v) => change(i, "description", v)}
          />
          <Btn
            onClick={() => setRows(rows.filter((_, n) => n !== i))}
            isDisabled={action.pending}
          >
            Bỏ
          </Btn>
        </div>
      ))}
      {rows.length > 0 && (
        <Btn
          primary
          isLoading={action.pending}
          onClick={() =>
            action.run(async (s) => {
              const form = new FormData();
              rows.forEach((r) => form.append("files", r.file));
              form.append("keys", JSON.stringify(rows.map((r) => r.key)));
              form.append(
                "descriptions",
                JSON.stringify(rows.map((r) => r.description)),
              );
              const r = await request(
                `/api/manage/books/${id}/assets/`,
                "POST",
                form,
                s,
              );
              setResult(`Đã cập nhật ${r.uploaded} tài nguyên.`);
              setRows([]);
              reload();
            })
          }
        >
          Xác nhận tải {rows.length} tệp
        </Btn>
      )}
      <Status error={action.error}>{result}</Status>
    </Glass>
  );
}
