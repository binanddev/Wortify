import { PracticeTree, PracticeModal } from "./practice-workspace";
import { useState } from "react";
import { useResource, endpoint, readPreference, savePreference } from "./core";
import {
  Page,
  Heading,
  SidebarTools,
  Field,
  Link,
  Status,
  Btn,
  Icon,
} from "./ui";
import { PracticeActivity } from "./practice-activity";
import { TheoryActivity } from "./practice-theory";
import { useLearningSync } from "./learning-sync";
import { previewData } from "./exercise-types";
import {
  supportedPracticeNodes,
  practiceRoutes,
  workspaceNodes,
  workspaceRoot,
  workspaceRoots,
  toggleWorkspaceRoot,
  catalogRoots,
} from "./practice-navigation";

export function PracticeHub({ lang, id, userId, sound }) {
  const resource = useResource(
    endpoint(lang, "practice-hub/nodes/?full=1"),
    true,
  );
  const sync = useLearningSync(userId, lang);
  const workspaceKey = `wortify:practice-workspace:${userId}:${lang}`;
  const [pinned, setPinned] = useState(() => {
    const value = readPreference(workspaceKey, []);
    return Array.isArray(value) ? value : [];
  });
  const [previewId, setPreviewId] = useState(null);
  const [setting, setSetting] = useState(null);
  const [catalogQuery, setCatalogQuery] = useState("");
  const all = id === "all";
  const togglePin = (node) =>
    setPinned((previous) => {
      const next = toggleWorkspaceRoot(nodes, previous, node.id);
      savePreference(workspaceKey, next);
      return next;
    });
  const [query, setQuery] = useState("");
  const [progress, setProgress] = useState({});
  const nodes = supportedPracticeNodes(resource.data?.nodes || []).map(
    (node) => {
      const key = `${node.id}:${node.updated_at}`;
      const local =
        progress[key] ||
        readPreference(
          `wortify:practice-progress:${userId}:${lang}:hub-${key}`,
          [],
        );
      return {
        ...node,
        progress: {
          completed: [
            ...new Set([
              ...(node.progress?.completed || []),
              ...(Array.isArray(local) ? local : []),
            ]),
          ],
        },
      };
    },
  );
  const current = nodes.find((node) => String(node.id) === String(id));
  const workspace = workspaceNodes(nodes, pinned);
  const catalog = catalogRoots(nodes, catalogQuery);
  const roots = workspaceRoots(nodes, pinned);
  const isPinned = (node) => roots.includes(workspaceRoot(nodes, node.id)?.id);
  const preview = nodes.find((node) => node.id === previewId);
  return (
    <Page>
      <SidebarTools navOnly>
        <div className="learning-navigation">
          <div className="workspace-search">
            <Field label="Tìm bài để học" value={query} onChange={setQuery} />
          </div>
          <div className="flex justify-start">
            <Link
              to={`${practiceRoutes(lang).learn}/all`}
              className="workspace-browse"
              title="Kho bài tập của bạn"
              aria-label="Kho bài tập của bạn"
            >
              <Icon name="home" size={22} />
            </Link>
          </div>
          <Status error={resource.error} />
          <nav aria-label="Danh sách bài học">
            <PracticeTree
              compact={false}
              nodes={workspace}
              base={practiceRoutes(lang).learn}
              currentId={id}
              query={query}
              onSettings={setSetting}
            />
          </nav>
          {!resource.loading && !workspace.length && (
            <p>
              Thêm thư mục hoặc bài học từ “Kho bài tập của bạn” vào workspace
              của bạn.
            </p>
          )}
          {current?.links?.length > 0 && (
            <div className="learning-related">
              <h3>Học tiếp</h3>
              {current.links.map((target) => {
                const node = nodes.find((n) => n.id === target);
                return (
                  node && (
                    <Link
                      key={target}
                      to={`${practiceRoutes(lang).learn}/${target}`}
                    >
                      {node.title}
                    </Link>
                  )
                );
              })}
            </div>
          )}
        </div>
      </SidebarTools>
      {current?.kind === "exercise" && <Status error={sync.error} />}
      {preview && (
        <PracticeModal title={preview.title} onClose={() => setPreviewId(null)}>
          <div className="flex flex-wrap items-center gap-3">
            {nodes.some((node) => node.id === preview.parent) && (
              <Btn onClick={() => setPreviewId(preview.parent)}>
                ← Thư mục cha
              </Btn>
            )}
            <Btn
              isIconOnly
              title={
                isPinned(preview) ? "Bỏ khỏi workspace" : "Thêm vào workspace"
              }
              aria-label={
                isPinned(preview) ? "Bỏ khỏi workspace" : "Thêm vào workspace"
              }
              onClick={() => togglePin(preview)}
            >
              <Icon name={isPinned(preview) ? "check" : "plus"} />
            </Btn>
            <Link
              className="btn primary"
              to={`${practiceRoutes(lang).learn}/${preview.id}`}
              onClick={() => setPreviewId(null)}
            >
              Vào học
            </Link>
          </div>
          <p className="text-sm text-(--muted)">
            Xem thử nội dung; tiến độ học của bạn không thay đổi.
          </p>
          {preview.kind === "folder" ? (
            <div className="grid gap-2">
              {nodes
                .filter((node) => node.parent === preview.id)
                .map((node) => (
                  <button
                    type="button"
                    key={node.id}
                    className="flex items-center gap-3 rounded-xl border border-(--line) p-4 text-left font-semibold hover:bg-(--surface)"
                    onClick={() => setPreviewId(node.id)}
                  >
                    <Icon
                      name={
                        node.kind === "folder"
                          ? "folder"
                          : node.kind === "exercise"
                            ? "exercise"
                            : "book"
                      }
                    />
                    {node.title}
                  </button>
                ))}
              {!nodes.some((node) => node.parent === preview.id) && (
                <p>Chưa có nội dung bạn có thể xem trong thư mục này.</p>
              )}
            </div>
          ) : preview.kind === "exercise" ? (
            <PracticeActivity
              key={preview.id}
              preview
              data={previewData(preview.payload)}
              sound={sound}
            />
          ) : (
            <TheoryActivity payload={preview.payload} />
          )}
        </PracticeModal>
      )}
      {setting && (
        <PracticeModal title={setting.title} onClose={() => setSetting(null)}>
          <p>
            {isPinned(setting)
              ? "Bỏ thư mục gốc khỏi workspace sẽ không xóa nội dung hoặc tiến độ học."
              : "Thêm thư mục gốc chứa nội dung này vào workspace."}
          </p>
          <Btn
            onClick={() => {
              togglePin(setting);
              setSetting(null);
            }}
          >
            {isPinned(setting) ? "Bỏ khỏi workspace" : "Thêm vào workspace"}
          </Btn>
        </PracticeModal>
      )}
      {resource.loading && !resource.data ? (
        <Status>Đang mở góc học của bạn…</Status>
      ) : all ? (
        <section className="practice-catalog">
          <Heading
            title="Kho bài tập của bạn"
            description="Các thư mục gốc chứa bài tập bạn có quyền xem. Mở thẻ để xem trước nội dung."
          />
          <Field
            label="Tìm trong tất cả nội dung"
            value={catalogQuery}
            onChange={setCatalogQuery}
          />
          <div className="catalog-grid">
            {catalog.map((node) => (
              <article key={node.id} className="catalog-card">
                <Icon
                  name={
                    node.kind === "folder"
                      ? "folder"
                      : node.kind === "theory"
                        ? "book"
                        : "exercise"
                  }
                />
                <button
                  type="button"
                  className="catalog-preview"
                  onClick={() => setPreviewId(node.id)}
                >
                  {node.title}
                </button>
                <small>
                  {node.kind === "folder"
                    ? "Thư mục"
                    : node.kind === "theory"
                      ? "Nội dung đọc"
                      : "Bài tập"}
                  {node.parent && nodes.find((n) => n.id === node.parent)
                    ? ` · ${nodes.find((n) => n.id === node.parent).title}`
                    : ""}
                </small>
                <button
                  type="button"
                  className="catalog-pin"
                  aria-label={`${isPinned(node) ? "Bỏ" : "Thêm"} ${node.title} ${isPinned(node) ? "khỏi" : "vào"} workspace`}
                  title={
                    isPinned(node) ? "Bỏ khỏi workspace" : "Thêm vào workspace"
                  }
                  aria-pressed={isPinned(node)}
                  onClick={() => togglePin(node)}
                >
                  <Icon name={isPinned(node) ? "check" : "plus"} size={17} />
                </button>
              </article>
            ))}
          </div>
          {!catalog.length && <p>Chưa có nội dung phù hợp.</p>}
        </section>
      ) : current?.kind === "folder" ? (
        <section className="practice-catalog">
          <Heading title={current.title} />
          <div className="catalog-grid">
            {nodes
              .filter((n) => n.parent === current.id)
              .map((node) => (
                <article className="catalog-card" key={node.id}>
                  <Icon
                    name={
                      node.kind === "folder"
                        ? "folder"
                        : node.kind === "exercise"
                          ? "exercise"
                          : "book"
                    }
                  />
                  <Link to={`${practiceRoutes(lang).learn}/${node.id}`}>
                    {node.title}
                  </Link>
                </article>
              ))}
          </div>
        </section>
      ) : current?.kind === "exercise" ? (
        <>
          <Heading title={current.title} />
          <PracticeActivity
            key={`${userId}:${current.id}:${current.updated_at}`}
            data={{
              ...previewData(current.payload),
              progress: current.progress,
            }}
            id={`hub-${current.id}:${current.updated_at}`}
            userId={userId}
            lang={lang}
            sound={sound}
            onProgress={(completed) => {
              setProgress((previous) => ({
                ...previous,
                [`${current.id}:${current.updated_at}`]: completed,
              }));
              sync.enqueue("practice_progress", {
                node: current.id,
                revision: current.updated_at,
                completed,
              });
              sync.flush();
            }}
          />
        </>
      ) : current?.kind === "theory" ? (
        <>
          <Heading title={current.title} />
          <TheoryActivity payload={current.payload} />
        </>
      ) : (
        <section className="learning-welcome">
          <span aria-hidden="true">🌿</span>
          <h1>{current?.title || "Một chút luyện tập, mỗi ngày."}</h1>
          <p>
            Chọn bài học ở thanh bên để bắt đầu. Mỗi lần một câu, theo nhịp của
            bạn.
          </p>
          {id && !current && !resource.loading && (
            <Status>
              Bài học không tồn tại hoặc bạn chưa có quyền truy cập.
            </Status>
          )}
        </section>
      )}
    </Page>
  );
}
