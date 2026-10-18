import { t as tr, useLocale } from "../../i18n/index.js";
import { folderPage } from "./practice-area.js";
import { PracticeTree, PracticeModal } from "./practice-workspace.jsx";
import { useEffect, useState, useMemo } from "react";
import {
  request,
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
  useLocale();
  const navigate = useNavigate();
  const resource = useResource(
    endpoint(lang, "practice-hub/nodes/"),
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
  const [details, setDetails] = useState({});
  const [detailError, setDetailError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setDetailError("");
    const ids = [...new Set([id, previewId])].filter(value => resource.data?.nodes.some(n => String(n.id)===String(value) && n.kind!=="folder"));
    Promise.all(ids.map(async value => {
      const key = `${lang}:${value}`;
      const result = await request(endpoint(lang,`practice-hub/nodes/${value}/`),"GET",undefined,controller.signal);
      if (!controller.signal.aborted) setDetails(previous => ({...previous,[key]:result.node}));
    })).catch(error => { if(error.name!=="AbortError") setDetailError(error.message); });
    return () => controller.abort();
  }, [id, previewId, lang, resource.data]);
  const nodes = useMemo(() => supportedPracticeNodes(resource.data?.nodes || []).map(
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
        ...(details[`${lang}:${node.id}`] || {}),
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
  ), [resource.data, details, progress, userId, lang]);
  const current = nodes.find((node) => String(node.id) === String(id));
  const workspace = useMemo(() => workspaceNodes(nodes, pinned), [nodes,pinned]);
  const catalog = useMemo(() => catalogRoots(nodes, catalogQuery), [nodes,catalogQuery]);
  const { page, pageCount, items: visibleCatalog } = folderPage(catalog, catalogPage);
  const roots = workspaceRoots(nodes, pinned);
  const isPinned = (node) => roots.includes(workspaceRoot(nodes, node.id)?.id);
  const preview = nodes.find((node) => node.id === previewId);
  return (
    <Page>
      <Status error={detailError}/>
      {!detailError && [current,preview].some(n=>n && n.kind!=="folder" && !n.payload) && <div role="status">{tr("Loading…")}</div>}
      <SidebarTools navOnly>
        <div className="flex flex-wrap gap-2 mb-3">
          <Link className="btn" to={`/${lang}/create`} title={tr("My Exercise Library")} aria-label={tr("My Exercise Library")}><Icon name="home"/></Link>
          <Link className="btn" to={`${practiceRoutes(lang).learn}/all`} title={tr("Switch lesson")} aria-label={tr("Switch lesson")}><Icon name="folder"/></Link>
          {current?.can_edit&&current.kind!=="folder"&&<Link className="btn" to={`/${lang}/create/${current.id}/edit?return=learn`} title={tr("Edit content")} aria-label={tr("Edit content")}><Icon name="edit"/></Link>}
          <Link className="btn" to={`/${lang}/create${current?.can_edit&&(current.kind==='folder'||current.parent)?`/new?parent=${current.kind==='folder'?current.id:current.parent}`:''}`} title={tr("Create exercise")} aria-label={tr("Create exercise")}><Icon name="plus"/></Link>
        </div>

        <div className="learning-navigation">
          <div className="workspace-search">
            <Field label={tr("Find an exercise")} value={query} onChange={setQuery} />
          </div>
          <Status error={resource.error} />
          <nav aria-label={tr("Lesson list")}>
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
            <p>{tr("Add folders or lessons from Your exercise library to your workspace.")}</p>
          )}
          {current?.links?.length > 0 && (
            <div className="learning-related">
              <h3>{tr("Continue learning")}</h3>
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
      {current?.kind === "exercise" && current.payload && <Status error={sync.error} />}
      {preview && (
        <PracticeModal title={preview.title} onClose={() => setPreviewId(null)}>
          <div className="flex flex-wrap items-center gap-3">
            {nodes.some((node) => node.id === preview.parent) && (
              <Btn onClick={() => setPreviewId(preview.parent)}>{tr("← Folder cha")}</Btn>
            )}
            <Btn
              isIconOnly
              title={
                isPinned(preview) ? tr("Remove from workspace") : tr("Add to workspace")
              }
              aria-label={
                isPinned(preview) ? tr("Remove from workspace") : tr("Add to workspace")
              }
              onClick={() => togglePin(preview)}
            >
              <Icon name={isPinned(preview) ? "check" : "plus"} />
            </Btn>
            <Link
              className="btn primary"
              to={`${practiceRoutes(lang).learn}/${preview.id}`}
              onClick={() => setPreviewId(null)}
            >{tr("Start learning")}</Link>
          </div>
          <p className="text-sm text-(--muted)">{tr("Preview content without changing your learning progress.")}</p>
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
                <p>{tr("No accessible content in this folder.")}</p>
              )}
            </div>
          ) : preview.kind === "exercise" && preview.payload ? (
            <PracticeActivity
              key={preview.id}
              preview
              data={previewData(preview.payload)}
              sound={sound}
            />
          ) : preview.payload ? (
            <TheoryActivity payload={preview.payload} />
          ) : null}
        </PracticeModal>
      )}
      {setting && (
        <PracticeModal title={setting.title} onClose={() => setSetting(null)}>
          <p>
            {isPinned(setting)
              ? tr("Removing a root folder from the workspace does not delete its content or progress.")
              : tr("Add this content's root folder to your workspace.")}
          </p>
          <Btn
            onClick={() => {
              togglePin(setting);
              setSetting(null);
            }}
          >
            {isPinned(setting) ? tr("Remove from workspace") : tr("Add to workspace")}
          </Btn>
        </PracticeModal>
      )}
      {resource.loading && !resource.data ? (
        <Status>{tr("Opening your learning space…")}</Status>
      ) : all ? (
        <section className="practice-catalog">
          <Heading
            title={tr("Your exercise library")}
            description={tr("Root folders containing exercises you can access. Open a card to preview it.")}
          />
          <Field
            label={tr("Search all content")}
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
                    ? tr("Folder")
                    : node.kind === "theory"
                      ? tr("Reading content")
                      : tr("Exercises")}
                  {node.parent && nodes.find((n) => n.id === node.parent)
                    ? ` · ${nodes.find((n) => n.id === node.parent).title}`
                    : ""}
                </small>
                <button
                  type="button"
                  className="catalog-pin"
                  aria-label={tr("{v0} {v1} {v2} workspace", { v0: isPinned(node) ? "Remove" : "Add", v1: node.title, v2: isPinned(node) ? "from" : "into" })}
                  title={
                    isPinned(node) ? tr("Remove from workspace") : tr("Add to workspace")
                  }
                  aria-pressed={isPinned(node)}
                  onClick={() => togglePin(node)}
                >
                  <Icon name={isPinned(node) ? "check" : "plus"} size={17} />
                </button>
              </article>
            ))}
          </div>
          {pageCount > 1 && <nav className="practice-pagination" aria-label={tr("Folder pages")}>
            <Btn isDisabled={page === 1} onClick={() => setCatalogPage(page - 1)}>{tr("Previous")}</Btn>
            <span role="status">{tr("Page ")}{page}{tr(" of ")}{pageCount}</span>
            <Btn isDisabled={page === pageCount} onClick={() => setCatalogPage(page + 1)}>{tr("Next")}</Btn>
          </nav>}
          {!visibleCatalog.length && <p>{tr("No matching content.")}</p>}
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
      ) : current?.kind === "exercise" && current.payload ? (
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
      ) : current?.kind === "theory" && current.payload ? (
        <>
          <Heading title={current.title} />
          <TheoryActivity payload={current.payload} />
        </>
      ) : (
        <section className="learning-welcome">
          <span aria-hidden="true">🌿</span>
          <h1>{current?.title || tr("A little practice every day.")}</h1>
          <p>{tr("Choose a lesson in the sidebar to start. Work through each question at your own pace.")}</p>
          {id && !current && !resource.loading && (
            <Status>{tr("This lesson does not exist or you do not have access.")}</Status>
          )}
        </section>
      )}
    </Page>
  );
}
