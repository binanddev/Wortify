import { folderPage } from "./practice-area.js";
import { PracticeTree, PracticeModal } from "./practice-workspace.jsx";
import { useEffect, useState } from "react";
import {
  useNavigate,
  useResource,
  endpoint,
  readPreference,
  savePreference,
} from "../../lib/core.js";
import {
  Page,
  Heading,
  SidebarTools,
  Field,
  Link,
  Status,
  Btn,
  Icon,
} from "../../components/ui/ui.jsx";
import { PracticeActivity } from "./practice-activity.jsx";
import { TheoryActivity } from "./practice-theory.jsx";
import { useLearningSync } from "../learning/learning-sync.js";
import { previewData } from "./exercise-types.js";
import {
  supportedPracticeNodes,
  practiceRoutes,
  workspaceNodes,
  workspaceRoot,
  workspaceRoots,
  toggleWorkspaceRoot,
  catalogRoots,
} from "./practice-navigation.js";

export function PracticeHub({ lang, id, userId, sound }) {
  const navigate = useNavigate();
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
  const [catalogPage, setCatalogPage] = useState(1);
  const all = !id || id === "all";
  useEffect(() => { if (!id) navigate(`${practiceRoutes(lang).learn}/all`); }, [id, lang, navigate]);
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
  const { page, pageCount, items: visibleCatalog } = folderPage(catalog, catalogPage);
  const roots = workspaceRoots(nodes, pinned);
  const isPinned = (node) => roots.includes(workspaceRoot(nodes, node.id)?.id);
  const preview = nodes.find((node) => node.id === previewId);
  return (
    <Page>
      <SidebarTools navOnly>
        <div className="learning-navigation">
          <div className="workspace-search">
            <Field label="Find an exercise" value={query} onChange={setQuery} />
          </div>
          <Status error={resource.error} />
          <nav aria-label="Lesson list">
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
              Add folders or lessons from Your exercise library to your workspace.
            </p>
          )}
          {current?.links?.length > 0 && (
            <div className="learning-related">
              <h3>Continue learning</h3>
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
                ← Folder cha
              </Btn>
            )}
            <Btn
              isIconOnly
              title={
                isPinned(preview) ? "Remove from workspace" : "Add to workspace"
              }
              aria-label={
                isPinned(preview) ? "Remove from workspace" : "Add to workspace"
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
              Start learning
            </Link>
          </div>
          <p className="text-sm text-(--muted)">
            Preview content without changing your learning progress.
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
                <p>No accessible content in this folder.</p>
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
              ? "Removing a root folder from the workspace does not delete its content or progress."
              : "Add this content's root folder to your workspace."}
          </p>
          <Btn
            onClick={() => {
              togglePin(setting);
              setSetting(null);
            }}
          >
            {isPinned(setting) ? "Remove from workspace" : "Add to workspace"}
          </Btn>
        </PracticeModal>
      )}
      {resource.loading && !resource.data ? (
        <Status>Opening your learning space…</Status>
      ) : all ? (
        <section className="practice-catalog">
          <Heading
            title="Your exercise library"
            description="Root folders containing exercises you can access. Open a card to preview it."
          />
          <Field
            label="Search all content"
            value={catalogQuery}
            onChange={(value) => { setCatalogQuery(value); setCatalogPage(1); }}
          />
          <div className="catalog-grid">
            {visibleCatalog.map((node) => (
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
                    ? "Folder"
                    : node.kind === "theory"
                      ? "Reading content"
                      : "Exercises"}
                  {node.parent && nodes.find((n) => n.id === node.parent)
                    ? ` · ${nodes.find((n) => n.id === node.parent).title}`
                    : ""}
                </small>
                <button
                  type="button"
                  className="catalog-pin"
                  aria-label={`${isPinned(node) ? "Remove" : "Add"} ${node.title} ${isPinned(node) ? "from" : "into"} workspace`}
                  title={
                    isPinned(node) ? "Remove from workspace" : "Add to workspace"
                  }
                  aria-pressed={isPinned(node)}
                  onClick={() => togglePin(node)}
                >
                  <Icon name={isPinned(node) ? "check" : "plus"} size={17} />
                </button>
              </article>
            ))}
          </div>
          {pageCount > 1 && <nav className="practice-pagination" aria-label="Folder pages">
            <Btn isDisabled={page === 1} onClick={() => setCatalogPage(page - 1)}>Previous</Btn>
            <span role="status">Page {page} of {pageCount}</span>
            <Btn isDisabled={page === pageCount} onClick={() => setCatalogPage(page + 1)}>Next</Btn>
          </nav>}
          {!visibleCatalog.length && <p>No matching content.</p>}
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
            onNext={() => {
              const exercises = (
                workspace.some((node) => node.id === current.id)
                  ? workspace
                  : nodes
              ).filter((node) => node.kind === "exercise");
              const next =
                exercises[
                  exercises.findIndex((node) => node.id === current.id) + 1
                ];
              if (next && next.id !== current.id)
                navigate(`${practiceRoutes(lang).learn}/${next.id}`);
            }}
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
          <h1>{current?.title || "A little practice every day."}</h1>
          <p>
            Choose a lesson in the sidebar to start. Work through each question at your own pace.
          </p>
          {id && !current && !resource.loading && (
            <Status>
              This lesson does not exist or you do not have access.
            </Status>
          )}
        </section>
      )}
    </Page>
  );
}
