import VisibilitySelect from "../../components/ui/VisibilitySelect.jsx";
import WorkspaceManager from "./workspace-manager.jsx";
import ContentSwitcher from "../../components/navigation/content-switcher.jsx";
import { t as tr, useLocale } from "../../i18n/index.js";
import { cardFields } from "./card-fields.js";
import { FlashcardAiHelp } from "./flashcard-ai-help.jsx";
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

function DeckOptions({ values, set, folders }) {
  useLocale();
  return (
    <div className="grid two">
      <Select
        label={tr("Folde")}
        value={values.folder}
        onChange={(folder) => set({ ...values, folder })}
      >
        <option value="">{tr("My Flashcards")}</option>
        {folders.map((f) => (
          <option key={f.id} value={f.id}>
            {folderPath(folders, f)}
          </option>
        ))}
      </Select>
      <VisibilitySelect isNew={!values.id} value={values.visibility || "private"} onChange={visibility=>set({...values,visibility})} />
      <Select
        label={tr("Level")}
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
export function Library({ lang, interfaceName }) {
  useLocale();
  const resource = useResource(endpoint(lang, "decks/"), true);
  return (
    <Loading resource={resource}>
      {(data) => (
        <LibraryContent
          key={lang}
          {...{ data, lang, interfaceName, reload: resource.reload }}
        />
      )}
    </Loading>
  );
}
function LibraryContent({ data, lang, interfaceName, reload }) {
  useLocale();
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
  const [selecting, setSelecting] = useState(false);
  const [checked, setChecked] = useState([]);
  const [bulk, setBulk] = useState(null);
  const [destination, setDestination] = useState("");
  useEffect(() => { setChecked([]); }, [folder, query]);
  const action = useAction();
  const api = (p, m, d, s) => request(endpoint(lang, p), m, d, s);
  let decks = data.decks.filter(
    (d) =>
      (selecting && folder === "all" || String(d.folder_id ?? "all") === folder) &&
      `${d.title} ${d.description}`.toLowerCase().includes(query.toLowerCase()),
  );
  if (sort === "name") decks.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === "count") decks.sort((a, b) => b.count - a.count);
  const selected = data.folders.find((f) => String(f.id) === folder);
  const toggleDeck = id => setChecked(ids => ids.includes(id) ? ids.filter(v => v !== id) : [...ids,id]);
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

  const runBulk = async (signal) => {
    const failures = [];
    for (const id of checked) {
      try {
        await api(`decks/${id}/`, bulk === "delete" ? "DELETE" : "PATCH", bulk === "delete" ? undefined : {folder: destination}, signal);
      } catch (error) { if (error.name === "AbortError") throw error; failures.push(id); }
    }
    setChecked(failures);
    reload();
    if (failures.length) throw new Error(tr("Some decks could not be updated. Please retry."));
    setBulk(null); setSelecting(false);
  };
  return (
    <Page>
      <div className="flash-library-heading">
        <div>
          <h1>
            {selected?.name || (
              <>
                <span className="studio-title-lead">{tr("My")}</span>{tr(" Flashcards")}</>
            )}
          </h1>
        </div>
        <div className="flash-icon-row">
          <Btn
            icon="grid"
            aria-pressed={layout === "grid"}
            onClick={() => setLayout("grid")}
          >{tr("Grid view")}</Btn>
          <Btn
            icon="list"
            aria-pressed={layout === "list"}
            onClick={() => setLayout("list")}
          >{tr("List view")}</Btn>
        </div>
      </div>
      <Status error={action.error} />
      {bulk === "delete" && <Confirm title={tr("Delete selected decks?")} description={tr("The selected decks, cards and learning progress will be permanently deleted.")} onClose={() => setBulk(null)} onConfirm={runBulk}/>}
      {bulk === "move" && <PracticeModal title={tr("Move to folder")} onClose={() => setBulk(null)} size="md">
        <Status error={action.error}/>
        <Select label={tr("Folder")} value={destination} onChange={setDestination}>
          <option value="">{tr("My Flashcards")}</option>
          {data.folders.map(f => <option key={f.id} value={f.id}>{folderPath(data.folders,f)}</option>)}
        </Select>
        <Btn isDisabled={action.pending} onClick={() => action.run(runBulk)}>{tr("Move")}</Btn>
      </PracticeModal>}
      {!selecting && <div
        className={`mb-5 grid gap-3 ${layout === "list" ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"}`}
      >
        {selected?.parent_id && (
          <Btn
            icon="undo"
            onClick={() => setFolder(String(selected.parent_id))}
          >{tr("Back to parent folder")}</Btn>
        )}
        {visibleFolders.map((f) => (
          <button
            key={f.id}
            onClick={() => setFolder(String(f.id))}
            title={folderPath(data.folders, f)}
            className="notebook-folder-tab flex items-center gap-3 rounded-2xl border border-(--line) bg-(--surface) px-4 py-3 font-semibold transition hover:-translate-y-0.5 hover:bg-(--solid)"
          >
            <Icon name="folder" />
            <span>{f.name}</span>
          </button>
        ))}
      </div>}
      <SidebarTools>
        <div className="flash-nav">
          <Field
            label={tr("Search folders or decks")}
            value={query}
            onChange={setQuery}
            startContent={<Icon name="search" />}
          />
          <div className="flash-icon-row">
            <Link className="btn flash-icon-link" to={`/${lang}/flashcard/discover`} title={tr("Explore")} aria-label={tr("Explore")}><Icon name="search"/></Link>
            <Btn primary icon="plus" onClick={() => setPanel("add")}>{tr("Add new")}</Btn>
            <Btn icon="select" aria-pressed={selecting} onClick={() => { setSelecting(!selecting); setChecked([]); }}>{tr("Select decks")}</Btn>
            <Btn icon="settings" onClick={() => { setPanel("settings"); }}>{tr("Workspace options")}</Btn>
            {data.resume && (
              <Link
                className="btn flash-icon-link"
                title={tr("Continue session")}
                aria-label={tr("Continue session")}
                to={`/${lang}/flashcard/session/${data.resume}`}
              >
                <Icon name="play" />
              </Link>
            )}
          </div>
          {selecting && <section className="flash-nav-selection" aria-label={tr("Select decks")}>
            <div className="flash-selection-summary"><span role="status">{tr("{count} selected", {count:checked.length})}</span><Btn icon="close" onClick={() => { setSelecting(false); setChecked([]); }}>{tr("Cancel selection")}</Btn></div>
            <label><input type="checkbox" checked={decks.length > 0 && decks.every(d => checked.includes(d.id))} ref={el => { if(el) el.indeterminate=checked.length>0 && !decks.every(d=>checked.includes(d.id)); }} onChange={e => setChecked(e.target.checked ? decks.map(d => d.id) : [])}/>{tr("Select all")}</label>
            <div className="flash-icon-row">
              <Btn icon="folder" isDisabled={!checked.length} onClick={() => { setDestination(""); setBulk("move"); }}>{tr("Move to folder")}</Btn>
              <Btn icon="trash" isDisabled={!checked.length} onClick={() => setBulk("delete")}>{tr("Delete selected")}</Btn>
            </div>
          </section>}
          <div className="flash-folder-list" aria-label={tr("Folde flashcard")}>
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
      {panel === "settings" && <WorkspaceManager lang={lang} onClose={() => setPanel(null)} onChanged={() => { setChecked([]); reload(); }}/>}
      {panel && panel !== "settings" && (
        <PracticeModal
          title={
            panel === "add"
              ? tr("Add to {v0}", { v0: selected?.name || "My Flashcards" })
              : tr("Workspace options")
          }
          size="md"
          onClose={() => setPanel(null)}
        >
            <div className="flash-action-menu">
              <Btn
                onClick={() => {
                  createHere("deck");
                }}
              >
                <Icon name="cards" />{tr(" Decks")}</Btn>
              <Btn
                onClick={() => {
                  createHere("folder");
                }}
              >
                <Icon name="folder" />{tr(" Folde")}</Btn>
            </div>
        </PracticeModal>
      )}
      <div
        className={`deck-grid flash-library-grid ${layout === "list" ? "flash-library-list" : ""}`}
      >
        {decks.map((d) => (
          <div key={d.id} className={`flash-deck-item ${selecting ? "selecting" : ""} ${checked.includes(d.id) ? "is-selected" : ""}`}>
          <Link
            className="deck-link"
            to={`/${lang}/flashcard/deck/${d.id}`}
            role={selecting ? "checkbox" : undefined}
            aria-checked={selecting ? checked.includes(d.id) : undefined}
            aria-label={selecting ? tr("Select {title}",{title:d.title}) : undefined}
            onKeyDown={e => { if(selecting && e.key === " ") { e.preventDefault(); toggleDeck(d.id); } }}
            onClick={e => { if(selecting) { e.preventDefault(); toggleDeck(d.id); } }}
          >
            <Glass className="deck-tile">
              {selecting && <span className="deck-pick-mark" aria-hidden="true"><Icon name={checked.includes(d.id) ? "check" : "select"} size={18}/></span>}
              <div className="tile-top">
                <span className="tile-icon">
                  <Icon name="cards" size={26} />
                </span>
                <span className="pill">{d.level}</span>
              </div>
              <h3>{d.title}</h3>
              {d.description && <p>{d.description}</p>}
              <div className="tile-bottom">
                <span>{d.count}{tr(" terms")}</span>
                <Icon name="arrow" />
              </div>
              <div className="thin-progress">
                <span
                  style={{
                    width: `${d.count ? (d.mastered / d.count) * 100 : 0}%`,
                  }}
                />
              </div>
              <small>{d.mastered}{tr(" mastered")}</small>
            </Glass>
          </Link>
          </div>
        ))}
      </div>
      {!decks.length && !visibleFolders.length && (
        <div className="flash-empty">
          <Icon name={query ? "search" : "cards"} size={36} />
          <p>
            {query
              ? tr("Content not found.")
              : folder === "all"
                ? tr("No folders yet.")
                : tr("This folder is empty.")}
          </p>
          <Btn icon="plus" primary onClick={() => setPanel("add")}>{tr("Add new")}</Btn>
        </div>
      )}
      {edit && (
        <Editor
          key={`${edit.type}:${edit.item?.id ?? "new"}:${edit.location ?? ""}`}
          title={
            edit.type === "deck"
              ? tr("Create deck")
              : edit.item
                ? tr("Edit folder")
                : tr("New folder")
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
                  label={tr("Trong folde")}
                  value={values.parent ?? ""}
                  onChange={(parent) => set({ ...values, parent })}
                >
                  <option value="">{tr("My Flashcards")}</option>
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
          title={tr("Delete folder?")}
          description={tr("Decks in “{v0}” will be kept.", { v0: remove.name })}
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
  useLocale();
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
  useLocale();
  const [selected, setSelected] = useState([]);

  const windowActive = useWindowActive();
  const navigate = useNavigate();
  const [edit, setEdit] = useState(null),
    [remove, setRemove] = useState(null),
    [importing, setImporting] = useState(false),
    [mode, setMode] = useState("flash"),
    [view, setView] = useState("terms"),
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
  const visibleCards = data.cards.filter((c) =>
    `${c.german_text} ${c.vietnamese_meaning}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const card = order[index];
  useEffect(() => {
    setOrder(data.cards);
    setSelected((ids) =>
      ids.filter((id) => data.cards.some((c) => c.id === id)),
    );
  }, [data.cards]);
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
    <Page className="flashcard-workspace">
      <Heading
        eyebrow={tr("{v0} · {v1} TERM", { v0: data.deck.level, v1: data.cards.length })}
        title={data.deck.title}
        description={data.deck.description}
        contentDescription
      />
      <SidebarTools>
        <div className="flash-icon-row">
          <Link className="btn flash-icon-link" to={`/${lang}/flashcard`} title={tr("My Flashcards")} aria-label={tr("My Flashcards")}><Icon name="home"/></Link>
          <ContentSwitcher lang={lang} kind="decks" currentId={id}/>
        </div>

        <div className="grid gap-3">
          <h3 className="context-section-title">{tr("Create cards")}</h3>
          <Btn primary onClick={() => setImporting(true)}>{tr("Import")}</Btn>
          <Btn onClick={() => setEdit({ type: "card" })}>{tr("Add card")}</Btn>
          <h3 className="context-section-title">{tr("View")}</h3>
          <div className="grid grid-cols-2 gap-2">
            <Btn
              aria-pressed={view === "terms"}
              onClick={() => setView("terms")}
            >{tr("Terms")}</Btn>
            <Btn
              aria-pressed={view === "cards"}
              onClick={() => setView("cards")}
            >{tr("Preview")}</Btn>
          </div>
          <Link className="btn" to={"/" + lang + "/flashcard/deck/" + id}>{tr("Study →")}</Link>
          <details>
            <summary>{tr("More")}</summary>
            <div className="mt-3 grid gap-2">
              <Btn onClick={() => setEdit({ type: "deck", item: data.deck })}>{tr("Deck details")}</Btn>
              <Btn onClick={() => setToolPanel("manage")}>{tr("Export and manage")}</Btn>
            </div>
          </details>
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
                    aria-label={tr("Previous card")}
                    isDisabled={!index}
                    onClick={() => step(-1)}
                  >
                    <Icon name="chevron_left" />
                  </Btn>
                  <span>
                    {index + 1} <span className="muted">/ {order.length}</span>
                  </span>
                  <Btn
                    aria-label={tr("Next card")}
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
                  >{tr("Shuffle cards")}</Btn>
                  <Btn
                    icon="flip"
                    aria-pressed={reverse}
                    onClick={() => {
                      setReverse(!reverse);
                      setFlipped(false);
                    }}
                  >{tr("Swap sides")}</Btn>
                  <Btn
                    icon="sound"
                    onClick={() =>
                      action.run(() => audio.speak(card.german_text))
                    }
                  >{tr("Nghe")}</Btn>
                  <Btn
                    icon={auto ? "pause" : "play"}
                    aria-pressed={auto}
                    onClick={() => setAuto(!auto)}
                  >
                    {auto ? tr("Ⅱ Stop") : tr("▷ Autoplay")}
                  </Btn>
                </div>
              </>
            ) : (
              <Glass>
                <h3>{tr("Add the first word to this deck")}</h3>

                <Btn
                  icon="plus"
                  primary
                  onClick={() => setEdit({ type: "card" })}
                >{tr("Add term")}</Btn>
              </Glass>
            )}
          </div>
        )}
        {toolPanel === "study" && (
          <PracticeModal
            title={tr("Study session")}
            size="md"
            onClose={() => setToolPanel(null)}
          >
            <div className="flash-settings">
              <span className="tile-icon">
                <Icon name="spark" size={26} />
              </span>
              <Select label={tr("Study mode")} value={mode} onChange={setMode}>
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
                  label={tr("Number of questions")}
                  type="number"
                  min="1"
                  max="100"
                  value={count}
                  onChange={setCount}
                />
              )}
              <Select label={tr("Card scope")} value={filter} onChange={setFilter}>
                {[
                  ["all", "All cards"],
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
              >{tr("Start learning ")}<Icon name="arrow" />
              </Btn>
              <Status error={action.error} />
            </div>
          </PracticeModal>
        )}
      </div>
      {view === "terms" && (
        <>
          <div className="section-heading">
            <h2>{tr("Term ")}<span className="count">{data.cards.length}</span>
            </h2>
            <Btn icon="plus" primary onClick={() => setEdit({ type: "card" })}>{tr("Add term")}</Btn>
          </div>
          <SidebarTools>
            <Field label={tr("Search this deck")} value={query} onChange={setQuery} />
          </SidebarTools>
          <div className="toolbar" role="group" aria-label={tr("Select cards")}>
            <label>
              <input
                type="checkbox"
                aria-label={tr("Select all visible cards")}
                checked={
                  visibleCards.length > 0 &&
                  visibleCards.every((c) => selected.includes(c.id))
                }
                onChange={(e) =>
                  setSelected((ids) =>
                    e.target.checked
                      ? [...new Set([...ids, ...visibleCards.map((c) => c.id)])]
                      : ids.filter(
                          (id) => !visibleCards.some((c) => c.id === id),
                        ),
                  )
                }
              />{" "}{tr("Select all")}</label>
            <span>{selected.length}{tr(" selected")}</span>
            {selected.length > 0 && (
              <>
                <Btn onClick={() => setSelected([])}>{tr("Clear")}</Btn>
                <a
                  className="btn"
                  download="flashcards.json"
                  href={
                    "data:application/json;charset=utf-8," +
                    encodeURIComponent(
                      JSON.stringify(
                        data.cards
                          .filter((c) => selected.includes(c.id))
                          .map((c) =>
                            Object.fromEntries(
                              [
                                "german_text",
                                "vietnamese_meaning",
                                "example_german",
                                "example_vietnamese",
                                "part_of_speech",
                              ].map((k) => [k, c[k] || ""]),
                            ),
                          ),
                        null,
                        2,
                      ),
                    )
                  }
                >{tr("Export")}</a>
                <Btn
                  icon="trash"
                  onClick={() =>
                    setRemove({ type: "selected", ids: [...selected] })
                  }
                >{tr("Delete selected")}</Btn>
              </>
            )}
          </div>
          <div className="term-list">
            {visibleCards.map((c) => (
              <Glass className="term-row" key={c.id}>
                <div>
                  <label className="card-select">
                    <input
                      type="checkbox"
                      aria-label={tr("Select {v0}", { v0: c.german_text })}
                      checked={selected.includes(c.id)}
                      onChange={(e) =>
                        setSelected((ids) =>
                          e.target.checked
                            ? [...ids, c.id]
                            : ids.filter((id) => id !== c.id),
                        )
                      }
                    />
                    <strong>{c.german_text}</strong>
                  </label>
                  <p>{c.example_german}</p>
                </div>
                <div>
                  {c.vietnamese_meaning}
                  <small>{c.example_vietnamese}</small>
                </div>
                <div className="toolbar">
                  <Btn
                    aria-label={tr("Move {v0}", { v0: c.german_text })}
                    onClick={() => setEdit({ type: "position", item: c })}
                  >
                    ↕
                  </Btn>
                  <Btn
                    icon="edit"
                    onClick={() => setEdit({ type: "card", item: c })}
                  >{tr("Edit")}</Btn>
                  <Btn
                    icon="trash"
                    onClick={() => setRemove({ type: "card", item: c })}
                  >{tr("Delete")}</Btn>
                </div>
              </Glass>
            ))}
          </div>
        </>
      )}
      {toolPanel === "manage" && (
        <PracticeModal
          title={tr("Manage decks")}
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
              <Icon name="trash" />{tr(" Delete deck")}</Btn>
          </div>
        </PracticeModal>
      )}
      {edit && (
        <Editor
          title={
            edit.type === "deck"
              ? tr("Edit deck")
              : edit.type === "position"
                ? tr("Term position")
                : edit.item
                  ? tr("Edit term")
                  : tr("Add term")
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
          title={
            remove.type === "selected"
              ? `Delete ${remove.ids.length} cards?`
              : remove.type === "deck"
                ? tr("Delete deck?")
                : tr("Delete this term?")
          }
          description={tr("Content and related progress will be deleted. This cannot be undone.")}
          onClose={() => setRemove(null)}
          onConfirm={async (s) => {
            if (remove.type === "selected") {
              try {
                for (const cardId of remove.ids) {
                  await api(
                    `decks/${id}/cards/${cardId}/`,
                    "DELETE",
                    undefined,
                    s,
                  );
                  setSelected((ids) => ids.filter((value) => value !== cardId));
                  setRemove(
                    (current) =>
                      current && {
                        ...current,
                        ids: current.ids.filter((value) => value !== cardId),
                      },
                  );
                }
              } finally {
                reload();
              }
              return;
            }
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
          lang={lang}
          {...{ api, id, reload }}
          onClose={() => setImporting(false)}
        />
      )}
    </Page>
  );
}
export function ImportCards({ api, id, reload, onClose, lang }) {
  useLocale();
  const [preview, setPreview] = useState(null);
  return (
    <Editor
      title={preview ? `Confirm import ${preview.count} cards` : tr("Import terms")}
      fields={[]}
      initial={{ separator: "|" }}
      submitLabel={preview ? tr("Import cards") : tr("Preview cards")}
      onClose={onClose}
      onSave={async (v, s) => {
        if (preview) {
          await api(`decks/${id}/import/`, "POST", { token: preview.token }, s);
          await reload();
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
              <div key={i} className="mb-3">
                <strong>
                  {r.german_text} — {r.vietnamese_meaning}
                </strong>
                {r.example_german && <p>{r.example_german}</p>}
                {r.example_vietnamese && <p>{r.example_vietnamese}</p>}
              </div>
            ))}
            <Btn onClick={() => setPreview(null)}>{tr("Edit imported content")}</Btn>
          </div>
        ) : (
          <div className="grid gap-4">
            <FlashcardAiHelp lang={lang} separator={v.separator} />
            <Field
              label={tr("Paste cards from AI, Quizlet or your spreadsheet")}
              multiline
              rows={8}
              isRequired
              value={v.text || ""}
              onChange={(text) => set({ ...v, text })}
              description={tr("Paste the JSON from AI, or rows from Quizlet / a spreadsheet.")}
            />
            <Select
              label={tr("Separator (spreadsheet rows only)")}
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
            <p className="text-sm">{tr("Preview first. Nothing is added until you confirm the import.")}</p>
          </div>
        )
      }
    </Editor>
  );
}
