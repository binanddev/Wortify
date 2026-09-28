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
  const [setting, setSetting] = useState(null);
  const [catalogQuery, setCatalogQuery] = useState("");
  const all = id === "all";
  const togglePin = (node) =>
    setPinned((previous) => {
      const next = previous.includes(node.id)
        ? previous.filter((v) => v !== node.id)
        : [...previous, node.id];
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
  const catalog = nodes.filter((node) =>
    node.title
      .toLocaleLowerCase()
      .includes(catalogQuery.trim().toLocaleLowerCase()),
  );
  return (
    <Page>
      <SidebarTools navOnly>
        <div className="learning-navigation">
          <Field label="Tìm bài để học" value={query} onChange={setQuery} />
          <Link to={practiceRoutes(lang).learn}>Workspace của tôi</Link>
          <Link to={practiceRoutes(lang).explore}>
            Explore · tìm bài học công khai
          </Link>
          <Status error={resource.error} />
          <nav aria-label="Danh sách bài học">
            <PracticeTree
              nodes={workspace}
              base={practiceRoutes(lang).learn}
              currentId={id}
              query={query}
              onSettings={setSetting}
            />
          </nav>
          {!resource.loading && !workspace.length && (
            <p>
              Thêm thư mục hoặc bài học từ “Hiển thị tất cả” vào workspace của
              bạn.
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
          <Link
            to={`${practiceRoutes(lang).learn}/all`}
            className="workspace-browse"
            title="Hiển thị tất cả"
            aria-label="Hiển thị tất cả"
          >
            <Icon name="cards" size={20} />
          </Link>
        </div>
      </SidebarTools>
      {current?.kind === "exercise" && <Status error={sync.error} />}
      {setting && (
        <PracticeModal title={setting.title} onClose={() => setSetting(null)}>
          <p>
            {pinned.includes(setting.id)
              ? "Bỏ khỏi workspace sẽ không xóa nội dung hoặc tiến độ học."
              : "Ghim riêng nội dung này để luôn thấy trong workspace."}
          </p>
          <Btn
            onClick={() => {
              togglePin(setting);
              setSetting(null);
            }}
          >
            {pinned.includes(setting.id)
              ? "Bỏ khỏi workspace"
              : "Thêm vào workspace"}
          </Btn>
        </PracticeModal>
      )}
      {resource.loading && !resource.data ? (
        <Status>Đang mở góc học của bạn…</Status>
      ) : all ? (
        <section className="practice-catalog">
          <Heading
            title="Khám phá nội dung"
            description="Tất cả thư mục, bài tập và nội dung bạn có quyền xem."
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
                        : "cards"
                  }
                />
                <Link to={`${practiceRoutes(lang).learn}/${node.id}`}>
                  {node.title}
                </Link>
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
                  aria-label={`${pinned.includes(node.id) ? "Bỏ" : "Thêm"} ${node.title} ${pinned.includes(node.id) ? "khỏi" : "vào"} workspace`}
                  aria-pressed={pinned.includes(node.id)}
                  onClick={() => togglePin(node)}
                >
                  <Icon
                    name={pinned.includes(node.id) ? "check" : "plus"}
                    size={17}
                  />
                  {pinned.includes(node.id) ? "Đã thêm" : "Workspace"}
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
                  <Icon name={node.kind === "folder" ? "folder" : "book"} />
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
