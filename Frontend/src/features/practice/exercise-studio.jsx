import {FormattingHelp} from "./formatting-help.jsx";
import { MediaEditor, ExerciseMediaDialog } from "./exercise-media.jsx";
import { PracticeModal } from "./practice-workspace.jsx";
import { useEffect, useState } from "react";
import {
  endpoint,
  useResource,
  useAction,
  request,
  useNavigate,
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
import { PracticeLibrary } from "./practice-library.jsx";
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
}) {
  const navigate = useNavigate();
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
  const [theoryMediaBusy,setTheoryMediaBusy] = useState(false);
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
        navigate(`${routes.studio}/${current.id}`);
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
              title="Instructions and .txt templates"
              aria-label="Instructions and .txt templates"
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
                    "Not selected"}
                </strong>
              </div>
              <Btn
                isIconOnly
                title="Close draft"
                aria-label="Close draft"
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
            aria-label="Folder position"
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
              {create ? "Create exercise" : current?.title}
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
          <Status>Opening Create…</Status>
        ) : id && !current && !create ? (
          <Status>
            This content does not exist or is not owned by you.
          </Status>
        ) : browsing ? (
          <>
            <header className="flex flex-wrap items-start justify-between gap-4">
              <Heading title={current?.title || "My Exercise Library"} />
              <div className="flex gap-2">
                {[
                  ["grid", "Grid view"],
                  ["list", "List view"],
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
                  title="Add"
                  aria-label="Add an exercise or folder"
                  onClick={() => setAddTarget({ parent })}
                >
                  <Icon name="plus" />
                </Btn>
                {current && (
                  <Btn
                    isIconOnly
                    title="Options"
                    aria-label="Folder options"
                    onClick={() => openSettings(current)}
                  >
                    <Icon name="settings" />
                  </Btn>
                )}
              </div>
            </header>
            <Field
              aria-label="Search"
              placeholder={current ? "Search trong folde…" : "Search folde…"}
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
            <Heading title={`Edit · ${current.title}`} />
            <div className="flex flex-wrap gap-3">
              <Select
                label="Format"
                value={theory.format || "markdown"}
                onChange={(format) =>
                  setTheory((value) => ({ ...value, format }))
                }
              >
                <option value="markdown">Markdown + lesson markup</option>
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
                    navigate(`${routes.studio}/${current.id}`);
                  })
                }
              >
                Save content
              </Btn>
            </div>
            <FormattingHelp/>
            <details className="lesson-format-help"><summary>Upload images / media</summary><MediaEditor lang={lang} items={theory.attachments || []} onChange={attachments=>setTheory(value=>({...value,attachments}))} onBusy={setTheoryMediaBusy} disabled={action.pending}/><p>Copy an image command into Theory content. Keep its attachment listed so readers can access it.</p></details>
            <Field
              label="Theory content"
              multiline
              rows={24}
              value={theory.content || ""}
              onChange={(content) =>
                setTheory((value) => ({ ...value, content }))
              }
            />
            <details className="lesson-format-help"><summary>Preview theory</summary><TheoryActivity payload={theory}/></details>
          </>
        ) : current && current.kind !== "folder" ? (
          <>
            <header className="flex flex-wrap items-start justify-between gap-4">
              <Heading title={current.title} />
              <div className="flex gap-2">
                <Btn
                  primary
                  isIconOnly
                  title="Edit content"
                  aria-label="Edit content"
                  onClick={() =>
                    navigate(`${routes.studio}/${current.id}/edit`)
                  }
                >
                  <Icon name="edit" />
                </Btn>
                <Btn
                  isIconOnly
                  title="Content options"
                  aria-label="Content options"
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
            Manage MP3 and images
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
              Edit content
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
        <PracticeModal title="Add" onClose={() => setAddTarget(null)}>
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
              Exercises from .txt
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
              New folder
            </Btn>
          </div>
        </PracticeModal>
      )}
      {(choosingFolder || (create && !parent && !resource.loading)) &&
        !folderDraft && (
          <PracticeModal
            title="Add to folder"
            onClose={() => {
              setChoosingFolder(false);
              if (create) navigate(routes.studio);
            }}
          >
            <p>Choose a destination folder.</p>
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
              New folder
            </Btn>
          </PracticeModal>
        )}
      {folderDraft && (
        <PracticeModal
          title="New folder"
          pending={action.pending}
          onClose={() => setFolderDraft(null)}
        >
          <Status error={action.error} />
          <Field
            label="Folder name"
            autoFocus
            maxLength={200}
            placeholder="Example: Present simple"
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
              description="Up to 12 tags, separated by commas."
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
            Create folder
          </Btn>
        </PracticeModal>
      )}
      {setting && (
        <PracticeModal
          title={`Options · ${setting.title}`}
          pending={action.pending}
          onClose={() => setSettingId(null)}
        >
          <Status error={action.error} />
          <Select
            label="Who can study?"
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
            <option value="private">Private</option>
            <option value="public">Public</option>
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
              Delete {setting.kind === "folder" ? "folde" : "content"}
            </Btn>
          ) : (
            <div role="alert">
              <p>
                Delete “{setting.title}”
                {setting.kind === "folder"
                  ? " and all its contents"
                  : ""}
                ? This action cannot be undone.
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
                  Confirm deletion
                </Btn>
                <Btn onClick={() => setRemoving(false)}>Keep</Btn>
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
          description="Up to 12 tags, 40 characters each. Separate with commas."
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
        Save tags
      </Btn>
    </div>
  );
}
