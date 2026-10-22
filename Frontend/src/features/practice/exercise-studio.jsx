import ActionMenu from "../../components/ui/action-menu.jsx";
import VisibilitySelect from "../../components/ui/VisibilitySelect.jsx";
import { t as tr, useLocale } from "../../i18n/index.js";
import { AiAuthoringHelp } from "./ai-authoring-help.jsx";
import { MediaEditor, ExerciseMediaDialog } from "./exercise-media.jsx";
import { PracticeTree, PracticeModal } from "./practice-workspace.jsx";
import { useEffect, useState } from "react";
import {
  endpoint,
  useResource,
  useAction,
  request,
  useNavigate,
  useRoute,
  readPreference,
  savePreference,
} from "../../lib/core.js";
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
} from "../../components/ui/ui.jsx";
import { DestinationPicker, PracticeLibrary } from "./practice-library.jsx";
import { PracticeTextEditor } from "./practice-text-editor.jsx";
import { PracticeActivity } from "./practice-activity.jsx";
import { TheoryActivity } from "./practice-theory.jsx";
import { previewData } from "./exercise-types.js";
import { ownedPracticeNodes, practiceRoutes } from "./practice-navigation.js";

export function ExerciseStudio({
  lang,
  id,
  create = false,
  parentId = null,
  edit = false,
  onDialogState,
}) {
  useLocale();
  const navigate = useNavigate();
  const route = useRoute();
  const returnToLearning = new URLSearchParams(route.split("?")[1]||"").get("return")==="learn";
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
  const [folderAction, setFolderAction] = useState(null);
  const [settingId, setSettingId] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [theory, setTheory] = useState(null);
  const [theoryMediaBusy,setTheoryMediaBusy] = useState(false);
  const [editorBusy, setEditorBusy] = useState(false);
  useEffect(() => {
    onDialogState?.({ pending: action.pending || theoryMediaBusy || editorBusy, drafting: create || edit });
  }, [action.pending, theoryMediaBusy, editorBusy, create, edit, onDialogState]);
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
          throw new Error("When editing an exercise, the file must contain exactly one EXERCISE block.");
        await request(
          `${base}${current.id}/`,
          "PATCH",
          {
            title: items[0].title,
            payload: { ...current.payload, ...items[0].payload },
          },
          signal,
        );
        setNotice("Exercise updated.");
        refresh();
        navigate(returnToLearning?`${routes.learn}/${current.id}`:`${routes.studio}/${current.id}`);
      } else {
        if (!parent) throw new Error("Choose a folder before saving.");
        const result = await request(
          endpoint(lang, "practice-hub/import/"),
          "POST",
          { nodes: items, parent },
          signal,
        );
        setNotice(`Created ${result.created.length} exercises.`);
        refresh();
        navigate(`${routes.studio}/${result.created.length===1?result.created[0]:parent}`);
      }
    });
  const browsing = !create && !edit && (!current || current.kind === "folder");
  const items = (
    current?.kind === "folder"
      ? nodes.filter((node) => node.parent === current.id && node.kind !== "folder")
      : nodes.filter(node => node.kind !== "folder" && !node.parent)
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
    <Page className="practice-workspace">
      <SidebarTools navOnly>
        <div className="studio-navigation flash-nav">
          <Link className="practice-context-link" to={routes.guide} title={tr("Authoring guide")}><Icon name="help" size={18}/><span>{tr("Authoring guide")}</span></Link>
          {!create && !edit && <>
            <Field className="practice-nav-search" label={tr("Search folders or exercises")} value={query} onChange={setQuery} startContent={<Icon name="search"/>}/>
            <PracticeTree nodes={nodes} base={routes.studio} currentId={id} query={query} pending={action.pending} onMove={(ids,parent)=>organize({action:"move",ids,parent})}
              rootActions={<ActionMenu quiet label={tr("Library actions")} disabled={action.pending} items={[{key:"folder",icon:"folder_add",label:"New folder",run:()=>setFolderDraft({title:"",parent:null})},{key:"add",icon:"plus",label:"Add",run:()=>setAddTarget({parent:null})}]}/>}
              renderActions={node=><ActionMenu quiet label={tr("Folder actions: {name}",{name:node.title})} disabled={action.pending} items={[
                {key:"add",icon:"plus",label:"Add",run:()=>setAddTarget({parent:node.id})},
                {key:"folder",icon:"folder_add",label:"New subfolder",run:()=>setFolderDraft({title:"",parent:node.id})},
                {key:"rename",icon:"edit",label:"Rename folder",run:()=>setFolderAction({action:"rename",node,title:node.title})},
                {key:"move",icon:"move",label:"Move folder",run:()=>setFolderAction({action:"move",node})},
                {key:"settings",icon:"settings",label:"Folder options",run:()=>openSettings(node)},
              ]}/>}/>
          </>}
          {(create || edit) && (
            <>
              <div className="rounded-xl border border-(--line) p-3">
                <small>{tr("Folde")}</small>
                <strong className="mt-1 block">
                  {nodes.find((node) => node.id === parent)?.title ||
                    tr("Not selected")}
                </strong>
              </div>
              <Btn
                isIconOnly
                title={tr("Close draft")}
                aria-label={tr("Close draft")}
                isDisabled={action.pending}
                onClick={() =>
                  navigate(returnToLearning&&current?`${routes.learn}/${current.id}`:`${routes.studio}/${current?.id || parent || ""}`)
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
            aria-label={tr("Folder position")}
            className="flex flex-wrap items-center gap-2 text-sm text-(--muted)"
          >
            <Link
              to={routes.studio}
              title={tr("My Exercise Library")}
              aria-label={tr("My Exercise Library")}
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
              {create ? tr("Create exercise") : current?.title}
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
          <Status>{tr("Opening Create…")}</Status>
        ) : id && !current && !create ? (
          <Status>{tr("This content does not exist or is not owned by you.")}</Status>
        ) : browsing ? (
          <>
            <header className="flex flex-wrap items-start justify-between gap-4">
              <Heading title={current?.title || tr("My Exercise Library")} />
              <div className="flex gap-2">
                {[
                  ["grid", "Grid view"],
                  ["list", "List view"],
                ].map(([mode, label]) => (
                  <Btn
                    key={mode}
                    isIconOnly
                    title={tr(label)}
                    aria-label={tr(label)}
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
                  title={tr("Add")}
                  aria-label={tr("Add an exercise or folder")}
                  onClick={() => setAddTarget({ parent })}
                >
                  <Icon name="plus" />
                </Btn>
                {current && (
                  <Btn
                    isIconOnly
                    title={tr("Options")}
                    aria-label={tr("Folder options")}
                    onClick={() => openSettings(current)}
                  >
                    <Icon name="settings" />
                  </Btn>
                )}
              </div>
            </header>
            {!current && <AiAuthoringHelp lang={lang} />}
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
            onBusyChange={setEditorBusy}
          />
        ) : theory ? (
          <>
            <Heading title={tr("Edit · {v0}", { v0: current.title })} />
            <div className="flex flex-wrap gap-3">
              <Select
                label={tr("Format")}
                value={theory.format || "markdown"}
                onChange={(format) =>
                  setTheory((value) => ({ ...value, format }))
                }
              >
                <option value="markdown">{tr("Markdown + lesson markup")}</option>
                <option value="html">HTML</option>
              </Select>
              <Btn
                icon="save"
                primary
                isLoading={action.pending}
                isDisabled={theoryMediaBusy}
                onClick={() =>
                  action.run(async (signal) => {
                    await request(
                      `${base}${current.id}/`,
                      "PATCH",
                      { payload: theory },
                      signal,
                    );
                    refresh();
                    navigate(returnToLearning?`${routes.learn}/${current.id}`:`${routes.studio}/${current.id}`);
                  })
                }
              >{tr("Save content")}</Btn>
            </div>
            <AiAuthoringHelp lang={lang}/>
            <details className="lesson-format-help"><summary>{tr("Upload images / media")}</summary><MediaEditor lang={lang} items={theory.attachments || []} onChange={attachments=>setTheory(value=>({...value,attachments}))} onBusy={setTheoryMediaBusy} disabled={action.pending}/><p>{tr("Copy an image command into Theory content. Keep its attachment listed so readers can access it.")}</p></details>
            <Field
              label={tr("Theory content")}
              multiline
              rows={24}
              value={theory.content || ""}
              onChange={(content) =>
                setTheory((value) => ({ ...value, content }))
              }
            />
            <details className="lesson-format-help"><summary>{tr("Preview theory")}</summary><TheoryActivity payload={theory}/></details>
          </>
        ) : current && current.kind !== "folder" ? (
          <>
            <header className="flex flex-wrap items-start justify-between gap-4">
              <Heading title={current.title} />
              <div className="flex gap-2">
                <Link className="btn primary" to={`${routes.learn}/${current.id}`}>{tr("Study now")}</Link>
                <Btn
                  primary
                  isIconOnly
                  title={tr("Edit content")}
                  aria-label={tr("Edit content")}
                  onClick={() =>
                    navigate(`${routes.studio}/${current.id}/edit`)
                  }
                >
                  <Icon name="edit" />
                </Btn>
                <Btn
                  isIconOnly
                  title={tr("Content options")}
                  aria-label={tr("Content options")}
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
          <Btn icon="image" onClick={() => setMediaOpen(true)}>{tr("Manage MP3 and images")}</Btn>
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
            >{tr("Edit content")}</Btn>
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
        <PracticeModal title={tr("Add")} onClose={() => setAddTarget(null)}>
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
              </span>{tr("Exercises from .txt")}</Btn>
            <Btn
              onClick={() => {
                setFolderDraft({ title: "", parent: addTarget.parent });
                setAddTarget(null);
              }}
            >
              <span className="create-type-icon folder">
                <Icon name="folder" />
              </span>{tr("New folder")}</Btn>
          </div>
        </PracticeModal>
      )}
      {(choosingFolder || (create && !parent && !resource.loading)) &&
        !folderDraft && (
          <PracticeModal
            title={tr("Add to folder")}
            onClose={() => {
              setChoosingFolder(false);
              if (create) navigate(routes.studio);
            }}
          >
            <p>{tr("Choose a destination folder.")}</p>
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
            >{tr("New folder")}</Btn>
          </PracticeModal>
        )}
      {folderAction && <PracticeModal title={tr(folderAction.action === "rename" ? "Rename folder" : "Move folder")} pending={action.pending} onClose={()=>setFolderAction(null)}>
        <Status error={action.error}/>
        {folderAction.action === "rename" ? <>
          <Field label={tr("Folder name")} value={folderAction.title} onChange={title=>setFolderAction(value=>({...value,title}))} maxLength={200} autoFocus/>
          <Btn primary isDisabled={action.pending || !folderAction.title.trim()} onClick={async()=>{if(await rename(folderAction.node,folderAction.title.trim()))setFolderAction(null);}}>{tr("Save changes")}</Btn>
        </> : <DestinationPicker nodes={nodes} ids={[folderAction.node.id]} pending={action.pending} onClose={()=>setFolderAction(null)} onChoose={async parent=>{if(await organize({action:"move",ids:[folderAction.node.id],parent}))setFolderAction(null);}}/>}
      </PracticeModal>}
      {folderDraft && (
        <PracticeModal
          title={tr("New folder")}
          pending={action.pending}
          onClose={() => setFolderDraft(null)}
        >
          <Status error={action.error} />
          <Field
            label={tr("Folder name")}
            autoFocus
            maxLength={200}
            placeholder={tr("Example: Present simple")}
            value={folderDraft.title}
            onChange={(title) =>
              setFolderDraft((value) => ({ ...value, title }))
            }
          />
          {!folderDraft.parent && (
            <Field
              label={tr("Tags")}
              placeholder={tr("grammar, present simple, A1")}
              value={folderDraft.tags || ""}
              onChange={(tags) =>
                setFolderDraft((value) => ({ ...value, tags }))
              }
              description={tr("Up to 12 tags, separated by commas.")}
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
          >{tr("Create folder")}</Btn>
        </PracticeModal>
      )}
      {setting && (
        <PracticeModal
          title={tr("Options · {v0}", { v0: setting.title })}
          pending={action.pending}
          onClose={() => setSettingId(null)}
        >
          <Status error={action.error} />
          <VisibilitySelect
            label={tr("Who can study?")}
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


          </VisibilitySelect>
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
            <Btn onClick={() => setRemoving(true)}>{tr("Delete ")}{setting.kind === "folder" ? tr("folde") : tr("content")}
            </Btn>
          ) : (
            <div role="alert">
              <p>{tr("Delete “")}{setting.title}”
                {setting.kind === "folder"
                  ? tr(" and all its contents")
                  : ""}{tr("? This action cannot be undone.")}</p>
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
                >{tr("Confirm deletion")}</Btn>
                <Btn onClick={() => setRemoving(false)}>{tr("Keep")}</Btn>
              </div>
            </div>
          )}
        </PracticeModal>
      )}
    </Page>
  );
}

function FolderTags({ node, pending, onSave }) {
  useLocale();
  const [value, setValue] = useState((node.tags || []).join(", "));
  return (
    <div className="flex items-end gap-2">
      <div className="min-w-0 flex-1">
        <Field
          label={tr("Tags")}
          value={value}
          onChange={setValue}
          placeholder={tr("grammar, present simple, A1")}
          description={tr("Up to 12 tags, 40 characters each. Separate with commas.")}
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
      >{tr("Save tags")}</Btn>
    </div>
  );
}
