import { useState } from "react";
import { request, useResource, useAction } from "../../lib/core.js";
import { Btn, Icon, Field, Select, Status, Loading, Confirm } from "../../components/ui/ui.jsx";
import { PracticeModal } from "../practice/practice-workspace.jsx";
const labels = {
  name: "Name",
  title: "Title",
  description: "Description",
  parent: "Parent folder",
  folder: "Folder",
  deck: "Decks",
  card: "Card",
  node: "Exercises",
  language: "Language",
  kind: "Type",
  payload: "Content",
  german_text: "Term",
  vietnamese_meaning: "Definition",
  display_name: "Display name",
  bio: "Introduction",
  position: "Position",
  visibility: "Share",
  preferences: "Options",
  theory_content: "Theory",
  theory_format: "Theory format",
};
function RelationPicker({ base, field, value, onChange, language }) {
  const [query, setQuery] = useState("");
  const url = `${base}${field.relation}/`;
  const resource = useResource(
    `${url}?q=${encodeURIComponent(query)}&language=${language || ""}`,
  );
  const selected = useResource(value ? `${url}${value}/` : url);
  const rows = resource.data?.rows || [];
  return (
    <div className="grid gap-2 rounded-xl border border-(--line) p-3">
      <Field
        label={`Search ${labels[field.name] || field.name}`}
        value={query}
        onChange={setQuery}
      />
      <Select
        label={labels[field.name] || field.name}
        value={value}
        onChange={onChange}
        required={field.required}
      >
        <option value="">
          {field.required ? "Choose an item" : "Not linked"}
        </option>
        {value && !rows.some((r) => String(r.id) === String(value)) && (
          <option value={value}>
            {selected.data?.label || `Selected item #${value}`}
          </option>
        )}
        {rows.map((row) => (
          <option key={row.id} value={row.id}>
            {row.label}
            {row.values.language
              ? ` · ${row.values.language.toUpperCase()}`
              : ""}
          </option>
        ))}
      </Select>
      <small className="text-(--muted)">
        {resource.loading
          ? "Searching…"
          : `${resource.data?.total || 0} matching items. Enter a name to narrow results.`}
      </small>
      <Status error={resource.error || selected.error} />
    </div>
  );
}
function RecordEditor({ row, schema, url, base, onClose, onSaved }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      schema.map((f) => {
        const value =
          row?.values?.[f.name] ??
          f.default ??
          (f.type === "BooleanField"
            ? false
            : f.choices.length
              ? f.choices[0][0]
              : "");
        return [
          f.name,
          f.type === "JSONField"
            ? JSON.stringify(value === "" ? {} : value, null, 2)
            : value,
        ];
      }),
    ),
  );
  const [dirty, setDirty] = useState(() => new Set());
  const updateValue = (name, value) => {
    setValues((previous) => ({ ...previous, [name]: value }));
    setDirty((previous) => new Set([...previous, name]));
  };
  const action = useAction();
  const save = () =>
    action.run(async (signal) => {
      const data = {};
      for (const f of schema) {
        if (row && !dirty.has(f.name)) continue;
        let v = values[f.name];
        if (f.type === "JSONField") {
          try {
            v = JSON.parse(v);
          } catch {
            throw new Error(`${labels[f.name] || f.name}: Invalid JSON.`);
          }
        } else if (
          v === "" &&
          !f.required &&
          (f.type.includes("Integer") ||
            f.type === "ForeignKey" ||
            f.type === "DateTimeField" ||
            f.type === "FloatField")
        )
          v = null;
        else if (
          f.type.includes("Integer") ||
          f.type === "FloatField" ||
          f.type === "ForeignKey"
        )
          v = Number(v);
        data[f.name] = v;
      }
      await request(
        `${url}${row ? `${row.id}/` : ""}`,
        row ? "PATCH" : "POST",
        data,
        signal,
      );
      onSaved();
      onClose();
    });
  return (
    <PracticeModal
      title={row ? `Edit · ${row.label}` : "Add data"}
      onClose={onClose}
      pending={action.pending}
    >
      <div className="grid gap-4">
        {schema.map((f) =>
          f.type === "BooleanField" ? (
            <label key={f.name} className="check-line">
              <input
                type="checkbox"
                checked={!!values[f.name]}
                onChange={(e) => updateValue(f.name, e.target.checked)}
              />
              {labels[f.name] || f.name}
            </label>
          ) : f.relation ? (
            <RelationPicker
              key={f.name}
              base={base}
              field={f}
              value={values[f.name]}
              language={values.language}
              onChange={(v) => updateValue(f.name, v)}
            />
          ) : f.choices.length ? (
            <Select
              key={f.name}
              label={labels[f.name] || f.name}
              value={values[f.name]}
              onChange={(v) => updateValue(f.name, v)}
            >
              {!f.required && <option value="">—</option>}
              {f.choices.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          ) : (
            <Field
              key={f.name}
              label={labels[f.name] || f.name}
              value={values[f.name] ?? ""}
              multiline={f.type === "JSONField" || f.type === "TextField"}
              onChange={(v) => updateValue(f.name, v)}
            />
          ),
        )}
      </div>
      <Status error={action.error} />
      <Btn primary isLoading={action.pending} onClick={save}>
        Save
      </Btn>
    </PracticeModal>
  );
}
export default function UserData({ user, onClose }) {
  const base = `/api/manage/users/${user.id}/data/`;
  const summary = useResource(base);
  const [kind, setKind] = useState("decks"),
    [page, setPage] = useState(1),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState("");
  const [edit, setEdit] = useState(null),
    [remove, setRemove] = useState(null),
    [purge, setPurge] = useState(false),
    [confirm, setConfirm] = useState("");
  const resource = useResource(
      `${base}${kind}/?page=${page}&q=${encodeURIComponent(search)}`,
    ),
    action = useAction();
  const reload = () => {
    resource.reload();
    summary.reload();
  };
  return (
    <>
      <div className="my-5 grid gap-4 rounded-2xl border border-(--line) p-4">
        <div className="flash-icon-row">
          <Btn onClick={onClose}>Back to users</Btn>
          <Btn onClick={reload}>Update</Btn>
          <Btn
            isDisabled={!resource.data?.can_create}
            onClick={() => setEdit({ create: true })}
          >
            Add data
          </Btn>
          {!user.is_staff && !user.is_superuser && (
            <Btn
              onClick={() => {
                setPurge(true);
                setConfirm("");
              }}
            >
              Delete all data
            </Btn>
          )}
        </div>
        <Select
          label="Data"
          value={kind}
          onChange={(value) => {
            setKind(value);
            setPage(1);
            setQuery("");
            setSearch("");
          }}
        >
          {summary.data?.collections.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label} · {c.count}
            </option>
          ))}
        </Select>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(query);
            setPage(1);
          }}
          className="grid gap-2"
        >
          <Field label="Search by name" value={query} onChange={setQuery} />
          <Btn type="submit">Search</Btn>
        </form>
      </div>
      <h1 className="mb-2 text-3xl font-bold">{user.username}</h1>
      <p className="mb-6 text-(--muted)">
        {summary.data?.collections.find((c) => c.key === kind)?.label}
      </p>
      <Status error={summary.error || action.error} />
      <Loading label="Loading admin data…" resource={resource}>
        {(data) => (
          <>
            <div className="grid gap-3">
              {data.rows.map((row) => (
                <div
                  key={row.id}
                  className="flex min-w-0 items-center gap-3 rounded-2xl border border-(--line) bg-(--surface) p-4"
                >
                  <Icon name="folder" />
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate">{row.label}</strong>
                    <small>
                      #{row.id}
                      {row.values.language
                        ? ` · ${row.values.language.toUpperCase()}`
                        : ""}
                    </small>
                  </div>
                  <Btn onClick={() => setEdit(row)}>View and edit</Btn>
                  <Btn onClick={() => setRemove(row)}>Delete</Btn>
                </div>
              ))}
              {!data.rows.length && (
                <p className="py-12 text-center text-(--muted)">
                  No data yet.
                </p>
              )}
            </div>
            <div className="toolbar centered">
              <Btn
                isDisabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Btn>
              <span>
                {page} · {data.total} items
              </span>
              <Btn
                isDisabled={page * 25 >= data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Sau
              </Btn>
            </div>
          </>
        )}
      </Loading>
      {edit && resource.data && (
        <RecordEditor
          key={`${kind}:${edit.id || "new"}`}
          row={edit.create ? null : edit}
          schema={resource.data.fields}
          base={base}
          url={`${base}${kind}/`}
          onClose={() => setEdit(null)}
          onSaved={reload}
        />
      )}
      {remove && (
        <Confirm
          title={`Delete ${remove.label}?`}
          description="Dependent data may also be deleted. This cannot be undone."
          onClose={() => setRemove(null)}
          onConfirm={async (signal) => {
            await request(
              `${base}${kind}/${remove.id}/`,
              "DELETE",
              undefined,
              signal,
            );
            reload();
          }}
        />
      )}
      {purge && (
        <PracticeModal
          title={`Delete data · ${user.username}`}
          onClose={() => setPurge(false)}
          pending={action.pending}
          size="md"
        >
          <p>
            Delete all owned folders, decks, exercises, progress, learning history, profile and classes in both languages. Keep the account and password; sign out existing sessions. This cannot be undone.
          </p>
          <Field
            label={`Import ${user.username} to confirm`}
            value={confirm}
            onChange={setConfirm}
          />
          <Status error={action.error} />
          <Btn
            isDisabled={confirm !== user.username}
            isLoading={action.pending}
            onClick={() =>
              action.run(async (signal) => {
                await request(base, "DELETE", { confirm }, signal);
                setPurge(false);
                setPage(1);
                reload();
              })
            }
          >
            Delete all data
          </Btn>
        </PracticeModal>
      )}
    </>
  );
}
