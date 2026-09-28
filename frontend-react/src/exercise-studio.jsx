import { PracticeModal, PracticeTree } from "./practice-workspace";
import { useEffect, useState } from "react";
import { endpoint, useResource, useAction, request, navigate } from "./core";
import {
  Page,
  SidebarTools,
  Heading,
  Btn,
  Field,
  Link,
  Select,
  Status,
} from "./ui";
import { PracticeLibrary } from "./practice-library";
import { PracticeTextEditor } from "./practice-text-editor";
import { PracticeActivity } from "./practice-activity";
import { TheoryActivity } from "./practice-theory";
import { previewData } from "./exercise-types";
import {
  ownedPracticeNodes,
  folderItems,
  practiceRoutes,
} from "./practice-navigation";

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
  const [toolsOpen, setToolsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);
  const [folderName, setFolderName] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [theory, setTheory] = useState(null);
  const [notice, setNotice] = useState("");
  const parent = create
    ? nodes.find((n) => n.id === Number(parentId) && n.kind === "folder")?.id ||
      null
    : current?.kind === "folder"
      ? current.id
      : current?.parent || null;
  useEffect(() => {
    setEditing(edit);
    setRemoving(false);
    setFolderName(null);
    setTheory(null);
    setQuery("");
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
  const saveText = (items) =>
    action.run(async (signal) => {
      if (editing && current?.kind === "exercise") {
        if (items.length !== 1)
          throw new Error("Khi sửa một bài, tệp cần đúng một khối BAI.");
        const item = items[0];
        await request(
          `${base}${current.id}/`,
          "PATCH",
          {
            title: item.title,
            payload: { ...current.payload, ...item.payload },
          },
          signal,
        );
        setEditing(false);
        setNotice("Đã cập nhật bài tập.");
        refresh();
        navigate(`${routes.studio}/${current.id}`);
      } else {
        const response = await request(
          endpoint(lang, "practice-hub/import/"),
          "POST",
          { nodes: items, parent },
          signal,
        );
        setNotice(`Đã tạo ${response.created.length} bài tập.`);
        refresh();
        navigate(`${routes.studio}/${parent || ""}`);
      }
    });
  return (
    <Page>
      <SidebarTools navOnly>
        <div className="studio-navigation">
          <nav className="studio-shortcuts" aria-label="Điều hướng Create">
            <Link to={routes.learn}>← Practice Hub · vào học</Link>
            <Link to={routes.explore}>Explore · khám phá bài học</Link>
            <Link to={routes.studio}>Nội dung của tôi</Link>
            <Link to={routes.guide}>Hướng dẫn tạo bài .txt</Link>
          </nav>
          <Status error={resource.error || action.error} />
          {notice && <p role="status">{notice}</p>}
          <div className="studio-nav-heading">
            <strong>Nội dung của tôi</strong>
            <button
              type="button"
              className="tree-icon"
              aria-label="Công cụ nội dung"
              onClick={() => setToolsOpen(true)}
            >
              ＋
            </button>
          </div>
          <Field label="Tìm nội dung" value={query} onChange={setQuery} />
          <PracticeTree
            nodes={nodes}
            base={routes.studio}
            currentId={id}
            query={query}
            pending={action.pending}
            onSettings={(node) => {
              navigate(`${routes.studio}/${node.id}`);
              setToolsOpen(true);
            }}
            onMove={(ids, parent) => organize({ action: "move", ids, parent })}
          />
          <Btn onClick={() => setToolsOpen(true)}>Quản lý nội dung</Btn>
        </div>
      </SidebarTools>
      {toolsOpen && (
        <PracticeModal
          title={current ? `Tùy chọn · ${current.title}` : "Quản lý nội dung"}
          pending={action.pending}
          onClose={() => setToolsOpen(false)}
        >
          <Status error={action.error} />
          {!create && !editing && !theory && (
            <div className="studio-actions">
              <Btn
                primary
                onClick={() =>
                  setToolsOpen(false) ||
                  navigate(
                    `${routes.create}${parent ? `?parent=${parent}` : ""}`,
                  )
                }
              >
                Nhập bài từ .txt
              </Btn>
              <Btn onClick={() => setFolderName("")}>Tạo thư mục</Btn>
            </div>
          )}
          {(create || editing || theory) && (
            <Btn
              isDisabled={action.pending}
              onClick={() => {
                if (create) navigate(`${routes.studio}/${parent || ""}`);
                else {
                  setEditing(false);
                  setTheory(null);
                }
              }}
            >
              Đóng bản soạn
            </Btn>
          )}
          {folderName !== null && (
            <div className="studio-folder-name">
              <Field
                label="Tên thư mục mới"
                value={folderName}
                onChange={setFolderName}
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === "Escape") setFolderName(null);
                }}
              />
              <Btn
                primary
                isDisabled={!folderName.trim() || action.pending}
                onClick={() =>
                  action.run(async (signal) => {
                    const result = await request(
                      base,
                      "POST",
                      { kind: "folder", title: folderName, parent },
                      signal,
                    );
                    setFolderName(null);
                    refresh();
                    navigate(`${routes.studio}/${result.node.id}`);
                  })
                }
              >
                Tạo thư mục
              </Btn>
              <Btn onClick={() => setFolderName(null)}>Hủy</Btn>
            </div>
          )}
          {current && !create && !editing && !theory && (
            <section className="studio-selected">
              <h3>{current.title}</h3>
              {current.kind !== "folder" && (
                <Btn
                  onClick={() =>
                    current.kind === "exercise"
                      ? (setToolsOpen(false), setEditing(true))
                      : (setToolsOpen(false), setTheory({ ...current.payload }))
                  }
                >
                  Sửa nội dung
                </Btn>
              )}
              <Select
                label="Ai có thể học?"
                value={current.visibility}
                disabled={action.pending}
                onChange={(visibility) =>
                  action.run(async (signal) => {
                    await request(
                      `${base}${current.id}/`,
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
              <Btn onClick={() => setRemoving(true)}>Xóa nội dung</Btn>
              {removing && (
                <div className="sidebar-confirm" role="alert">
                  <p>
                    Xóa “{current.title}”
                    {current.kind === "folder"
                      ? " và toàn bộ nội dung bên trong"
                      : ""}
                    ? Thao tác không thể hoàn tác.
                  </p>
                  <Btn
                    isDisabled={action.pending}
                    onClick={() =>
                      action.run(async (signal) => {
                        await request(
                          `${base}${current.id}/`,
                          "DELETE",
                          undefined,
                          signal,
                        );
                        setRemoving(false);
                        refresh();
                        navigate(`${routes.studio}/${current.parent || ""}`);
                      })
                    }
                  >
                    Xác nhận xóa
                  </Btn>
                  <Btn onClick={() => setRemoving(false)}>Giữ lại</Btn>
                </div>
              )}
            </section>
          )}
          {theory && (
            <>
              <Select
                label="Định dạng"
                value={theory.format || "markdown"}
                onChange={(format) => setTheory((v) => ({ ...v, format }))}
              >
                <option value="markdown">Markdown</option>
                <option value="html">HTML</option>
              </Select>
              <Btn
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
                    setTheory(null);
                    refresh();
                  })
                }
              >
                Lưu nội dung
              </Btn>
            </>
          )}
          {!create && !editing && !theory && (
            <>
              <Field
                label="Tìm nội dung của tôi"
                value={query}
                onChange={setQuery}
              />
              {parent && (
                <Link
                  to={`${routes.studio}/${nodes.find((n) => n.id === parent)?.parent || ""}`}
                >
                  ↑ Thư mục phía trên
                </Link>
              )}
              <PracticeLibrary
                items={folderItems(nodes, parent, query)}
                nodes={nodes}
                lang={lang}
                parent={parent}
                pending={action.pending}
                searching={Boolean(query)}
                onOrganize={organize}
                onRename={(node, title) =>
                  action.run(async (signal) => {
                    await request(
                      `${base}${node.id}/`,
                      "PATCH",
                      { title },
                      signal,
                    );
                    refresh();
                    return true;
                  })
                }
                onEdit={(node) => {
                  setToolsOpen(false);
                  navigate(`${routes.studio}/${node.id}/edit`);
                }}
              />
            </>
          )}
        </PracticeModal>
      )}
      {resource.loading && !resource.data ? (
        <Status>Đang mở Create…</Status>
      ) : create || (editing && current?.kind === "exercise") ? (
        <PracticeTextEditor
          key={create ? `new:${parent}` : `edit:${current.id}`}
          lang={lang}
          exercise={
            editing ? { ...current.payload, title: current.title } : undefined
          }
          pending={action.pending}
          onApply={saveText}
        />
      ) : theory ? (
        <section className="studio-content">
          <Heading title={current.title} />
          <Field
            label="Nội dung lý thuyết"
            multiline
            rows={24}
            value={theory.content || ""}
            onChange={(content) => setTheory((v) => ({ ...v, content }))}
          />
        </section>
      ) : current?.kind === "exercise" ? (
        <section className="studio-content">
          <Heading title={current.title} description="Nội dung xem trước" />
          <PracticeActivity
            key={`${current.id}:${current.updated_at}`}
            data={previewData(current.payload)}
            preview
          />
        </section>
      ) : current?.kind === "theory" ? (
        <>
          <Heading title={current.title} />
          <TheoryActivity payload={current.payload} />
        </>
      ) : (
        <section className="studio-welcome">
          <span aria-hidden="true">✍️</span>
          <h1>{current?.title || "Create"}</h1>
          <p>
            {current
              ? "Chọn một bài trong thanh bên để xem nội dung."
              : "Tạo nội dung học tập từ tệp .txt với 7 dạng bài và các kiểu tương tác đã có sẵn."}
          </p>
          <p>
            Công cụ nhập, chỉnh sửa và sắp xếp nằm trong thanh điều hướng bên
            cạnh.
          </p>
          {id && !current && !resource.loading && (
            <Status>
              Nội dung không tồn tại hoặc không thuộc sở hữu của bạn.
            </Status>
          )}
        </section>
      )}
    </Page>
  );
}
