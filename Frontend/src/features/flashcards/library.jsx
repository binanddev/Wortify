import { useWindowActive } from "../../lib/core.js";
import {
  FolderTree,
  folderPath,
  folderAncestors,
} from "./flashcard-navigation.jsx";
import { PracticeModal } from "../practice/practice-workspace.jsx";
import { SidebarTools } from "../../components/ui/ui.jsx";
import { useEffect, useState } from "react";
import {
  useRoute,
  endpoint,
  request,
  useResource,
  useAction,
  useNavigate,
  shuffled,
} from "../../lib/core.js";
import {
  Btn,
  Icon,
  Glass,
  Page,
  Heading,
  Status,
  Loading,
  Field,
  Select,
  Editor,
  Confirm,
  Link,
  FlipCard,
  useSound,
} from "../../components/ui/ui.jsx";
const deckFields = [
  { name: "title", label: "Deck name", isRequired: true },
  { name: "description", label: "Description", multiline: true },
  { name: "topic", label: "Topic", advanced: true },
];
const cardFields = [
  { name: "german_text", label: "Vocabulary", isRequired: true },
  { name: "vietnamese_meaning", label: "Vietnamese meaning", isRequired: true },
  ...Object.entries({
    example_german: "Example sentence",
    example_vietnamese: "Example sentence meaning",
    part_of_speech: "Part of speech",
    article: "Article",
    plural_form: "Plural",
    notes: "Notes",
    usage: "Usage",
    accepted_answers: "Alternative answers (one per line)",
    accepted_examples: "Alternative example sentences (one per line)",
  }).map(([name, label]) => ({ name, label, advanced: true, multiline: true })),
];
function DeckOptions({ values, set, folders }) {
  return (
    <div className="grid two">
      <Select
        label="Folde"
        value={values.folder}
        onChange={(folder) => set({ ...values, folder })}
      >
        <option value="">My Flashcards</option>
        {folders.map((f) => (
          <option key={f.id} value={f.id}>
            {folderPath(folders, f)}
          </option>
        ))}
      </Select>
      <Select
        label="Level"
        value={values.level || "A1"}
        onChange={(level) => set({ ...values, level })}
      >
        {["A1", "A2", "B1", "B2", "C1", "C2"].map((v) => (
          <option key={v}>{v}</option>
        ))}
      </Select>
    </div>
  );
}
export function Library({ lang }) {
  const resource = useResource(endpoint(lang, "decks/"));
  return (
    <Loading resource={resource}>
      {(data) => (
        <LibraryContent
          key={lang}
          {...{ data, lang, reload: resource.reload }}
        />
      )}
    </Loading>
  );
}
function LibraryContent({ data, lang, reload }) {
  const navigate = useNavigate();
  const route = useRoute();
  const folder =
    new URLSearchParams(route.split("?")[1]).get("folder") || "all";
  const setFolder = (value) =>
    navigate(
      `/${lang}/flashcard${value === "all" ? "" : `?folder=${encodeURIComponent(value)}`}`,
    );
  const [query, setQuery] = useState(""),
    [sort, setSort] = useState("recent"),
    [edit, setEdit] = useState(null),
    [remove, setRemove] = useState(null),
    [panel, setPanel] = useState(null),
    [layout, setLayout] = useState("grid");
  const action = useAction();
  const api = (p, m, d, s) => request(endpoint(lang, p), m, d, s);
  let decks = data.decks.filter(
    (d) =>
      String(d.folder_id ?? "all") === folder &&
      `${d.title} ${d.description}`.toLowerCase().includes(query.toLowerCase()),
  );
  if (sort === "name") decks.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === "count") decks.sort((a, b) => b.count - a.count);
  const selected = data.folders.find((f) => String(f.id) === folder);
  const createHere = (type) => {
    if (folder !== "all" && !selected) return;
    setPanel(null);
    setEdit({ type, location: selected ? String(selected.id) : "" });
  };
  const search = query.trim().toLowerCase();
  const visibleFolders = data.folders.filter(
    (f) =>
      (f.parent_id ?? null) === (selected?.id ?? null) &&
      (!search ||
        data.folders.some(
          (child) =>
            folderAncestors(data.folders, child).some((a) => a.id === f.id) &&
            (child.name.toLowerCase().includes(search) ||
              data.decks.some(
                (d) =>
                  d.folder_id === child.id &&
                  `${d.title} ${d.description}`.toLowerCase().includes(search),
              )),
        )),
  );
  if (sort === "name")
    visibleFolders.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Page>
      <div className="flash-library-heading">
        <div>
          <h1>{selected?.name || "My Flashcards"}</h1>
        </div>
        <div className="flash-icon-row">
          <Btn
            icon="grid"
            aria-pressed={layout === "grid"}
            onClick={() => setLayout("grid")}
          >
            Grid view
          </Btn>
          <Btn
            icon="list"
            aria-pressed={layout === "list"}
            onClick={() => setLayout("list")}
          >
            List view
          </Btn>
        </div>
      </div>
      <Status error={action.error} />
      <div
        className={`mb-5 grid gap-3 ${layout === "list" ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"}`}
      >
        {selected?.parent_id && (
          <Btn
            icon="undo"
            onClick={() => setFolder(String(selected.parent_id))}
          >
            Back to parent folder
          </Btn>
        )}
        {visibleFolders.map((f) => (
          <button
            key={f.id}
            onClick={() => setFolder(String(f.id))}
            title={folderPath(data.folders, f)}
            className="flex items-center gap-3 rounded-2xl border border-(--line) bg-(--surface) px-4 py-3 font-semibold transition hover:-translate-y-0.5 hover:bg-(--solid)"
          >
            <Icon name="folder" />
            <span>{f.name}</span>
          </button>
        ))}
      </div>
      <SidebarTools>
        <div className="flash-nav">
          <Field
            label="Search folders or decks"
            value={query}
            onChange={setQuery}
            startContent={<Icon name="search" />}
          />
          <div className="flash-icon-row">
            <Btn primary icon="plus" onClick={() => setPanel("add")}>
              Add new
            </Btn>
            <Btn icon="settings" onClick={() => setPanel("settings")}>
              Sort and manage
            </Btn>
            <Btn
              icon="spark"
              isDisabled={!data.due}
              isLoading={action.pending}
              onClick={() =>
                action.run(async (signal) => {
                  const session = await api(
                    "sessions/",
                    "POST",
                    { kind: "learn", today: true },
                    signal,
                  );
                  navigate(`/${lang}/flashcard/session/${session.token}`);
                })
              }
            >{`Review today · ${data.due} cards`}</Btn>
            {data.resume && (
              <Link
                className="btn flash-icon-link"
                title="Continue session"
                aria-label="Continue session"
                to={`/${lang}/flashcard/session/${data.resume}`}
              >
                <Icon name="play" />
              </Link>
            )}
          </div>
          <div className="flash-folder-list" aria-label="Folde flashcard">
            {[{ id: "all", name: "My Flashcards", icon: "home" }].map((f) => (
              <button
                key={f.id}
                title={f.name}
                aria-current={folder === String(f.id) ? "page" : undefined}
                onClick={() => setFolder(String(f.id))}
              >
                <Icon name={f.icon || "folder"} />
                <span>{f.name}</span>
                <small>
                  {f.id === "all"
                    ? data.decks.length
                    : data.decks.filter(
                        (d) => String(d.folder_id ?? "") === String(f.id),
                      ).length}
                </small>
              </button>
            ))}
            <FolderTree
              folders={data.folders}
              decks={data.decks}
              lang={lang}
              selected={folder}
              onSelect={setFolder}
            />
          </div>
        </div>
      </SidebarTools>
      {panel && (
        <PracticeModal
          title={
            panel === "add"
              ? `Add to ${selected?.name || "My Flashcards"}`
              : "Library options"
          }
          size="md"
          onClose={() => setPanel(null)}
        >
          {panel === "add" ? (
            <div className="flash-action-menu">
              <Btn
                onClick={() => {
                  createHere("deck");
                }}
              >
                <Icon name="cards" /> Decks
              </Btn>
              <Btn
                onClick={() => {
                  createHere("folder");
                }}
              >
                <Icon name="folder" /> Folde
              </Btn>
            </div>
          ) : (
            <div className="flash-settings">
              <Select label="Sort" value={sort} onChange={setSort}>
                <option value="recent">Recently updated</option>
                <option value="name">Name A–Z</option>
                <option value="count">Card count</option>
              </Select>
              {selected && (
                <div className="flash-action-menu">
                  <Btn
                    onClick={() => {
                      setPanel(null);
                      setEdit({ type: "folder", item: selected });
                    }}
                  >
                    <Icon name="edit" /> Edit folder
                  </Btn>
                  <Btn
                    onClick={() => {
                      setPanel(null);
                      setRemove(selected);
                    }}
                  >
                    <Icon name="trash" /> Delete folder
                  </Btn>
                </div>
              )}
            </div>
          )}
        </PracticeModal>
      )}
      <div
        className={`deck-grid flash-library-grid ${layout === "list" ? "flash-library-list" : ""}`}
      >
        {decks.map((d) => (
          <Link
            className="deck-link"
            key={d.id}
            to={`/${lang}/flashcard/deck/${d.id}`}
          >
            <Glass className="deck-tile">
              <div className="tile-top">
                <span className="tile-icon">
                  <Icon name="cards" size={26} />
                </span>
                <span className="pill">{d.level}</span>
              </div>
              <h3>{d.title}</h3>
              {d.description && <p>{d.description}</p>}
              <div className="tile-bottom">
                <span>{d.count} terms</span>
                <Icon name="arrow" />
              </div>
              <div className="thin-progress">
                <span
                  style={{
                    width: `${d.count ? (d.mastered / d.count) * 100 : 0}%`,
                  }}
                />
              </div>
              <small>
                {d.mastered} mastered{d.due ? ` · ${d.due} due for review` : ""}
              </small>
            </Glass>
          </Link>
        ))}
      </div>
      {!decks.length && !visibleFolders.length && (
        <div className="flash-empty">
          <Icon name={query ? "search" : "cards"} size={36} />
          <p>
            {query
              ? "Content not found."
              : folder === "all"
                ? "No folders yet."
                : "This folder is empty."}
          </p>
          <Btn icon="plus" primary onClick={() => setPanel("add")}>
            Add new
          </Btn>
        </div>
      )}
      {edit && (
        <Editor
          key={`${edit.type}:${edit.item?.id ?? "new"}:${edit.location ?? ""}`}
          title={
            edit.type === "deck"
              ? "Create deck"
              : edit.item
                ? "Edit folder"
                : "New folder"
          }
          fields={
            edit.type === "deck"
              ? deckFields
              : [{ name: "name", label: "Folder name", isRequired: true }]
          }
          initial={
            edit.item
              ? { ...edit.item, parent: edit.item.parent_id ?? "" }
              : {
                  level: "A1",
                  parent: edit.location ?? "",
                  folder: edit.location ?? "",
                }
          }
          onClose={() => setEdit(null)}
          onSave={async (v, s) => {
            const result = await api(
              edit.type === "deck"
                ? "decks/"
                : `folders/${edit.item ? edit.item.id + "/" : ""}`,
              edit.item ? "PATCH" : "POST",
              edit.item
                ? v
                : {
                    ...v,
                    [edit.type === "folder" ? "parent" : "folder"]:
                      v[edit.type === "folder" ? "parent" : "folder"] ??
                      edit.location ??
                      "",
                  },
              s,
            );
            if (edit.type === "deck")
              navigate(`/${lang}/flashcard/deck/${result.id}`);
            else reload();
          }}
        >
          {edit.type === "deck"
            ? (values, set) => (
                <DeckOptions {...{ values, set, folders: data.folders }} />
              )
            : (values, set) => (
                <Select
                  label="Trong folde"
                  value={values.parent ?? ""}
                  onChange={(parent) => set({ ...values, parent })}
                >
                  <option value="">My Flashcards</option>
                  {data.folders
                    .filter(
                      (f) =>
                        !folderAncestors(data.folders, f).some(
                          (v) => v.id === edit.item?.id,
                        ),
                    )
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {folderPath(data.folders, f)}
                      </option>
                    ))}
                </Select>
              )}
        </Editor>
      )}
      {remove && (
        <Confirm
          title="Delete folder?"
          description={`Decks in “${remove.name}” will be kept.`}
          onClose={() => setRemove(null)}
          onConfirm={async (s) => {
            await api(`folders/${remove.id}/`, "DELETE", undefined, s);
            setFolder("all");
            reload();
          }}
        />
      )}
    </Page>
  );
}
export function Deck({ lang, id, sound }) {
  const resource = useResource(endpoint(lang, `decks/${id}/`));
  return (
    <Loading resource={resource}>
      {(data) => (
        <DeckContent {...{ lang, id, data, sound, reload: resource.reload }} />
      )}
    </Loading>
  );
}
function DeckContent({ lang, id, data, reload, sound }) {
 const windowActive = useWindowActive();
  const navigate = useNavigate();
  const [edit, setEdit] = useState(null),
    [remove, setRemove] = useState(null),
    [importing, setImporting] = useState(false),
    [mode, setMode] = useState("flash"),
    [view, setView] = useState("cards"),
    [count, setCount] = useState("20"),
    [filter, setFilter] = useState("all"),
    [order, setOrder] = useState(data.cards),
    [index, setIndex] = useState(0),
    [flipped, setFlipped] = useState(false),
    [reverse, setReverse] = useState(false),
    [auto, setAuto] = useState(false),
    [query, setQuery] = useState(""),
    [toolPanel, setToolPanel] = useState(null);
  const action = useAction(),
    audio = useSound(sound, lang);
  const api = (p, m, d, s) => request(endpoint(lang, p), m, d, s);
  const card = order[index];
  const flip = (v) => {
    setFlipped(v);
    audio.tick();
  };
  const step = (n) => {
    setIndex((i) => Math.max(0, Math.min(order.length - 1, i + n)));
    setFlipped(false);
  };
  useEffect(() => {
    const key = (e) => {
      if (!windowActive) return;
      if (
        e.target.closest("input,textarea,select,[role=dialog]") ||
        edit ||
        importing ||
        remove ||
        toolPanel
      )
        return;
      if (e.code === "Space" && e.target.closest("button")) return;
      if (e.code === "Space") {
        e.preventDefault();
        setFlipped((v) => !v);
      }
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [windowActive, order.length, edit, importing, remove, toolPanel]);
  useEffect(() => {
    if (!auto || !card || toolPanel || edit || importing || remove) return;
    const timer = setTimeout(() => {
      if (!flipped) setFlipped(true);
      else if (index < order.length - 1) step(1);
      else setAuto(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [auto, flipped, index, card, toolPanel, edit, importing, remove]);
  const start = () =>
    action.run(async (signal) => {
      if (
        ["spell", "write", "quiz", "speak", "order", "match"].includes(mode)
      ) {
        navigate(
          `/${lang}/flashcard/study?deck=${id}&mode=${mode}&filter=${filter}`,
        );
        return;
      }
      const s = await api(
        "sessions/",
        "POST",
        { kind: mode, deck: id, count: Number(count), filter },
        signal,
      );
      navigate(`/${lang}/flashcard/session/${s.token}`);
    });
  return (
    <Page>
      <Heading
        eyebrow={`${data.deck.level} · ${data.cards.length} TERM`}
        title={data.deck.title}
        description={data.deck.description}
        contentDescription
      />
      <SidebarTools>
        <div className="flash-icon-row">
          <Btn icon="upload" onClick={() => setImporting(true)}>
            Import list
          </Btn>
          <Btn
            icon="edit"
            onClick={() => setEdit({ type: "deck", item: data.deck })}
          >
            Rename deck
          </Btn>
          <Btn
            icon="cards"
            aria-pressed={view === "cards"}
            onClick={() => setView("cards")}
          >
            Study cards
          </Btn>
          <Btn
            icon="list"
            aria-pressed={view === "terms"}
            onClick={() => setView("terms")}
          >
            Term list
          </Btn>
          <Btn icon="plus" onClick={() => setEdit({ type: "card" })}>
            Add term
          </Btn>
          <Btn icon="play" onClick={() => setToolPanel("study")}>
            Session setup
          </Btn>
          <Btn icon="more" onClick={() => setToolPanel("manage")}>
            Export and manage
          </Btn>
        </div>
      </SidebarTools>
      <div className="study-layout">
        {view === "cards" && (
          <div>
            {card ? (
              <>
                <FlipCard
                  front={reverse ? card.vietnamese_meaning : card.german_text}
                  back={reverse ? card.german_text : card.vietnamese_meaning}
                  example={card.example_german}
                  {...{ flipped }}
                  setFlipped={flip}
                />
                <div className="card-navigation">
                  <Btn
                    aria-label="Previous card"
                    isDisabled={!index}
                    onClick={() => step(-1)}
                  >
                    <Icon name="chevron_left" />
                  </Btn>
                  <span>
                    {index + 1} <span className="muted">/ {order.length}</span>
                  </span>
                  <Btn
                    aria-label="Next card"
                    isDisabled={index === order.length - 1}
                    onClick={() => step(1)}
                  >
                    <Icon name="chevron_right" />
                  </Btn>
                </div>
                <div className="toolbar centered">
                  <Btn
                    icon="shuffle"
                    onClick={() => {
                      setOrder(shuffled(order));
                      setIndex(0);
                      setFlipped(false);
                    }}
                  >
                    Shuffle cards
                  </Btn>
                  <Btn
                    icon="flip"
                    aria-pressed={reverse}
                    onClick={() => {
                      setReverse(!reverse);
                      setFlipped(false);
                    }}
                  >
                    Swap sides
                  </Btn>
                  <Btn
                    icon="sound"
                    onClick={() =>
                      action.run(() => audio.speak(card.german_text))
                    }
                  >
                    Nghe
                  </Btn>
                  <Btn
                    icon={auto ? "pause" : "play"}
                    aria-pressed={auto}
                    onClick={() => setAuto(!auto)}
                  >
                    {auto ? "Ⅱ Stop" : "▷ Autoplay"}
                  </Btn>
                </div>
              </>
            ) : (
              <Glass>
                <h3>Add the first word to this deck</h3>

                <Btn
                  icon="plus"
                  primary
                  onClick={() => setEdit({ type: "card" })}
                >
                  Add term
                </Btn>
              </Glass>
            )}
          </div>
        )}
        {toolPanel === "study" && (
          <PracticeModal
            title="Study session"
            size="md"
            onClose={() => setToolPanel(null)}
          >
            <div className="flash-settings">
              <span className="tile-icon">
                <Icon name="spark" size={26} />
              </span>
              <Select label="Study mode" value={mode} onChange={setMode}>
                {[
                  ["flash", "Flashcards · Self-assessment"],
                  ["learn", "Learn · Memory practice"],
                  ["test", "Test · Check"],
                  ["quiz", "Multiple choice"],
                  ["write", "Recall and write"],
                  ["spell", "Listen and transcribe"],
                  ["order", "Arrange sentence"],
                  ["match", "Matching"],
                  ["speak", "Speaking practice"],
                ].map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </Select>
              {["flash", "learn", "test"].includes(mode) && (
                <Field
                  label="Number of questions"
                  type="number"
                  min="1"
                  max="100"
                  value={count}
                  onChange={setCount}
                />
              )}
              <Select label="Card scope" value={filter} onChange={setFilter}>
                {[
                  ["all", "All cards"],
                  ["due", "Due"],
                  ["weak", "Needs practice"],
                  ["new", "New cards"],
                ].map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </Select>
              <Btn
                primary
                isDisabled={
                  !data.cards.length || !Number(count) || Number(count) > 100
                }
                isLoading={action.pending}
                onClick={start}
              >
                Start learning <Icon name="arrow" />
              </Btn>
              <Status error={action.error} />
            </div>
          </PracticeModal>
        )}
      </div>
      {view === "terms" && (
        <>
          <div className="section-heading">
            <h2>
              Term <span className="count">{data.cards.length}</span>
            </h2>
            <Btn icon="plus" primary onClick={() => setEdit({ type: "card" })}>
              Add term
            </Btn>
          </div>
          <SidebarTools>
            <Field label="Search this deck" value={query} onChange={setQuery} />
          </SidebarTools>
          <div className="term-list">
            {data.cards
              .filter((c) =>
                `${c.german_text} ${c.vietnamese_meaning}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((c) => (
                <Glass className="term-row" key={c.id}>
                  <div>
                    <strong>{c.german_text}</strong>
                    <p>{c.example_german}</p>
                  </div>
                  <div>
                    {c.vietnamese_meaning}
                    <small>{c.example_vietnamese}</small>
                  </div>
                  <div className="toolbar">
                    <Btn
                      aria-label={`Move ${c.german_text}`}
                      onClick={() => setEdit({ type: "position", item: c })}
                    >
                      ↕
                    </Btn>
                    <Btn
                      icon="edit"
                      onClick={() => setEdit({ type: "card", item: c })}
                    >
                      Edit
                    </Btn>
                    <Btn
                      icon="trash"
                      onClick={() => setRemove({ type: "card", item: c })}
                    >
                      Delete
                    </Btn>
                  </div>
                </Glass>
              ))}
          </div>
        </>
      )}
      {toolPanel === "manage" && (
        <PracticeModal
          title="Manage decks"
          size="md"
          onClose={() => setToolPanel(null)}
        >
          <div className="flash-action-menu">
            <a className="btn" href={endpoint(lang, `decks/${id}/export/csv/`)}>
              <Icon name="download" /> CSV
            </a>
            <a
              className="btn"
              href={endpoint(lang, `decks/${id}/export/json/`)}
            >
              <Icon name="download" /> JSON
            </a>
            <Btn
              onClick={() => {
                setToolPanel(null);
                setRemove({ type: "deck", item: data.deck });
              }}
            >
              <Icon name="trash" /> Delete deck
            </Btn>
          </div>
        </PracticeModal>
      )}
      {edit && (
        <Editor
          title={
            edit.type === "deck"
              ? "Edit deck"
              : edit.type === "position"
                ? "Term position"
                : edit.item
                  ? "Edit term"
                  : "Add term"
          }
          fields={
            edit.type === "deck"
              ? deckFields
              : edit.type === "position"
                ? [
                    {
                      name: "position",
                      label: "Position (starting at 0)",
                      type: "number",
                      min: 0,
                      isRequired: true,
                    },
                  ]
                : cardFields
          }
          initial={
            edit.item
              ? {
                  ...edit.item,
                  accepted_answers: (edit.item.accepted_answers || []).join(
                    "\n",
                  ),
                  accepted_examples: (edit.item.accepted_examples || []).join(
                    "\n",
                  ),
                }
              : {}
          }
          onClose={() => setEdit(null)}
          onSave={async (v, s) => {
            if (edit.type === "position") {
              const ids = data.cards
                .map((c) => c.id)
                .filter((x) => x !== edit.item.id);
              ids.splice(
                Math.max(0, Math.min(ids.length, Number(v.position))),
                0,
                edit.item.id,
              );
              await api(`decks/${id}/reorder/`, "POST", { ids }, s);
              reload();
              return;
            }
            await api(
              edit.type === "deck"
                ? `decks/${id}/`
                : `decks/${id}/cards/${edit.item ? edit.item.id + "/" : ""}`,
              edit.item ? "PATCH" : "POST",
              v,
              s,
            );
            reload();
          }}
        >
          {edit.type === "deck"
            ? (values, set) => (
                <DeckOptions {...{ values, set, folders: data.folders }} />
              )
            : null}
        </Editor>
      )}
      {remove && (
        <Confirm
          title={remove.type === "deck" ? "Delete deck?" : "Delete this term?"}
          description="Content and related progress will be deleted. This cannot be undone."
          onClose={() => setRemove(null)}
          onConfirm={async (s) => {
            await api(
              remove.type === "deck"
                ? `decks/${id}/`
                : `decks/${id}/cards/${remove.item.id}/`,
              "DELETE",
              undefined,
              s,
            );
            if (remove.type === "deck") navigate(`/${lang}/flashcard`);
            else reload();
          }}
        />
      )}
      {importing && (
        <ImportCards
          {...{ api, id, reload }}
          onClose={() => setImporting(false)}
        />
      )}
    </Page>
  );
}
function ImportCards({ api, id, reload, onClose }) {
  const [preview, setPreview] = useState(null);
  return (
    <Editor
      title={
        preview
          ? `Confirm import ${preview.count} cards`
          : "Import terms"
      }
      fields={
        preview
          ? []
          : [
              {
                name: "text",
                label: "One line per term, meaning and optional example sentence",
                multiline: true,
                isRequired: true,
                minRows: 8,
              },
            ]
      }
      initial={{ separator: "," }}
      onClose={onClose}
      onSave={async (v, s) => {
        if (preview) {
          await api(`decks/${id}/import/`, "POST", { token: preview.token }, s);
          reload();
        } else {
          const p = await api(`decks/${id}/import/`, "POST", v, s);
          setPreview(p);
          return false;
        }
      }}
    >
      {(v, set) =>
        preview ? (
          <div>
            {preview.preview.map((r, i) => (
              <p key={i}>
                {r.german_text} — {r.vietnamese_meaning}
              </p>
            ))}
            <Btn icon="edit" onClick={() => setPreview(null)}>
              Edit imported content
            </Btn>
          </div>
        ) : (
          <Select
            label="Separator"
            value={v.separator}
            onChange={(separator) => set({ ...v, separator })}
          >
            {[
              [",", "Comma"],
              [";", "Semicolon"],
              ["\t", "Tab"],
              ["|", "Vertical bar"],
            ].map(([a, b]) => (
              <option key={a} value={a}>
                {b}
              </option>
            ))}
          </Select>
        )
      }
    </Editor>
  );
}
