import { useLearningSync } from "./learning-sync";
import { useEffect, useState } from "react";
import {
  request,
  endpoint,
  useResource,
  useAction,
  navigate,
  primeContentCache,
} from "./core";
import {
  Btn,
  Page,
  Heading,
  Field,
  Select,
  Status,
  SidebarTools,
  Link,
  Confirm,
  Glass,
  Icon,
  Editor,
} from "./ui";
import { PracticeActivity } from "./practice-activity";
import { ExerciseForm, prepareExercise } from "./exercise-authoring";
import {
  EXERCISE_TYPES,
  newExercise,
  previewData,
  titleOf,
} from "./exercise-types";
import { jsonTemplate, parseImport } from "./json-import";

// Keep loaded media alive across folder navigation; browser cache serves playback.
const preparedAudio = new Map();
function preloadAudio(nodes) {
  for (const node of nodes)
    for (const question of node.payload?.questions || []) {
      const url = question.presentation?.audio;
      if (!url || preparedAudio.has(url)) continue;
      const audio = new Audio();
      audio.preload = "auto";
      audio.src = url;
      preparedAudio.set(url, audio);
      audio.load();
    }
}

export function PracticeHub({ lang, id, userId, createKind }) {
  const sync = useLearningSync(userId, lang);
  const base = endpoint(lang, "practice-hub/nodes/"),
    resource = useResource(base, true),
    action = useAction();
  const [contents, setContents] = useState({}),
    [editing, setEditing] = useState(null),
    [remove, setRemove] = useState(null),
    [creatingFolder, setCreatingFolder] = useState(null),
    [moving, setMoving] = useState(null),
    [query, setQuery] = useState("");
  const nodes = resource.data?.nodes || [],
    selected = nodes.find((n) => String(n.id) === String(id)),
    current = contents[id] || (selected?.payload ? selected : null);
  useEffect(() => {
    if (!id || contents[id]) return;
    const c = new AbortController();
    request(`${base}${id}/`, "GET", undefined, c.signal)
      .then((d) => setContents((v) => ({ ...v, [id]: d.node })))
      .catch((e) => {
        if (e.name !== "AbortError") action.setError(e.message);
      });
    return () => c.abort();
  }, [id, base, resource.data]);
  useEffect(() => {
    if (!resource.data) return;
    const c = new AbortController();
    const preload = () =>
      request(`${base}?full=1`, "GET", undefined, c.signal)
        .then((d) => {
          if (c.signal.aborted) return;
          const map = Object.fromEntries(d.nodes.map((n) => [n.id, n]));
          setContents(map);
          preloadAudio(d.nodes);
          d.nodes.forEach((n) =>
            primeContentCache(`${base}${n.id}/`, { node: n }),
          );
        })
        .catch(() => {});
    const timer = setTimeout(preload, 150);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [resource.data, base]);
  useEffect(() => {
    setQuery("");
    setEditing(null);
  }, [id]);
  const refresh = () => {
    setContents({});
    resource.reload();
  };
  const parent =
    selected?.can_edit ? selected.kind === "folder" ? selected.id : selected.parent || null : null;
  const parentDepth = (() => {let depth=0,p=nodes.find(n=>n.id===parent);while(p){depth++;p=nodes.find(n=>n.id===p.parent);}return depth;})();
  const start = (kind, location = parent) => {
    if (kind === "folder") {
      setCreatingFolder({ parent: location, title: "" });
      return;
    }
    setEditing({
      kind,
      title: "",
      parent: location,
      links: [],
      payload:
        kind === "exercise"
          ? newExercise("short_answer")
          : kind === "theory"
            ? { format: "markdown", content: "" }
            : {},
    });
  };
  useEffect(() => {
    if (["folder", "exercise", "theory"].includes(createKind))
      setEditing({
        kind: createKind,
        title: "",
        parent: null,
        links: [],
        payload:
          createKind === "exercise"
            ? newExercise("short_answer")
            : createKind === "theory"
              ? { format: "markdown", content: "" }
              : {},
      });
  }, [createKind]);
  const save = (values) =>
    action.run(async (signal) => {
      const result = await request(
        `${base}${values.id ? `${values.id}/` : ""}`,
        values.id ? "PATCH" : "POST",
        values,
        signal,
      );
      setEditing(null);
      refresh();
      navigate(`/${lang}/practice/${result.node.id}`);
    });
  const shown = nodes.filter((n) =>
    query
      ? n.title.toLowerCase().includes(query.toLowerCase())
      : String(n.parent || "") ===
        String(selected?.kind === "folder" ? selected.id : "") || (!selected && !nodes.some(p=>p.id===n.parent)),
  );
  return (
    <Page>
      <SidebarTools>
        <Status error={sync.error} />
        <Field
          label="Tìm trong Practice Hub"
          value={query}
          onChange={setQuery}
        />
        <div className="hub-root-row">
          <Link to={`/${lang}/practice`}>
            <Icon name="folder" /> Tất cả nội dung
          </Link>
          <CreateMenu
            label="Tạo ở cấp gốc"
            onCreate={(kind) => start(kind, null)}
          />
        </div>
        {selected && (
          <div className="hub-location-row">
            <span>
              {nodes.find((n) => n.id === parent)?.title || "Cấp gốc"}
            </span>
            <CreateMenu
              label="Tạo tại vị trí hiện tại"
              allowFolder={parentDepth < 3}
              onCreate={(kind) => start(kind)}
            />
          </div>
        )}
        {creatingFolder && (
          <form
            className="folder-inline"
            onSubmit={(e) => {
              e.preventDefault();
              action.run(async (signal) => {
                const result = await request(
                  base,
                  "POST",
                  { kind: "folder", ...creatingFolder },
                  signal,
                );
                setCreatingFolder(null);
                refresh();
                navigate(`/${lang}/practice/${result.node.id}`);
              });
            }}
          >
            <Field
              label="Tên thư mục"
              autoFocus
              isRequired
              value={creatingFolder.title}
              onChange={(title) => setCreatingFolder((v) => ({ ...v, title }))}
            />
            <button
              type="submit"
              aria-label="Tạo thư mục"
              disabled={action.pending}
            >
              ✓
            </button>
            <button
              type="button"
              aria-label="Hủy tạo thư mục"
              onClick={() => setCreatingFolder(null)}
            >
              ×
            </button>
          </form>
        )}
        <nav className="hub-tree" aria-label="Cây nội dung">
          <HubTree
            {...{ nodes, lang, id }}
            onCreate={start}
            onMove={setMoving}
          />
        </nav>
      </SidebarTools>
      <Status error={resource.error || action.error} />
      {editing ? (
        <HubEditor
          key={editing.id || `${editing.kind}:${editing.parent}`}
          value={editing}
          nodes={nodes}
          onSave={save}
          onClose={() => {
            setEditing(null);
            if (createKind) navigate(`/${lang}/practice`);
          }}
          pending={action.pending}
        />
      ) : (
        <>
          <Heading
            title={selected?.title || "Practice Hub"}
            description={
              !selected ? "Chọn nội dung theo nhịp học của bạn." : undefined
            }
            actions={
              selected?.can_edit ? (
                <>
                  <Btn className="hub-action" aria-label="Chỉnh sửa" title="Chỉnh sửa"
                    onClick={() =>
                      current
                        ? setEditing(current)
                        : action.setError(
                            "Nội dung đang tải, thử lại ngay sau đó.",
                          )
                    }
                  >
                    <Icon name="edit" />
                  </Btn>
                  <Btn className="hub-action" aria-label="Di chuyển" title="Di chuyển" onClick={() => setMoving(selected)}>
                    <Icon name="folder" />
                  </Btn>
                  <Btn
                    className="hub-action"
                    aria-label="Xóa nội dung"
                    title="Xóa nội dung"
                    onClick={() => setRemove(selected)}
                  >
                    ×
                  </Btn>
                </>
              ) : null
            }
          />
          {selected?.parent && (
            <Link to={`/${lang}/practice/${selected.parent}`}>
              ← Thư mục cha
            </Link>
          )}
          {!selected || selected.kind === "folder" || query ? (
            <div className="hub-grid">
              {shown.map((n) => (
                <Link
                  key={n.id}
                  to={`/${lang}/practice/${n.id}`}
                  className="hub-tile"
                >
                  <span>
                    {n.kind === "folder"
                      ? "▤"
                      : n.kind === "theory"
                        ? "◈"
                        : "✎"}
                  </span>
                  <strong>{n.title}</strong>
                  <small>
                    {n.kind === "folder"
                      ? `${nodes.filter((c) => c.parent === n.id).length} nội dung`
                      : n.kind === "theory"
                        ? "Lý thuyết"
                        : "Bài tập"}
                  </small>
                </Link>
              ))}
              {!shown.length && (
                <p>
                  {resource.loading ? "Đang mở nội dung…" : "Chưa có nội dung"}
                </p>
              )}
            </div>
          ) : !current ? (
            <p>Đang mở bài…</p>
          ) : current.kind === "theory" ? (
            <TheoryActivity payload={current.payload} />
          ) : (
            <PracticeActivity
              key={`${userId}:${id}:${current.updated_at}`}
              data={previewData(current.payload)}
              id={`hub-${id}:${current.updated_at}`}
              onComplete={(answers) => {
                sync.enqueue("practice", {
                  node: Number(id),
                  revision: current.updated_at,
                  answers,
                });
                sync.flush();
              }}
              userId={userId}
              lang={lang}
              practiceOnly
            />
          )}
          {current?.links?.length > 0 && (
            <section className="related-practice">
              <h2>Học tiếp</h2>
              {current.links.map((target) => {
                const node = nodes.find((n) => n.id === target);
                return (
                  node && (
                    <Link
                      className="btn"
                      key={target}
                      to={`/${lang}/practice/${target}`}
                    >
                      {node.kind === "folder" ? "▤" : "→"} {node.title}
                    </Link>
                  )
                );
              })}
            </section>
          )}
        </>
      )}
      {moving && (
        <MoveNode
          node={moving}
          nodes={nodes}
          onClose={() => setMoving(null)}
          onSave={async (values, signal) => {
            await request(
              `${base}${moving.id}/`,
              "PATCH",
              { parent: values.parent ? Number(values.parent) : null },
              signal,
            );
            refresh();
          }}
        />
      )}
      {remove && (
        <Confirm
          title={`Xóa ${remove.title}?`}
          description="Thư mục và toàn bộ nội dung con sẽ bị xóa."
          onClose={() => setRemove(null)}
          onConfirm={async (signal) => {
            await request(`${base}${remove.id}/`, "DELETE", undefined, signal);
            setRemove(null);
            refresh();
            navigate(`/${lang}/practice`);
          }}
        />
      )}
    </Page>
  );
}
function CreateMenu({ label, onCreate, allowFolder = true }) {
  return (
    <details className="hub-create">
      <summary aria-label={label} title={label}>
        <Icon name="plus" size={18} />
      </summary>
      <div>
        {[
          ["folder", "folder", "Thư mục"],
          ["exercise", "edit", "Bài tập"],
          ["theory", "book", "Lý thuyết"],
        ]
          .filter(([kind]) => allowFolder || kind !== "folder")
          .map(([kind, icon, label]) => (
            <button
              key={kind}
              onClick={(e) => {
                e.currentTarget.closest("details").open = false;
                onCreate(kind);
              }}
            >
              <Icon name={icon} />
              {label}
            </button>
          ))}
      </div>
    </details>
  );
}
function HubTree({
  nodes,
  lang,
  id,
  parent = null,
  depth = 0,
  onCreate,
  onMove,
}) {
  if (depth > 3) return null;
  return nodes
    .filter(
      (n) =>
        n.parent === parent ||
        (parent === null && !nodes.some((p) => p.id === n.parent)),
    )
    .map((n) => (
      <TreeBranch
        key={n.id}
        {...{ nodes, lang, id, depth, onCreate, onMove }}
        node={n}
      />
    ));
}
function TreeBranch({ nodes, lang, id, depth, onCreate, onMove, node }) {
  const contains = () => {
    let current = nodes.find((n) => String(n.id) === String(id));
    const seen = new Set();
    while (current && !seen.has(current.id)) {
      if (current.id === node.id) return true;
      seen.add(current.id);
      current = nodes.find((n) => n.id === current.parent);
    }
    return false;
  };
  const [open, setOpen] = useState(contains);
  useEffect(() => {
    if (contains()) setOpen(true);
  }, [id]);
  const folder = node.kind === "folder";
  return (
    <div className="hub-branch">
      <div
        className={`hub-tree-row ${String(node.id) === String(id) ? "active" : ""}`}
      >
        {folder ? (
          <button
            className="tree-toggle"
            aria-label={`${open ? "Thu gọn" : "Mở rộng"} ${node.title}`}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "⌄" : "›"}
          </button>
        ) : (
          <span className="tree-spacer" />
        )}
        <Link
          to={`/${lang}/practice/${node.id}`}
          aria-current={String(node.id) === String(id) ? "page" : undefined}
        >
          <Icon
            name={folder ? "folder" : node.kind === "theory" ? "book" : "edit"}
            size={18}
          />
          <span>{node.title}</span>
        </Link>
        {node.can_edit && (
          <>
            <button
              className="tree-move"
              aria-label={`Di chuyển ${node.title}`}
              title="Di chuyển"
              onClick={() => onMove(node)}
            >
              ↗
            </button>
            {folder && (
              <CreateMenu
                allowFolder={depth < 2}
                label={`Thêm vào ${node.title}`}
                onCreate={(kind) => onCreate(kind, node.id)}
              />
            )}
          </>
        )}
      </div>
      {folder && open && (
        <div className="hub-children">
          <HubTree
            {...{ nodes, lang, id, onCreate, onMove }}
            parent={node.id}
            depth={depth + 1}
          />
        </div>
      )}
    </div>
  );
}
function MoveNode({ node, nodes, onClose, onSave }) {
  const excluded = new Set([node.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of nodes)
      if (excluded.has(n.parent) && !excluded.has(n.id)) {
        excluded.add(n.id);
        changed = true;
      }
  }
  const path = (n) => {
    const names = [n.title];
    let p = nodes.find((x) => x.id === n.parent);
    while (p) {
      names.unshift(p.title);
      p = nodes.find((x) => x.id === p.parent);
    }
    return names.join(" / ");
  };
  return (
    <Editor
      title={`Di chuyển ${node.title}`}
      fields={[]}
      initial={{ parent: node.parent || "" }}
      onClose={onClose}
      onSave={onSave}
    >
      {(values, set) => (
        <Select
          label="Thư mục đích"
          value={values.parent}
          onChange={(parent) => set({ parent })}
        >
          <option value="">Cấp gốc</option>
          {nodes
            .filter(
              (n) => n.kind === "folder" && n.can_edit && !excluded.has(n.id),
            )
            .map((n) => (
              <option key={n.id} value={n.id}>
                {path(n)}
              </option>
            ))}
        </Select>
      )}
    </Editor>
  );
}
function HubEditor({ value, nodes, onSave, onClose, pending }) {
  const [v, set] = useState(() => structuredClone(value)),
    [preview, setPreview] = useState(false),
    [error, setError] = useState("");
  const change = (patch) => set((x) => ({ ...x, ...patch }));
  const upload = async (file, apply) => {
    if (file.size > 1000000) {
      setError(
        "Tệp âm thanh tối đa 1 MB cho nội dung tải trước. Có thể dùng URL cho tệp lớn.",
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => apply(reader.result);
    reader.readAsDataURL(file);
  };
  return (
    <div className="hub-editor">
      <Heading
        title={`${v.id ? "Sửa" : "Tạo"} ${{ folder: "thư mục", exercise: "bài tập", theory: "lý thuyết" }[v.kind]}`}
      />
      <div className="toolbar">
        <Btn onClick={onClose}>Đóng bản nháp</Btn>
        <Btn
          primary
          isLoading={pending}
          onClick={() => {
            try {
              onSave({
                ...v,
                title: v.kind === "exercise" ? v.payload.title : v.title,
                payload:
                  v.kind === "exercise"
                    ? prepareExercise(v.payload)
                    : v.payload,
              });
            } catch (e) {
              setError(e.message);
            }
          }}
        >
          Lưu nội dung
        </Btn>
      </div>
      <Status error={error} />
      <Select
        label="Chia sẻ"
        value={v.visibility || "private"}
        onChange={(visibility) => change({ visibility })}
      >
        <option value="private">Riêng tư</option>
        <option value="public">Công khai</option>
      </Select>
      {v.kind !== "exercise" && (
        <Field
          label="Tên nội dung"
          value={v.title}
          onChange={(title) => change({ title })}
        />
      )}
      {v.kind === "exercise" && (
        <>
          <Select
            label="Dạng bài"
            value={v.payload.presentation?.interaction || "short_answer"}
            onChange={(mode) => {
              if (mode === "theory") return;
              change({ payload: newExercise(mode) });
            }}
          >
            {EXERCISE_TYPES.map(([key, title]) => (
              <option key={key} value={key}>
                {title}
              </option>
            ))}
          </Select>
          <Btn onClick={() => setPreview(!preview)}>
            {preview ? "Trở lại soạn bài" : "Xem trước"}
          </Btn>
          {preview ? (
            <PracticeActivity
              key={JSON.stringify(v.payload)}
              data={previewData(prepareExercise(v.payload))}
              preview
              practiceOnly
            />
          ) : (
            <ExerciseForm
              exercise={v.payload}
              onChange={(patch) =>
                change({ payload: { ...v.payload, ...patch } })
              }
              onUpload={upload}
            />
          )}
          <QuestionImport
            exercise={v.payload}
            onApply={(questions) =>
              change({
                payload: {
                  ...v.payload,
                  questions: [...v.payload.questions, ...questions],
                },
              })
            }
          />
        </>
      )}
      {v.kind === "theory" && (
        <>
          <label className="select-field">
            Tải lên HTML / Markdown
            <input
              type="file"
              accept=".html,.htm,.md,.markdown,text/html,text/markdown"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 2000000) {
                  setError("Tệp tối đa 2 MB.");
                  return;
                }
                change({
                  title: v.title || f.name,
                  payload: {
                    format: /\.html?$/i.test(f.name) ? "html" : "markdown",
                    content: await f.text(),
                  },
                });
              }}
            />
          </label>
          <Select
            label="Định dạng"
            value={v.payload.format}
            onChange={(format) => change({ payload: { ...v.payload, format } })}
          >
            <option value="markdown">Markdown</option>
            <option value="html">HTML</option>
          </Select>
          <Field
            multiline
            rows={14}
            label="Nội dung lý thuyết"
            value={v.payload.content}
            onChange={(content) =>
              change({ payload: { ...v.payload, content } })
            }
          />
          <TheoryActivity payload={v.payload} />
        </>
      )}
      <details>
        <summary>Liên kết học tiếp · Không bắt buộc</summary>
        {nodes
          .filter((n) => n.id !== v.id)
          .map((n) => (
            <label className="check-line" key={n.id}>
              <input
                type="checkbox"
                checked={v.links.includes(n.id)}
                onChange={(e) =>
                  change({
                    links: e.target.checked
                      ? [...v.links, n.id]
                      : v.links.filter((id) => id !== n.id),
                  })
                }
              />
              {n.title}
            </label>
          ))}
      </details>
    </div>
  );
}
export function TheoryActivity({ payload }) {
  const escaped = String(payload.content || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  const content =
    payload.format === "html"
      ? payload.content
      : escaped
          .replace(/^### (.+)$/gm, "<h3>$1</h3>")
          .replace(/^## (.+)$/gm, "<h2>$1</h2>")
          .replace(/^# (.+)$/gm, "<h1>$1</h1>")
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          .replace(/\n/g, "<br/>");
  return (
    <iframe
      className="hub-theory"
      sandbox=""
      title="Nội dung lý thuyết"
      srcDoc={`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{font:19px/1.8 system-ui;margin:24px;color:#17253d;background:#f6f9fd}img,video{max-width:100%}pre{white-space:pre-wrap}a{color:#1854cf}</style>${content}`}
    />
  );
}
function HubImport({ lang, parent, onClose, onSaved }) {
  const [scope, setScope] = useState("folder"),
    [mode, setMode] = useState("short_answer"),
    [text, setText] = useState(""),
    [checked, setChecked] = useState(null);
  const action = useAction();
  const exercise = {
    kind: "exercise",
    title: "Bài mẫu",
    payload: jsonTemplate("exercise", mode),
  };
  const template = {
    nodes: [
      scope === "folder"
        ? {
            kind: "folder",
            title: "Thư mục mẫu",
            children: [
              exercise,
              {
                kind: "theory",
                title: "Lý thuyết mẫu",
                payload: {
                  format: "markdown",
                  content: "# Kiến thức\n\nNội dung của bạn.",
                },
              },
            ],
          }
        : scope === "theory"
          ? {
              kind: "theory",
              title: "Lý thuyết",
              payload: { format: "markdown", content: "# Kiến thức" },
            }
          : exercise,
    ],
  };
  return (
    <Glass className="hub-import">
      <h2>Nhập Practice Hub bằng JSON</h2>
      <p>
        Cấu trúc nodes; mỗi mục có kind, title và payload. Thư mục dùng children
        để lồng nội dung, tối đa 3 cấp thư mục. Có thể trộn bài tập và lý thuyết
        ở mọi cấp. Các mục được thêm vào vị trí hiện tại.
      </p>
      <Select label="Mẫu" value={scope} onChange={setScope}>
        <option value="folder">Thư mục + bài + lý thuyết</option>
        <option value="exercise">Bài tập riêng lẻ</option>
        <option value="theory">Lý thuyết riêng lẻ</option>
      </Select>
      <Select label="Dạng bài mẫu" value={mode} onChange={setMode}>
        {EXERCISE_TYPES.map(([k, t]) => (
          <option key={k} value={k}>
            {t}
          </option>
        ))}
      </Select>
      <a
        className="btn"
        download="practice-hub.json"
        href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(template, null, 2))}`}
      >
        Tải mẫu JSON
      </a>
      <Btn
        onClick={() => {
          setText(JSON.stringify(template, null, 2));
          setChecked(null);
        }}
      >
        Dùng mẫu
      </Btn>
      <label>
        Chọn tệp JSON
        <input
          type="file"
          accept=".json"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.size > 10000000) {
              action.setError("Tối đa 10 MB.");
              return;
            }
            setText(await f.text());
            setChecked(null);
          }}
        />
      </label>
      <Field
        multiline
        rows={16}
        label="JSON"
        value={text}
        onChange={(v) => {
          setText(v);
          setChecked(null);
        }}
      />
      <Status error={action.error} />
      {checked && (
        <p>
          {checked.nodes.length} mục ở cấp đầu, sẵn sàng nhập. Máy chủ sẽ kiểm
          tra toàn bộ nội dung và độ sâu trước khi lưu.
        </p>
      )}
      <div className="toolbar">
        <Btn onClick={onClose}>Đóng</Btn>
        <Btn
          onClick={() =>
            action.run(() => {
              const data = JSON.parse(text);
              if (!Array.isArray(data.nodes) || !data.nodes.length)
                throw new Error("Cần mảng nodes không rỗng.");
              setChecked(data);
            })
          }
        >
          Kiểm tra JSON
        </Btn>
        <Btn
          primary
          isDisabled={!checked}
          isLoading={action.pending}
          onClick={() =>
            action.run(async (signal) => {
              await request(
                endpoint(lang, "practice-hub/import/"),
                "POST",
                { ...checked, parent },
                signal,
              );
              onSaved();
            })
          }
        >
          Nhập nội dung
        </Btn>
      </div>
    </Glass>
  );
}

function QuestionImport({ exercise, onApply }) {
  const [text, setText] = useState(""),
    [error, setError] = useState("");
  const template = {
    questions: jsonTemplate(
      "exercise",
      exercise.presentation?.interaction || "short_answer",
    ).questions,
  };
  return (
    <details>
      <summary>Thêm câu hỏi bằng JSON</summary>
      <p>
        Dán đối tượng có mảng questions, dùng cùng dạng với bài đang soạn. Câu
        mới được nối vào cuối; toàn bộ bài được kiểm tra khi lưu.
      </p>
      <a
        className="btn"
        download="practice-questions.json"
        href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(template, null, 2))}`}
      >
        Tải mẫu câu hỏi
      </a>
      <Field
        multiline
        rows={8}
        label="JSON câu hỏi"
        value={text}
        onChange={setText}
      />
      <Status error={error} />
      <Btn
        onClick={() => {
          try {
            const data = parseImport(text, "question");
            if (
              !Array.isArray(data.questions) ||
              !data.questions.length ||
              data.questions.some(
                (q) => !q || typeof q !== "object" || Array.isArray(q),
              )
            )
              throw new Error("Cần mảng questions không rỗng.");
            if (exercise.questions.length + data.questions.length > 100)
              throw new Error("Mỗi bài tối đa 100 câu.");
            onApply(data.questions);
            setText("");
            setError("");
          } catch (e) {
            setError(e.message);
          }
        }}
      >
        Thêm vào bản nháp
      </Btn>
    </details>
  );
}
