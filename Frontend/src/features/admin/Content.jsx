import RowActions from "./RowActions.jsx";
import DataGrid from "./DataGrid.jsx";
import {sortQuery} from "./grid-state.js";
import { useState } from "react";
import { request, useResource, useAction } from "../../lib/core.js";
import { Btn, Field, Select, Loading, Status } from "../../components/ui/ui.jsx";
import { PracticeModal } from "../practice/practice-workspace.jsx";
import { ExerciseForm, prepareExercise } from "../practice/exercise-authoring.jsx";
import { EXERCISE_TYPES, newExercise, previewData } from "../practice/exercise-types.js";
import { PracticeActivity } from "../practice/practice-activity.jsx";
import { TheoryActivity } from "../practice/practice-theory.jsx";
import { MediaEditor } from "../practice/exercise-media.jsx";
import { ActionDialog, Pagination, dateText } from "./shared.jsx";

const kindNames = {
  folder: "Folder",
  exercise: "Exercises",
  theory: "Theory",
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
            ? `Edit · ${initial.title}`
            : `Create ${kindNames[value.kind].toLowerCase()}`
        }
        onClose={close}
        pending={action.pending || mediaBusy}
        size="5xl"
      >
        <div className="grid gap-4">
          <p className="text-sm text-(--muted)">
            {value.id
              ? `Content owner: ${value.owner.username}. Editing does not change ownership.`
              : "New content is private. Publish it after reviewing."}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Language"
              value={value.language}
              disabled={
                Boolean(value.id) ||
                mediaBusy ||
                Boolean(value.payload.attachments?.length)
              }
              onChange={(language) => change({ language, parent: null })}
            >
              <option value="en">English</option>
              <option value="de">German</option>
            </Select>
            <Select
              label="Parent folder"
              value={value.parent || ""}
              onChange={(parent) =>
                change({ parent: parent ? Number(parent) : null })
              }
            >
              <option value="">
                {value.kind === "exercise"
                  ? "Choose a folder (required)"
                  : "None — root"}
              </option>
              {availableFolders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title} · #{f.id}
                </option>
              ))}
            </Select>
          </div>
          {value.kind === "exercise" && !availableFolders.length && (
            <Status error="Create a folder in the same language before adding an exercise." />
          )}
          {value.kind !== "exercise" && (
            <Field
              label="Title"
              value={value.title}
              onChange={(title) => change({ title })}
              maxLength={200}
              isRequired
            />
          )}
          {value.kind === "folder" && (
            <Field
              label="Search tags · separated by commas"
              value={tags}
              onChange={(text) => {
                setTags(text);
                setDirty(true);
              }}
              description="Search tags apply only to root folders."
              isDisabled={Boolean(value.parent)}
            />
          )}
          {value.kind === "theory" && (
            <>
              <Select
                label="Format"
                value={value.payload.format || "markdown"}
                onChange={(format) =>
                  change({ payload: { ...value.payload, format } })
                }
              >
                <option value="markdown">Markdown</option>
                <option value="html">HTML</option>
              </Select>
              <Field
                label="Theory content"
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
              Cancel
            </Btn>
            {value.kind !== "folder" && (
              <Btn onClick={() => setPreview((v) => !v)}>
                {preview ? "Close preview" : "Preview"}
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
              Save content
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
          title="Discard unsaved changes?"
          description="Changes in this editing session have not been saved."
          reasonRequired={false}
          label="Discard changes"
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
      <PracticeModal title="Open content" onClose={onClose}>
        <Loading label="Loading admin data…" resource={resource}>
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
  const [sort,setSort]=useState([{key:"updated_at",desc:true}]);
  const resource = useResource(
    `/api/manage/content/?q=${encodeURIComponent(search)}&language=${language}&kind=${kind}&visibility=${visibility}&source=${source}&page=${page}&ordering=${sortQuery(sort)}`,
  );
  const filter = (setter) => (value) => {
    setter(value);
    setPage(1);
  };
  const refreshed = () => {
    resource.reload();
    setNotice("Content updated.");
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
          <h2 className="text-xl font-bold">Content library</h2>
          <p className="mt-1 text-sm text-(--muted)">
            Edit lessons, preview content and manage publication.
          </p>
        </div>
        <div className="flex gap-2">
          <Btn onClick={resource.reload}>Refresh</Btn>
          <Btn primary onClick={() => setCreating(true)}>
            Create content
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
          label="Title or owner"
          value={query}
          onChange={setQuery}
        />
        <Btn type="submit" primary>
          Search
        </Btn>
      </form>
      <Status>{notice}</Status>
      <Loading label="Loading admin data…" resource={resource}>
        {(d) => (
          <>
            <DataGrid id="content" label="Content" rows={d.rows} sort={sort} onSort={next=>{setSort(next);setPage(1);}} columns={[
             {key:'title',label:'Title',required:true},
             {key:'owner',label:'Owner',render:n=>n.owner.username,filtered:!!source,filter:<Select label="Source" value={source} onChange={filter(setSource)}><option value="">All sources</option><option value="system">Admin / Staff</option><option value="users">Users</option><option value="mine">Mine</option></Select>},
             {key:'kind',label:'Type',render:n=>kindNames[n.kind],filtered:!!kind,filter:<Select label="Type" value={kind} onChange={filter(setKind)}><option value="">All types</option>{Object.entries(kindNames).map(([key,name])=><option key={key} value={key}>{name}</option>)}</Select>},
             {key:'language',label:'Language',filtered:!!language,filter:<Select label="Language" value={language} onChange={filter(setLanguage)}><option value="">All languages</option><option value="en">English</option><option value="de">German</option></Select>},
             {key:'visibility',label:'Visibility',filtered:!!visibility,filter:<Select label="Visibility" value={visibility} onChange={filter(setVisibility)}><option value="">Any visibility</option><option value="public">Public</option><option value="private">Private</option></Select>},
             {key:'updated_at',label:'Updated',numeric:true,render:n=>dateText(n.updated_at)},
             {key:'actions',label:'Actions',required:true,sortable:false,render:n=><RowActions label={`Actions for ${n.title}`} items={[
 {key:'edit',label:'Edit & preview',run:()=>setEdit(n)},
 {key:'visibility',label:n.visibility==='public'?'Unpublish':'Publish',run:()=>{setCascade(false);setOperation({n,kind:'visibility'});}},
 {key:'delete',label:'Delete content',danger:true,run:()=>setOperation({n,kind:'delete'})}
 ]}/>}
            ]}/>
            <Pagination page={page} total={d.total} onChange={setPage} />
          </>
        )}
      </Loading>
      {creating && (
        <PracticeModal
          title="Create content"
          onClose={() => setCreating(false)}
          size="md"
        >
          <p>
            Content will belong to your account. Create folders first to organize exercises.
          </p>
          <div className="my-3 flex flex-wrap gap-2">
            <Btn onClick={() => create("folder")}>Folder</Btn>
            <Btn onClick={() => create("theory")}>Theory</Btn>
          </div>
          <Select label="Exercise type" value={mode} onChange={setMode}>
            {EXERCISE_TYPES.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
          <Btn primary onClick={() => create("exercise")}>
            Create exercise
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
          title={`${operation.kind === "delete" ? "Delete" : operation.n.visibility === "public" ? "Hide" : "Publish"} · ${operation.n.title}`}
          description={
            operation.kind === "delete"
              ? "Permanently delete this content, its children and related learning data. This cannot be undone."
              : "Public content is accessible to learners. Unpublishing preserves access for its owner and assigned classes."
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
              Apply to all content in the folder
            </label>
          )}
        </ActionDialog>
      )}
    </>
  );
}
