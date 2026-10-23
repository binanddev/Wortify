import {usePagination} from '../../lib/pagination.js';
import Pagination from '../../components/ui/pagination.jsx';
import { t as tr, useLocale } from "../../i18n/index.js";
import ActionMenu from "../../components/ui/action-menu.jsx";
import { PracticeTree, PracticeModal } from "./practice-workspace.jsx";
import { lazy, Suspense, useEffect, useState, useMemo } from "react";
const PracticeImportModal = lazy(() => import("./practice-import-modal.jsx"));
import { PracticeLibrary } from "./practice-library.jsx";
import PracticeNodeDialog from "./practice-node-dialog.jsx";
import {
  request,
  useNavigate,
  useResource,
  useAction,
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
  myPracticeNodes,
  workspaceRoot,
  workspaceRoots,
  toggleWorkspaceRoot,
  catalogRoots,
  ownedPracticeNodes,
} from "./practice-navigation.js";

export function PracticeHub({ lang, id, userId, sound }) {
  useLocale();
  const navigate = useNavigate();
  const sync = useLearningSync(userId, lang);
  const workspaceKey = `wortify:practice-workspace:${userId}:${lang}`;
  const [pinned, setPinned] = useState(() => {
    const value = readPreference(workspaceKey, []);
    return Array.isArray(value) ? value : [];
  });
  const metadataParams = new URLSearchParams({scope:'workspace', roots:[...new Set(pinned)].slice(0,500).join(',')});
  if (/^\d+$/.test(String(id))) metadataParams.set('current', id);
  const resource = useResource(endpoint(lang, `practice-hub/nodes/?${metadataParams}`), true);
  const action = useAction();
  const [importing, setImporting] = useState(null);
  const [nodeOperation, setNodeOperation] = useState(null);
  const [notice, setNotice] = useState(null);
  useEffect(()=>{action.setError("");},[nodeOperation]);
  const openImport = (folder, node = null) => setTimeout(()=>setImporting({folder,node}),0);
  const nodeAction = (action, node) => setNodeOperation({action,node});
  const [previewId, setPreviewId] = useState(null);
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
    const ids = [...new Set([id, previewId])].filter(value => metadataById.get(String(value))?.kind && metadataById.get(String(value)).kind!=="folder");
    Promise.all(ids.map(async value => {
      const key = `${lang}:${value}`;
      const result = await request(endpoint(lang,`practice-hub/nodes/${value}/`),"GET",undefined,controller.signal);
      if (!controller.signal.aborted) setDetails(previous => ({...previous,[key]:result.node}));
    })).catch(error => { if(error.name!=="AbortError") setDetailError(error.message); });
    return () => controller.abort();
  }, [id, previewId, lang, resource.data]);
  const metadata = useMemo(() => supportedPracticeNodes(resource.data?.nodes || []), [resource.data]);
  const metadataById = useMemo(() => new Map(metadata.map(node => [String(node.id),node])), [metadata]);
  const localProgress = useMemo(() => new Map(metadata.map(node => [node.id,
    readPreference(`wortify:practice-progress:${userId}:${lang}:hub-${node.id}:${node.updated_at}`, [])
  ])), [metadata, userId, lang]);
  const nodes = useMemo(() => metadata.map(node => {
    const local = progress[`${node.id}:${node.updated_at}`] || localProgress.get(node.id);
    const completed = [...new Set([...(node.progress?.completed || []), ...(Array.isArray(local) ? local : [])])];
    return {...node, progress:{completed}};
  }), [metadata, localProgress, progress]);
  const nodesById = useMemo(() => new Map(nodes.map(node => [String(node.id),node])), [nodes]);
  const withDetail = node => {
    const detail = node && details[`${lang}:${node.id}`];
    return node && detail && detail.updated_at === node.updated_at ? {...detail, progress:node.progress} : node;
  };
  const current = withDetail(nodesById.get(String(id)));
  const workspace = useMemo(() => myPracticeNodes(nodes, pinned), [nodes,pinned]);
  const catalog = useMemo(() => catalogRoots(ownedPracticeNodes(nodes), catalogQuery), [nodes,catalogQuery]);
  const pageCount = Math.max(1, Math.ceil(catalog.length / 15));
  const page = Math.max(1, Math.min(catalogPage, pageCount));
  const visibleCatalog = catalog.slice((page - 1) * 15, page * 15);
  const roots = workspaceRoots(nodes, pinned);
  const isPinned = (node) => roots.includes(workspaceRoot(nodes, node.id)?.id);
  const preview = withDetail(nodesById.get(String(previewId)));
  const folderContent = nodes.filter(node => node.parent === current?.id && node.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const folderPagination = usePagination(folderContent.length, `${id}:${query}`, 24);
  const previewChildren = useMemo(() => nodes.filter(node => node.parent === previewId), [nodes,previewId]);
  const previewPagination = usePagination(previewChildren.length, String(previewId), 24);
  const owned = ownedPracticeNodes(nodes);
  const patchNode = (node, values) => action.run(async signal=>{await request(endpoint(lang,`practice-hub/nodes/${node.id}/`),"PATCH",values,signal);resource.reload();return true;});
  const createNode = values => action.run(async signal=>{const result = await request(endpoint(lang,"practice-hub/nodes/"),"POST",values,signal);resource.reload();navigate(`${practiceRoutes(lang).learn}/${result.node.id}`);return true;});
  const organize = values => action.run(async signal=>{
    const affected = new Set(values.ids);
    if(values.action === "delete") { let changed=true; while(changed){changed=false;for(const node of nodes)if(affected.has(node.parent)&&!affected.has(node.id)){affected.add(node.id);changed=true;}} }
    await request(endpoint(lang,"practice-hub/organize/"),"POST",values,signal);
    resource.reload();
    if(values.action === "delete" && current && affected.has(current.id)) navigate(`${practiceRoutes(lang).learn}/all`);
    return true;
  });
  const folderMenu = node => <ActionMenu quiet label={tr("Folder actions: {name}",{name:node.title})} disabled={action.pending} items={[
    ...(node.can_edit ? [
      {key:"import",icon:"upload",label:"Import exercises",run:()=>openImport(node)},
      {key:"new",icon:"folder_add",label:"New subfolder",run:()=>setNodeOperation({action:"create",parent:node.id})},
      {key:"rename",icon:"edit",label:"Rename",run:()=>nodeAction("rename",node)},
      {key:"move",icon:"move",label:"Move",run:()=>nodeAction("move",node)},
      {key:"settings",icon:"settings",label:"Content options",run:()=>nodeAction("settings",node)},
    ] : []),
    ...(!node.can_edit ? [{key:"pin",icon:isPinned(node)?"close":"plus",label:isPinned(node)?"Remove from workspace":"Add to workspace",run:()=>togglePin(node)}] : []),
    ...(node.can_edit ? [{key:"delete",icon:"trash",label:"Delete permanently",danger:true,run:()=>nodeAction("delete",node)}] : []),
  ]}/>;
  const lessonHeading = <div className="practice-content-heading"><Heading title={current?.title}/>{current?.can_edit && <Btn aria-label={tr("Edit content")} onClick={()=>current.kind === "exercise" ? openImport(nodes.find(node=>node.id===current.parent),current) : navigate(`/${lang}/create/${current.id}/edit?return=learn`)}><Icon name="edit" size={18}/></Btn>}</div>;
  const library = items => <PracticeLibrary items={items} nodes={nodes} lang={lang} parent={all?null:current?.id} routeBase="practice" pending={action.pending} error={action.error} searching={Boolean((all?catalogQuery:query).trim())}
    onOrganize={organize} onRename={(node,title)=>patchNode(node,{title})}
    onOpen={node=>navigate(`${practiceRoutes(lang).learn}/${node.id}`)} onPreview={node=>setPreviewId(node.id)}
    onEdit={node=>node.kind === "exercise" ? openImport(nodes.find(folder=>folder.id===node.parent),node) : navigate(`/${lang}/create/${node.id}/edit?return=learn`)}
    onSettings={node=>nodeAction("settings",node)} onCreate={node=>openImport(node)}
    extraMenuItems={node=>node.can_edit ? [] : [{key:"pin",icon:isPinned(node)?"close":"plus",label:isPinned(node)?"Remove from workspace":"Add to workspace",run:()=>togglePin(node)}]}/>;
  return (
    <Page className="practice-workspace">
      <Status error={detailError || action.error}/>
      {notice && <div className="deck-operation-notice" role="status"><Icon name="check" size={18}/><span>{notice.edited ? tr("Exercise updated.") : tr("Imported {count} exercises",{count:notice.count})}</span><Btn icon="close" onClick={()=>setNotice(null)}>{tr("Dismiss")}</Btn></div>}
      {!detailError && [current,preview].some(n=>n && n.kind!=="folder" && !n.payload) && <div role="status">{tr("Loading…")}</div>}
      <SidebarTools navOnly>
        <div className="learning-navigation flash-nav">
          <div className="workspace-search">
            <Field className="practice-nav-search" label={tr("Search folders or exercises")} value={query} onChange={setQuery} startContent={<Icon name="search"/>} />
          </div>
          <Status error={resource.error} />
          <nav aria-label={tr("Lesson list")}>
            <PracticeTree
              nodes={myPracticeNodes(nodes, current ? [...pinned,current.id] : pinned)}
              base={practiceRoutes(lang).learn}
              currentId={id}
              query={query}
              pending={action.pending}
              onMove={(ids,parent)=>organize({action:"move",ids,parent})}
              rootLabel="My practice"
              rootActions={<ActionMenu quiet label={tr("Library actions")} disabled={action.pending} items={[{key:"folder",icon:"folder_add",label:"New folder",run:()=>setNodeOperation({action:"create",parent:null})}]}/>}
              renderActions={folderMenu}
            />
          </nav>
          {current?.links?.length > 0 && (
            <div className="learning-related">
              <h3>{tr("Continue learning")}</h3>
              {current.links.map((target) => {
                const node = nodesById.get(String(target));
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
      {importing && <Suspense fallback={<PracticeModal title={tr("Loading workspace…")} onClose={()=>setImporting(null)}><Status>{tr("Loading…")}</Status></PracticeModal>}><PracticeImportModal lang={lang} {...importing} onClose={()=>setImporting(null)} onSaved={count=>{resource.reload();setNotice({count,edited:!!importing.node});if(importing.folder)navigate(`${practiceRoutes(lang).learn}/${importing.folder.id}`);}}/></Suspense>}
      {nodeOperation && <PracticeNodeDialog key={`${nodeOperation.action}:${nodeOperation.node?.id || nodeOperation.parent || "root"}`} operation={nodeOperation} nodes={owned} pending={action.pending} error={action.error} onClose={()=>setNodeOperation(null)} onPatch={patchNode} onOrganize={organize} onCreate={createNode}/>}
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
              {previewChildren.slice(previewPagination.start,previewPagination.end).map((node) => (
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
              <Pagination pagination={previewPagination} count={previewChildren.length}/>
              {!previewChildren.length && (
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
      {resource.loading && !resource.data ? (
        <Status>{tr("Opening your learning space…")}</Status>
      ) : all ? (
        <section className="practice-catalog">
          <div className="practice-content-heading"><Heading title={tr("My practice")}/><div className="practice-folder-toolbar"><Btn aria-label={tr("New folder")} onClick={()=>setNodeOperation({action:"create",parent:null})}><Icon name="folder_add" size={18}/><span>{tr("New folder")}</span></Btn></div></div>
          <Field label={tr("Search all content")} value={catalogQuery} onChange={value=>{setCatalogQuery(value);setCatalogPage(1);}}/>
          {library(visibleCatalog)}
          {pageCount > 1 && <nav className="practice-pagination" aria-label={tr("Folder pages")}><Btn isDisabled={page===1} onClick={()=>setCatalogPage(page-1)}>{tr("Previous")}</Btn><span>{page} / {pageCount}</span><Btn isDisabled={page===pageCount} onClick={()=>setCatalogPage(page+1)}>{tr("Next")}</Btn></nav>}
        </section>
      ) : current?.kind === "folder" ? (
        <section className="practice-catalog">
          <div className="practice-content-heading"><Heading title={current.title}/>{current.can_edit && <div className="practice-folder-toolbar"><Btn primary aria-label={tr("Import exercises")} isDisabled={action.pending} onClick={()=>openImport(current)}><Icon name="upload" size={18}/><span>{tr("Import exercises")}</span></Btn><Btn isIconOnly aria-label={tr("New subfolder")} onClick={()=>setNodeOperation({action:"create",parent:current.id})}><Icon name="folder_add" size={18}/></Btn>{folderMenu(current)}</div>}</div>
          {library(folderContent.slice(folderPagination.start,folderPagination.end))}
          <Pagination pagination={folderPagination} count={folderContent.length}/>
        </section>
      ) : current?.kind === "exercise" && current.payload ? (
        <>
          {lessonHeading}
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
          {lessonHeading}
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
