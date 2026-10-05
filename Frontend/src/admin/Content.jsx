import { useState } from "react";
import { request, useResource, useAction } from "../core";
import { Btn, Field, Select, Loading, Status } from "../ui";
import { PracticeModal } from "../practice-workspace";
import { ExerciseForm, prepareExercise } from "../exercise-authoring";
import { EXERCISE_TYPES, newExercise, previewData } from "../exercise-types";
import { PracticeActivity } from "../practice-activity";
import { TheoryActivity } from "../practice-theory";
import { MediaEditor } from "../exercise-media";
import { ActionDialog, Pagination, dateText } from "./shared";

const kindNames = {
  folder: "Thư mục",
  exercise: "Bài tập",
  theory: "Lý thuyết",
};

function ContentEditor({ initial, folders, onClose, onSaved }) {
  const [value, setValue] = useState({
      ...initial,
      payload:
        initial.kind === "exercise"
          ? {
              ...initial.payload,
              title: initial.title || initial.payload.title,
            }
          : initial.payload,
    }),
    [preview, setPreview] = useState(false),
    [dirty, setDirty] = useState(false),
    [discard, setDiscard] = useState(false);
  const action = useAction();
  const [tags, setTags] = useState((initial.payload.tags || []).join(", "));
  const [mediaBusy, setMediaBusy] = useState(false);
  const change = (patch) => {
    setValue((v) => ({ ...v, ...patch }));
    setDirty(true);
  };
  const close = () => (dirty ? setDiscard(true) : onClose());
  const upload = (file, done) =>
    action.run(async (signal) => {
      const form = new FormData();
      form.append("file", file);
      const url = value.id
        ? `/api/manage/content/${value.id}/media/`
        : `/api/${value.language}/practice-hub/media/`;
      const { media } = await request(url, "POST", form, signal);
      done(media.url);
      setValue((previous) => ({
        ...previous,
        payload: {
          ...previous.payload,
          attachments: [...(previous.payload.attachments || []), media],
        },
      }));
      setDirty(true);
    });
  const save = () =>
    action.run(async (signal) => {
      const payload =
        value.kind === "exercise"
          ? prepareExercise(value.payload)
          : value.kind === "folder"
            ? {
                ...value.payload,
                tags: value.parent
                  ? []
                  : tags
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
              }
            : value.payload;
      const data = {
        title: value.kind === "exercise" ? payload.title : value.title,
        parent: value.parent || null,
        payload,
      };
      if (value.id) data.version = value.version;
      else
        Object.assign(data, {
          kind: value.kind,
          language: value.language,
          visibility: "private",
        });
      await request(
        `/api/manage/content/${value.id ? `${value.id}/` : ""}`,
        value.id ? "PATCH" : "POST",
        data,
        signal,
      );
      onSaved();
      onClose();
    });
  const availableFolders = folders.filter(
    (f) => !f.language || f.language === value.language,
  );
  return (
    <>
      <PracticeModal
        title={
          value.id
            ? `Biên tập · ${initial.title}`
            : `Tạo ${kindNames[value.kind].toLowerCase()}`
        }
        onClose={close}
        pending={action.pending || mediaBusy}
        size="5xl"
      >
        <div className="grid gap-4">
          <p className="text-sm text-(--muted)">
            {value.id
              ? `Chủ nội dung: ${value.owner.username}. Giữ nguyên quyền sở hữu khi biên tập.`
              : "Nội dung mới được lưu riêng tư. Công bố sau khi kiểm tra bài."}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Ngôn ngữ"
              value={value.language}
              disabled={
                Boolean(value.id) ||
                mediaBusy ||
                Boolean(value.payload.attachments?.length)
              }
              onChange={(language) => change({ language, parent: null })}
            >
              <option value="en">Tiếng Anh</option>
              <option value="de">Tiếng Đức</option>
            </Select>
            <Select
              label="Thư mục chứa"
              value={value.parent || ""}
              onChange={(parent) =>
                change({ parent: parent ? Number(parent) : null })
              }
            >
              <option value="">
                {value.kind === "exercise"
                  ? "Chọn thư mục (bắt buộc)"
                  : "Không có — mục gốc"}
              </option>
              {availableFolders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title} · #{f.id}
                </option>
              ))}
            </Select>
          </div>
          {value.kind === "exercise" && !availableFolders.length && (
            <Status error="Hãy tạo thư mục cùng ngôn ngữ trước khi thêm bài tập." />
          )}
          {value.kind !== "exercise" && (
            <Field
              label="Tiêu đề"
              value={value.title}
              onChange={(title) => change({ title })}
              maxLength={200}
              isRequired
            />
          )}
          {value.kind === "folder" && (
            <Field
              label="Thẻ tìm kiếm · phân cách bằng dấu phẩy"
              value={tags}
              onChange={(text) => {
                setTags(text);
                setDirty(true);
              }}
              description="Thẻ tìm kiếm chỉ áp dụng cho thư mục gốc."
              isDisabled={Boolean(value.parent)}
            />
          )}
          {value.kind === "theory" && (
            <>
              <Select
                label="Định dạng"
                value={value.payload.format || "markdown"}
                onChange={(format) =>
                  change({ payload: { ...value.payload, format } })
                }
              >
                <option value="markdown">Markdown</option>
                <option value="html">HTML</option>
              </Select>
              <Field
                label="Nội dung lý thuyết"
                multiline
                rows={12}
                value={value.payload.content || ""}
                onChange={(content) =>
                  change({ payload: { ...value.payload, content } })
                }
              />
            </>
          )}
          {value.kind === "exercise" && (
            <>
              <ExerciseForm
                exercise={value.payload}
                onChange={(patch) =>
                  change({ payload: { ...value.payload, ...patch } })
                }
                onUpload={upload}
              />
              <MediaEditor
                items={value.payload.attachments || []}
                questions={value.payload.questions}
                lang={value.language}
                disabled={action.pending}
                onBusy={setMediaBusy}
                uploadUrl={
                  value.id
                    ? `/api/manage/content/${value.id}/media/`
                    : undefined
                }
                onChange={(attachments) =>
                  change({ payload: { ...value.payload, attachments } })
                }
              />
            </>
          )}
          <Status error={action.error} />
          <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 rounded-xl bg-(--surface) p-3">
            <Btn isDisabled={action.pending || mediaBusy} onClick={close}>
              Hủy
            </Btn>
            {value.kind !== "folder" && (
              <Btn onClick={() => setPreview((v) => !v)}>
                {preview ? "Đóng xem trước" : "Xem trước"}
              </Btn>
            )}
            <Btn
              primary
              isLoading={action.pending}
              isDisabled={
                mediaBusy || (value.kind === "exercise" && !value.parent)
              }
              onClick={save}
            >
              Lưu nội dung
            </Btn>
          </div>
          {preview &&
            (value.kind === "theory" ? (
              <TheoryActivity payload={value.payload} />
            ) : (
              <PracticeActivity
                key={JSON.stringify(value.payload)}
                data={previewData(value.payload)}
                preview
                lang={value.language}
              />
            ))}
        </div>
      </PracticeModal>
      {discard && (
        <ActionDialog
          title="Bỏ thay đổi chưa lưu?"
          description="Những thay đổi trong lần biên tập này chưa được lưu."
          reasonRequired={false}
          label="Bỏ thay đổi"
          onClose={() => setDiscard(false)}
          onConfirm={onClose}
        />
      )}
    </>
  );
}

