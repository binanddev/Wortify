import { ExerciseMediaDialog } from "./exercise-media";
import { PracticeModal } from "./practice-workspace";
import { useEffect, useState } from "react";
import {
  endpoint,
  useResource,
  useAction,
  request,
  navigate,
  readPreference,
  savePreference,
} from "./core";
import {
  Page,
  SidebarTools,
  Heading,
  Btn,
  Field,
  Link,
  Select,
  Status,
  Icon,
} from "./ui";
import { PracticeLibrary } from "./practice-library";
import { PracticeTextEditor } from "./practice-text-editor";
import { PracticeActivity } from "./practice-activity";
import { TheoryActivity } from "./practice-theory";
import { previewData } from "./exercise-types";
import { ownedPracticeNodes, practiceRoutes } from "./practice-navigation";

export function ExerciseStudio({
  lang,
  id,
  create = false,
  parentId = null,
  edit = false,
}) {
  const routes = practiceRoutes(lang);
  const base = endpoint(lang, "practice-hub/nodes/");
  const resource = useResource(`${base}?full=1`, true);
  const action = useAction();
  const nodes = ownedPracticeNodes(resource.data?.nodes || []);
  const current = nodes.find((node) => String(node.id) === String(id));
  const roots = nodes.filter((node) => node.kind === "folder" && !node.parent);
  const parent = create
    ? nodes.find(
        (node) => node.id === Number(parentId) && node.kind === "folder",
      )?.id || null
    : current?.kind === "folder"
      ? current.id
      : current?.parent || null;
  const [addTarget, setAddTarget] = useState(null);
  const [previewId, setPreviewId] = useState(null);
  const preview = nodes.find((node) => node.id === previewId);
  const [view, setView] = useState(() =>
    readPreference(`wortify:create-view:${lang}`, "grid") === "list"
      ? "list"
      : "grid",
  );
  const [query, setQuery] = useState("");
  const [choosingFolder, setChoosingFolder] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [folderDraft, setFolderDraft] = useState(null);
  const [settingId, setSettingId] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [theory, setTheory] = useState(null);
  const [notice, setNotice] = useState("");
  const setting = nodes.find((node) => node.id === settingId);
  useEffect(() => {
    setQuery("");
    setTheory(null);
  }, [id, create, edit]);
  useEffect(() => {
    if (edit && current?.kind === "theory") setTheory({ ...current.payload });
  }, [edit, current?.id]);
  const refresh = () => resource.reload();
  const organize = (values) =>
    action.run(async (signal) => {
      await request(
        endpoint(lang, "practice-hub/organize/"),
        "POST",
        values,
        signal,
      );
      refresh();
      return true;
    });
  const rename = (node, title) =>
    action.run(async (signal) => {
      await request(`${base}${node.id}/`, "PATCH", { title }, signal);
      refresh();
      return true;
    });
  const startCreate = () =>
    parent
      ? navigate(`${routes.create}?parent=${parent}`)
      : setChoosingFolder(true);
  const openSettings = (node) => {
    setRemoving(false);
    setSettingId(node.id);
  };
  const saveText = (items) =>
    action.run(async (signal) => {
      if (edit && current?.kind === "exercise") {
        if (items.length !== 1)
          throw new Error("Khi sửa một bài, tệp cần đúng một khối EXERCISE.");
        await request(
          `${base}${current.id}/`,
          "PATCH",
          {
            title: items[0].title,
            payload: { ...current.payload, ...items[0].payload },
          },
          signal,
        );
        setNotice("Đã cập nhật bài tập.");
        refresh();
        navigate(`${routes.studio}/${current.id}`);
      } else {
        if (!parent) throw new Error("Chọn folde trước khi lưu.");
        const result = await request(
          endpoint(lang, "practice-hub/import/"),
          "POST",
          { nodes: items, parent },
          signal,
        );
        setNotice(`Đã tạo ${result.created.length} bài tập.`);
        refresh();
        navigate(`${routes.studio}/${parent}`);
      }
    });
  const browsing = !create && !edit && (!current || current.kind === "folder");
  const items = (
    current?.kind === "folder"
      ? nodes.filter((node) => node.parent === current.id)
      : roots
  ).filter((node) =>
    node.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const ancestors = [];
  let ancestor = nodes.find(
    (node) =>
      node.id === (current?.kind === "folder" ? current.parent : parent),
  );
  const seen = new Set();
  while (ancestor && !seen.has(ancestor.id)) {
    seen.add(ancestor.id);
    ancestors.unshift(ancestor);
    ancestor = nodes.find((node) => node.id === ancestor.parent);
  }
  return (
    <Page>
      <SidebarTools navOnly>
        <div className="studio-navigation">
          <nav className="studio-nav-shortcuts" aria-label="Create tools">
            <Link
              className={`studio-nav-icon ${!current && !create ? "active" : ""}`}
              to={routes.studio}
              title="My Exercise Library"
              aria-label="My Exercise Library"
              aria-current={!current && !create ? "page" : undefined}
            >
              <Icon name="home" size={23} />
            </Link>
            <Link
              className="studio-nav-icon"
              to={routes.guide}
              title="Hướng dẫn và mẫu .txt"
              aria-label="Hướng dẫn và mẫu .txt"
            >
              <Icon name="book" size={23} />
            </Link>
          </nav>
          {(create || edit) && (
            <>
              <div className="rounded-xl border border-(--line) p-3">
                <small>Folde</small>
                <strong className="mt-1 block">
                  {nodes.find((node) => node.id === parent)?.title ||
                    "Chưa chọn"}
                </strong>
              </div>
              <Btn
                isIconOnly
                title="Đóng bản soạn"
                aria-label="Đóng bản soạn"
                isDisabled={action.pending}
                onClick={() =>
                  navigate(`${routes.studio}/${current?.id || parent || ""}`)
                }
              >
                <Icon name="logout" />
              </Btn>
            </>
          )}
        </div>
      </SidebarTools>
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        {(current || create) && (
          <nav
            aria-label="Vị trí folde"
            className="flex flex-wrap items-center gap-2 text-sm text-(--muted)"
          >
            <Link
              to={routes.studio}
              title="My Exercise Library"
              aria-label="My Exercise Library"
            >
              <Icon name="home" />
            </Link>
            {ancestors.map((node) => (
              <span key={node.id} className="inline-flex items-center gap-2">
                <span>/</span>
                <Link to={`${routes.studio}/${node.id}`}>{node.title}</Link>
              </span>
            ))}
            <span>/</span>
            <span aria-current="page" className="font-semibold text-(--ink)">
              {create ? "Tạo bài tập" : current?.title}
            </span>
          </nav>
        )}
        <Status error={resource.error || action.error} />
        {notice && (
          <p role="status" className="rounded-xl bg-(--surface) p-3">
            {notice}
          </p>
        )}
        {resource.loading && !resource.data ? (
          <Status>Đang mở Create…</Status>
        ) : id && !current && !create ? (
          <Status>
            Nội dung không tồn tại hoặc không thuộc sở hữu của bạn.
          </Status>
        ) : browsing ? (
          <>
            <header className="flex flex-wrap items-start justify-between gap-4">
              <Heading title={current?.title || "My Exercise Library"} />
              <div className="flex gap-2">
                {[
                  ["grid", "Dạng lưới"],
                  ["list", "Dạng danh sách"],
                ].map(([mode, label]) => (
                  <Btn
                    key={mode}
                    isIconOnly
                    title={label}
                    aria-label={label}
                    aria-pressed={view === mode}
                    onClick={() => {
                      setView(mode);
                      savePreference(`wortify:create-view:${lang}`, mode);
                    }}
                  >
                    <Icon name={mode} />
                  </Btn>
                ))}
                <Btn
                  primary
                  isIconOnly
                  title="Thêm"
                  aria-label="Thêm bài tập hoặc folde"
                  onClick={() => setAddTarget({ parent })}
                >
                  <Icon name="plus" />
                </Btn>
                {current && (
                  <Btn
                    isIconOnly
                    title="Tùy chọn"
                    aria-label="Tùy chọn folde"
                    onClick={() => openSettings(current)}
                  >
                    <Icon name="settings" />
                  </Btn>
                )}
              </div>
            </header>
            <Field
              aria-label="Tìm kiếm"
              placeholder={current ? "Tìm trong folde…" : "Tìm folde…"}
              value={query}
              onChange={setQuery}
              startContent={<Icon name="search" />}
            />
            <PracticeLibrary
              key={current?.id || "roots"}
              items={items}
              view={view}
              onPreview={(node) => setPreviewId(node.id)}
              nodes={nodes}
              lang={lang}
              parent={parent}
              pending={action.pending}
              searching={Boolean(query.trim())}
              error={action.error}
              onOrganize={organize}
              onRename={rename}
              onEdit={(node) => navigate(`${routes.studio}/${node.id}/edit`)}
              onSettings={openSettings}
              onCreate={(node) => setAddTarget({ parent: node.id })}
            />
          </>
        ) : (create && parent) || (edit && current?.kind === "exercise") ? (
          <PracticeTextEditor
            key={create ? `new:${parent}` : `edit:${current.id}`}
            lang={lang}
            exercise={
              edit ? { ...current.payload, title: current.title } : undefined
            }
            pending={action.pending}
            onApply={saveText}
          />
        ) : theory ? (
          <>
            <Heading title={`Sửa · ${current.title}`} />
            <div className="flex flex-wrap gap-3">
              <Select
                label="Định dạng"
                value={theory.format || "markdown"}
                onChange={(format) =>
                  setTheory((value) => ({ ...value, format }))
                }
              >
                <option value="markdown">Markdown</option>
                <option value="html">HTML</option>
              </Select>
              <Btn
                icon="save"
                primary
                isLoading={action.pending}
                onClick={() =>
                  action.run(async (signal) => {
                    await request(
                      `${base}${current.id}/`,
                      "PATCH",
                      { payload: theory },
                      signal,
                    );
                    refresh();
                    navigate(`${routes.studio}/${current.id}`);
                  })
                }
              >
                Lưu nội dung
              </Btn>
            </div>
            <Field
              label="Nội dung lý thuyết"
              multiline
              rows={24}
              value={theory.content || ""}
              onChange={(content) =>
                setTheory((value) => ({ ...value, content }))
              }
            />
          </>
        ) : current && current.kind !== "folder" ? (
          <>
            <header className="flex flex-wrap items-start justify-between gap-4">
              <Heading title={current.title} />
              <div className="flex gap-2">
                <Btn
                  primary
                  isIconOnly
                  title="Sửa nội dung"
                  aria-label="Sửa nội dung"
                  onClick={() =>
                    navigate(`${routes.studio}/${current.id}/edit`)
                  }
                >
                  <Icon name="edit" />
                </Btn>
                <Btn
                  isIconOnly
                  title="Tùy chọn nội dung"
                  aria-label="Tùy chọn nội dung"
                  onClick={() => openSettings(current)}
                >
                  <Icon name="settings" />
                </Btn>
              </div>
            </header>
            {current.kind === "exercise" ? (
              <PracticeActivity
                key={`${current.id}:${current.updated_at}`}
                data={previewData(current.payload)}
                preview
              />
            ) : (
              <TheoryActivity payload={current.payload} />
            )}
          </>
        ) : null}
      </section>
      {current?.kind === "exercise" && !edit && (
        <SidebarTools navOnly>
          <Btn icon="image" onClick={() => setMediaOpen(true)}>
            Quản lý MP3 và hình ảnh
          </Btn>
        </SidebarTools>
      )}
      {mediaOpen && current?.kind === "exercise" && (
        <ExerciseMediaDialog
          node={current}
          lang={lang}
          onClose={() => setMediaOpen(false)}
          onSaved={refresh}
        />
      )}
      {preview && (
        <PracticeModal title={preview.title} onClose={() => setPreviewId(null)}>
          <div className="flex justify-end">
            <Btn
              icon="edit"
              onClick={() => {
                setPreviewId(null);
                navigate(`${routes.studio}/${preview.id}/edit`);
              }}
            >
              Sửa nội dung
            </Btn>
          </div>
          {preview.kind === "exercise" ? (
            <PracticeActivity
              key={`${preview.id}:${preview.updated_at}`}
              preview
              data={previewData(preview.payload)}
            />
          ) : (
            <TheoryActivity payload={preview.payload} />
          )}
        </PracticeModal>
      )}
      {addTarget && (
        <PracticeModal title="Thêm" onClose={() => setAddTarget(null)}>
          <div className="grid gap-2">
            <Btn
              onClick={() => {
                const target = addTarget.parent;
                setAddTarget(null);
                target
                  ? navigate(`${routes.create}?parent=${target}`)
                  : startCreate();
              }}
            >
              <span className="create-type-icon exercise">
                <Icon name="exercise" />
              </span>
              Bài tập từ .txt
            </Btn>
            <Btn
              onClick={() => {
                setFolderDraft({ title: "", parent: addTarget.parent });
                setAddTarget(null);
              }}
            >
              <span className="create-type-icon folder">
                <Icon name="folder" />
              </span>
              Folde mới
            </Btn>
          </div>
        </PracticeModal>
      )}
      {(choosingFolder || (create && !parent && !resource.loading)) &&
        !folderDraft && (
          <PracticeModal
            title="Thêm vào folde"
            onClose={() => {
              setChoosingFolder(false);
              if (create) navigate(routes.studio);
            }}
          >
            <p>Chọn folde nhận nội dung.</p>
            {roots.map((node) => (
              <Btn
                key={node.id}
                onClick={() => {
                  setChoosingFolder(false);
                  navigate(`${routes.create}?parent=${node.id}`);
                }}
              >
                <span className="create-type-icon folder">
                  <Icon name="folder" />
                </span>
                {node.title}
              </Btn>
            ))}
            <Btn
              onClick={() => {
                setChoosingFolder(false);
                setFolderDraft({ title: "", parent: null });
              }}
            >
              Folde mới
            </Btn>
          </PracticeModal>
        )}
      {folderDraft && (
        <PracticeModal
          title="Folde mới"
          pending={action.pending}
          onClose={() => setFolderDraft(null)}
        >
          <Status error={action.error} />
          <Field
            label="Tên folde"
            autoFocus
            maxLength={200}
            placeholder="Ví dụ: Thì hiện tại đơn"
            value={folderDraft.title}
            onChange={(title) =>
              setFolderDraft((value) => ({ ...value, title }))
            }
          />
          {!folderDraft.parent && (
            <Field
              label="Tags"
              placeholder="grammar, present simple, A1"
              value={folderDraft.tags || ""}
              onChange={(tags) =>
                setFolderDraft((value) => ({ ...value, tags }))
              }
              description="Tối đa 12 tag, ngăn cách bằng dấu phẩy."
            />
          )}
          <Btn
            primary
            isDisabled={!folderDraft.title.trim() || action.pending}
            onClick={() =>
              action.run(async (signal) => {
                const result = await request(
                  base,
                  "POST",
                  {
                    kind: "folder",
                    title: folderDraft.title.trim(),
                    parent: folderDraft.parent,
                    tags: (folderDraft.tags || "")
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  },
                  signal,
                );
                setFolderDraft(null);
                refresh();
                navigate(`${routes.studio}/${result.node.id}`);
              })
            }
          >
            Tạo folde
          </Btn>
        </PracticeModal>
      )}
      {setting && (
        <PracticeModal
          title={`Tùy chọn · ${setting.title}`}
          pending={action.pending}
          onClose={() => setSettingId(null)}
        >
          <Status error={action.error} />
          <Select
            label="Ai có thể học?"
            value={setting.visibility}
            disabled={action.pending}
            onChange={(visibility) =>
              action.run(async (signal) => {
                await request(
                  `${base}${setting.id}/`,
                  "PATCH",
                  { visibility },
                  signal,
                );
                refresh();
              })
            }
          >
            <option value="private">Riêng tư</option>
            <option value="public">Công khai</option>
          </Select>
          {setting.kind === "folder" && !setting.parent && (
            <FolderTags
              key={setting.id}
              node={setting}
              pending={action.pending}
              onSave={(tags) =>
                action.run(async (signal) => {
                  await request(
                    `${base}${setting.id}/`,
                    "PATCH",
                    { tags },
                    signal,
                  );
                  refresh();
                })
              }
            />
          )}
          {!removing ? (
            <Btn onClick={() => setRemoving(true)}>
              Xóa {setting.kind === "folder" ? "folde" : "nội dung"}
            </Btn>
          ) : (
            <div role="alert">
              <p>
                Xóa “{setting.title}”
                {setting.kind === "folder"
                  ? " và toàn bộ nội dung bên trong"
                  : ""}
                ? Thao tác không thể hoàn tác.
              </p>
              <div className="mt-4 flex gap-3">
                <Btn
                  isDisabled={action.pending}
                  onClick={() =>
                    action.run(async (signal) => {
                      const removed = setting;
                      await request(
                        `${base}${removed.id}/`,
                        "DELETE",
                        undefined,
                        signal,
                      );
                      setSettingId(null);
                      setRemoving(false);
                      refresh();
                      if (current?.id === removed.id)
                        navigate(`${routes.studio}/${removed.parent || ""}`);
                    })
                  }
                >
                  Xác nhận xóa
                </Btn>
                <Btn onClick={() => setRemoving(false)}>Giữ lại</Btn>
              </div>
            </div>
          )}
        </PracticeModal>
      )}
    </Page>
  );
}

function FolderTags({ node, pending, onSave }) {
  const [value, setValue] = useState((node.tags || []).join(", "));
  return (
    <div className="flex items-end gap-2">
      <div className="min-w-0 flex-1">
        <Field
          label="Tags"
          value={value}
          onChange={setValue}
          placeholder="grammar, present simple, A1"
          description="Tối đa 12 tag, mỗi tag 40 ký tự. Ngăn cách bằng dấu phẩy."
        />
      </div>
      <Btn
        icon="save"
        isLoading={pending}
        onClick={() =>
          onSave(
            value
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
          )
        }
      >
        Lưu tag
      </Btn>
    </div>
  );
}