function EditorLoader({ item, onClose, onSaved }) {
  const resource = useResource(
    item.id
      ? `/api/manage/content/${item.id}/`
      : "/api/manage/content/?options=folders",
  );
  if (!resource.data)
    return (
      <PracticeModal title="Mở nội dung" onClose={onClose}>
        <Loading label="Đang tải dữ liệu quản trị…" resource={resource}>
          {() => null}
        </Loading>
      </PracticeModal>
    );
  return (
    <ContentEditor
      initial={item.id ? resource.data : item}
      folders={item.id ? resource.data.folders : resource.data.rows}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

export default function Content() {
  const [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [language, setLanguage] = useState(""),
    [kind, setKind] = useState(""),
    [visibility, setVisibility] = useState(""),
    [source, setSource] = useState(""),
    [page, setPage] = useState(1);
  const [edit, setEdit] = useState(null),
    [operation, setOperation] = useState(null),
    [cascade, setCascade] = useState(false),
    [notice, setNotice] = useState(""),
    [creating, setCreating] = useState(false),
    [mode, setMode] = useState("short_answer");
  const resource = useResource(
    `/api/manage/content/?q=${encodeURIComponent(search)}&language=${language}&kind=${kind}&visibility=${visibility}&source=${source}&page=${page}`,
  );
  const filter = (setter) => (value) => {
    setter(value);
    setPage(1);
  };
  const refreshed = () => {
    resource.reload();
    setNotice("Đã cập nhật nội dung.");
  };
  const create = (kind) => {
    setCreating(false);
    setEdit({
      kind,
      title: "",
      language: language || "en",
      parent: null,
      payload:
        kind === "exercise"
          ? newExercise(mode)
          : kind === "theory"
            ? { format: "markdown", content: "" }
            : {},
    });
  };
  return (
    <>
      <div className="mb-3 flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Thư viện nội dung</h2>
          <p className="mt-1 text-sm text-(--muted)">
            Biên tập bài học, xem trước và quản lý trạng thái công khai.
          </p>
        </div>
        <div className="flex gap-2">
          <Btn onClick={resource.reload}>Làm mới</Btn>
          <Btn primary onClick={() => setCreating(true)}>
            Tạo nội dung
          </Btn>
        </div>
      </div>
      <form
        className="my-5 grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(query);
          setPage(1);
        }}
      >
        <Field
          label="Tiêu đề hoặc chủ nội dung"
          value={query}
          onChange={setQuery}
        />
        <Select
          label="Ngôn ngữ"
          value={language}
          onChange={filter(setLanguage)}
        >
          <option value="">Tất cả ngôn ngữ</option>
          <option value="en">Tiếng Anh</option>
          <option value="de">Tiếng Đức</option>
        </Select>
        <Select label="Loại nội dung" value={kind} onChange={filter(setKind)}>
          <option value="">Tất cả loại</option>
          {Object.entries(kindNames).map(([k, v]) => (
            <option value={k} key={k}>
              {v}
            </option>
          ))}
        </Select>
        <Select
          label="Trạng thái"
          value={visibility}
          onChange={filter(setVisibility)}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="private">Riêng tư / chưa công bố</option>
          <option value="public">Công khai</option>
        </Select>
        <Select label="Nguồn" value={source} onChange={filter(setSource)}>
          <option value="">Tất cả nguồn</option>
          <option value="system">Admin / Staff</option>
          <option value="users">Người dùng</option>
          <option value="mine">Của tôi</option>
        </Select>
        <Btn type="submit" primary>
          Tìm kiếm
        </Btn>
      </form>
      <Status>{notice}</Status>
      <Loading label="Đang tải dữ liệu quản trị…" resource={resource}>
        {(d) => (
          <>
            <div className="grid gap-3">
              {d.rows.map((n) => (
                <article
                  key={n.id}
                  className="rounded-2xl border border-(--line) bg-(--surface) p-5"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-(--muted)">
                        {kindNames[n.kind]} · {n.language.toUpperCase()} ·{" "}
                        {n.system ? "Admin / Staff" : "Người dùng"}
                      </p>
                      <h3 className="my-1 break-words text-lg font-bold">
                        {n.title}
                      </h3>
                      <p className="text-sm text-(--muted)">
                        {n.owner.username} · {n.parent_title || "Mục gốc"} ·{" "}
                        {dateText(n.updated_at)}
                      </p>
                    </div>
                    <span className="h-fit rounded-full border border-(--line) px-3 py-1 text-xs">
                      {n.visibility === "public" ? "Công khai" : "Riêng tư"}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Btn primary onClick={() => setEdit(n)}>
                      Biên tập & xem trước
                    </Btn>
                    <Btn
                      onClick={() => {
                        setCascade(false);
                        setOperation({ n, kind: "visibility" });
                      }}
                    >
                      {n.visibility === "public"
                        ? "Ẩn khỏi công khai"
                        : "Công bố"}
                    </Btn>
                    <Btn onClick={() => setOperation({ n, kind: "delete" })}>
                      Xóa nội dung
                    </Btn>
                  </div>
                </article>
              ))}
              {!d.rows.length && (
                <div className="py-12 text-center">
                  <p>Không có nội dung phù hợp.</p>
                  <Btn
                    onClick={() => {
                      setQuery("");
                      setSearch("");
                      setKind("");
                      setLanguage("");
                      setVisibility("");
                      setSource("");
                      setPage(1);
                    }}
                  >
                    Xóa bộ lọc
                  </Btn>
                </div>
              )}
            </div>
            <Pagination page={page} total={d.total} onChange={setPage} />
          </>
        )}
      </Loading>
      {creating && (
        <PracticeModal
          title="Tạo nội dung"
          onClose={() => setCreating(false)}
          size="md"
        >
          <p>
            Nội dung sẽ thuộc tài khoản của bạn. Tạo thư mục trước để sắp xếp
            bài tập.
          </p>
          <div className="my-3 flex flex-wrap gap-2">
            <Btn onClick={() => create("folder")}>Thư mục</Btn>
            <Btn onClick={() => create("theory")}>Lý thuyết</Btn>
          </div>
          <Select label="Dạng bài tập" value={mode} onChange={setMode}>
            {EXERCISE_TYPES.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
          <Btn primary onClick={() => create("exercise")}>
            Tạo bài tập
          </Btn>
        </PracticeModal>
      )}
      {edit && (
        <EditorLoader
          key={edit.id || `new-${edit.kind}`}
          item={edit}
          onClose={() => setEdit(null)}
          onSaved={refreshed}
        />
      )}
      {operation && (
        <ActionDialog
          title={`${operation.kind === "delete" ? "Xóa" : operation.n.visibility === "public" ? "Ẩn" : "Công bố"} · ${operation.n.title}`}
          description={
            operation.kind === "delete"
              ? "Xóa vĩnh viễn nội dung, các mục con và dữ liệu học liên quan. Không thể hoàn tác."
              : "Công khai cho phép người học truy cập. Ẩn khỏi công khai vẫn giữ quyền truy cập của chủ nội dung và lớp đã được giao bài."
          }
          confirmText={
            operation.kind === "delete" ? operation.n.title : undefined
          }
          onClose={() => setOperation(null)}
          onConfirm={async (values, signal) => {
            await request(
              `/api/manage/content/${operation.n.id}/`,
              operation.kind === "delete" ? "DELETE" : "PATCH",
              {
                ...(operation.kind === "delete"
                  ? values
                  : { reason: values.reason }),
                version: operation.n.version,
                ...(operation.kind === "visibility"
                  ? {
                      visibility:
                        operation.n.visibility === "public"
                          ? "private"
                          : "public",
                      cascade,
                    }
                  : {}),
              },
              signal,
            );
            refreshed();
          }}
        >
          {operation.kind === "visibility" && operation.n.kind === "folder" && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={cascade}
                onChange={(e) => setCascade(e.target.checked)}
              />
              Áp dụng cho toàn bộ nội dung trong thư mục
            </label>
          )}
        </ActionDialog>
      )}
    </>
  );
}
