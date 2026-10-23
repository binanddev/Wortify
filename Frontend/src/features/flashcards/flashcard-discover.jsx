import {discoveryHistoryKey, discoveryHistory, rememberDiscovery, discoveryHistoryParams} from './discovery-history.js';
import CardImage from "./card-image.jsx";
import PublicDeckStudy from "./public-deck-study.jsx";
import { useState } from "react";
import { t as tr, useLocale } from "../../i18n/index.js";
import {
  endpoint,
  request,
  useResource,
  useAction,
  useNavigate,
  readPreference,
  savePreference,
} from "../../lib/core.js";
import {
  Page,
  Heading,
  SidebarTools,
  Field,
  Select,
  Btn,
  Glass,
  Icon,
  Loading,
  Status,
} from "../../components/ui/ui.jsx";
import { PracticeModal } from "../practice/practice-workspace.jsx";

function Preview({ lang, deck, onClose, onSave, pending, error }) {
  const resource = useResource(
    endpoint(lang, `flashcard/discover/${deck.id}/`),
  );
  return (
    <PracticeModal title={deck.title} onClose={onClose} pending={pending}>
      <Status error={error} />
      <Loading resource={resource}>
        {(data) => (
          <>
            {data.description && <p>{data.description}</p>}
            <dl className="divide-y divide-(--line)">
              {data.cards.map((card, index) => (
                <div key={index} className="grid gap-2 py-4 sm:grid-cols-2">
                  <div>
                    <dt className="font-semibold">{card.german_text}</dt>
                    {card.example_german && (
                      <p className="text-sm text-(--muted) mt-1">
                        {card.example_german}
                      </p>
                    )}
                  </div>
                  <div>
                    <dd>{card.vietnamese_meaning}<CardImage card={card}/></dd>
                    {card.example_vietnamese && (
                      <p className="text-sm text-(--muted) mt-1">
                        {card.example_vietnamese}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </dl>
            <Btn primary isDisabled={pending} onClick={() => onSave(deck)}>
              {tr(deck.saved_id ? "Continue learning" : "Add to My Flashcards")}
            </Btn>
          </>
        )}
      </Loading>
    </PracticeModal>
  );
}

export default function FlashcardDiscover(props) {
  return <DiscoverContent key={`${props.userId ?? 'guest'}:${props.lang}`} {...props}/>;
}
function DiscoverContent({lang, userId = null, onRequireAccount, initialDeckId}) {
  useLocale();
  const navigate = useNavigate(),
    action = useAction();
  const [search, setSearch] = useState(""),
    [filters, setFilters] = useState({ q: "", level: "", topic: "", page: 1, folder: "" });
  const historyKey = discoveryHistoryKey(userId,lang);
  const [history,setHistory] = useState(()=>discoveryHistory(readPreference(historyKey,{})));
  const remember = (values) => setHistory(previous=>{
    const next=rememberDiscovery(previous,values);
    savePreference(historyKey,next);
    return next;
  });
  const searchFor = value => {
    const q=value.trim();
    remember({query:q});
    setSearch(q);
    setFilters(previous=>({...previous,q,page:1,folder:''}));
  };
  const enterFolder = folder => {
    remember({folder:folder.root_id || folder.id});
    setFilters(previous=>({...previous,folder:String(folder.id),page:1}));
  };
  const rememberDeck = deck => { if(deck.root_id) remember({folder:deck.root_id}); };
  const [draft, setDraft] = useState(null),
    [opened, setOpened] = useState(null);
  const resource = useResource(
    endpoint(lang, `flashcard/discover/?${new URLSearchParams({...filters,browse:'1',...discoveryHistoryParams(history)})}`),
    true,
  );
  const [studying, setStudying] = useState(
    initialDeckId ? { id: initialDeckId, title: tr("Flashcard") } : null,
  );
  const filtered = !!(filters.level || filters.topic);
  function save(deck) {
    rememberDeck(deck);
    if (onRequireAccount) {
      onRequireAccount({ kind: "flashcard", id: deck.id });
      return;
    }
    action.run(async (signal) => {
      const result = deck.saved_id
        ? { id: deck.saved_id }
        : await request(
            endpoint(lang, `flashcard/discover/${deck.id}/copy/`),
            "POST",
            {},
            signal,
          );
      navigate(`/${lang}/flashcard/deck/${result.id}`);
    });
  }
  return (
    <Page>
      <Heading title={tr("Explore")} />
      <SidebarTools>
        <div className="flash-nav">
          <div className="flash-icon-row">
            <Btn
              icon="filter"
              aria-pressed={filtered}
              onClick={() => setDraft({ ...filters })}
            >
              {tr("Filters")}
            </Btn>
            <Btn icon="refresh" onClick={resource.reload}>
              {tr("Refresh")}
            </Btn>
          </div>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              searchFor(search);
            }}
          >
            <Field
              label={tr("Search decks")}
              value={search}
              onChange={setSearch}
            />
            <Btn icon="search" type="submit">
              {tr("Search")}
            </Btn>
          </form>
          {history.queries.length>0 && <div className="grid gap-2" aria-label={tr('Recent searches')}>
            <div className="flex items-center justify-between gap-2"><span>{tr('Recent searches')}</span><Btn icon="close" aria-label={tr('Clear search history')} onClick={()=>{const next=discoveryHistory({});savePreference(historyKey,next);setHistory(next);}}>{tr('Clear search history')}</Btn></div>
            {history.queries.slice(0,5).map(row=><button key={row.query} type="button" className="text-left text-sm wrap-anywhere" onClick={()=>searchFor(row.query)}>{row.query}</button>)}
          </div>}
          {filtered && (
            <div className="flex flex-wrap gap-2 text-sm">
              {filters.level && <span className="pill">{filters.level}</span>}
              {filters.topic && <span className="pill">{filters.topic}</span>}
            </div>
          )}
        </div>
      </SidebarTools>
      <Status error={action.error} />
      <Loading
        resource={{
          ...resource,
          error: resource.error?.includes("There is no API")
            ? tr("This feature is unavailable on the current backend version.")
            : resource.error,
        }}
      >
        {(data) => (
          <>
            <nav className="flex flex-wrap items-center gap-2 mb-4" aria-label={tr('Folder path')}>
              <Btn isDisabled={!filters.folder} onClick={()=>setFilters(previous=>({...previous,folder:'',page:1}))}>{tr('All folders')}</Btn>
              {(data.ancestors || []).map(folder=><Btn className="btn max-w-full h-auto whitespace-normal wrap-anywhere text-left" key={folder.id} isDisabled={String(folder.id)===String(filters.folder)} onClick={()=>setFilters(previous=>({...previous,folder:String(folder.id),page:1}))}>{folder.title}</Btn>)}
            </nav>
            {data.approximate && <p className="mb-4 text-sm text-(--muted)" role="status">{tr('Closest matches to your search')}</p>}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.results.map((deck) => (
                deck.kind === 'folder' ? <Glass key={`folder:${deck.id}`} className="h-full">
                  <div className="flex items-center justify-between gap-3"><Icon name="folder"/><span className="text-sm text-(--muted)">{tr(deck.deck_count===1 ? '{count} deck' : '{count} decks',{count:deck.deck_count})}</span></div>
                  <button type="button" className="text-left font-semibold text-lg wrap-anywhere" onClick={()=>enterFolder(deck)}>{deck.title}</button>
                  <p className="text-sm text-(--muted) wrap-anywhere">{deck.author}</p>
                  <div className="flex flex-wrap gap-2">{deck.levels.map(level=><span className="pill" key={level}>{level}</span>)}</div>
                  <Btn className="btn mt-auto" onClick={()=>enterFolder(deck)}>{tr('Open folder')}</Btn>
                </Glass> : <Glass key={`deck:${deck.id}`} className="h-full">
                  <div className="flex items-center justify-between gap-3">
                    <span className="pill">{deck.level}</span>
                    <span className="text-sm text-(--muted)">
                      {deck.count} {tr("terms")}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="text-left font-semibold text-lg wrap-anywhere"
                    onClick={() => {rememberDeck(deck);setOpened(deck);}}
                  >
                    {deck.title}
                  </button>
                  {deck.folder_path?.length>0 && <p className="text-sm text-(--muted)">{deck.folder_path.map(folder=>folder.title).join(' / ')}</p>}
                  <p className="text-sm text-(--muted)">
                    {deck.author}
                    {deck.topic && ` · ${deck.topic}`}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-auto pt-3">
                    {onRequireAccount && (
                      <Btn onClick={() => {rememberDeck(deck);setStudying(deck);}}>
                        {tr("Study now")}
                      </Btn>
                    )}
                    <Btn icon="eye" onClick={() => {rememberDeck(deck);setOpened(deck);}}>
                      {tr("Preview")}
                    </Btn>
                    <Btn
                      primary
                      isDisabled={action.pending}
                      onClick={() => save(deck)}
                    >
                      {tr(
                        deck.saved_id
                          ? "Continue learning"
                          : "Add to My Flashcards",
                      )}
                    </Btn>
                  </div>
                </Glass>
              ))}
            </div>
            {!data.results.length && (
              <p className="py-8 text-(--muted)">{tr("Content not found.")}</p>
            )}
            {data.pages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-6">
                <Btn
                  isDisabled={data.page <= 1}
                  onClick={() =>
                    setFilters((f) => ({ ...f, page: data.page - 1 }))
                  }
                >
                  {tr("Previous")}
                </Btn>
                <span>
                  {data.page} / {data.pages}
                </span>
                <Btn
                  isDisabled={data.page >= data.pages}
                  onClick={() =>
                    setFilters((f) => ({ ...f, page: data.page + 1 }))
                  }
                >
                  {tr("Next")}
                </Btn>
              </div>
            )}
          </>
        )}
      </Loading>
      {draft && (
        <PracticeModal
          title={tr("Filters")}
          onClose={() => setDraft(null)}
          size="lg"
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setFilters({ ...draft, page: 1, topic: draft.topic.trim() });
              setDraft(null);
            }}
          >
            <Select
              label={tr("Level")}
              value={draft.level}
              onChange={(level) => setDraft((d) => ({ ...d, level }))}
            >
              <option value="">{tr("All levels")}</option>
              {["A1", "A2", "B1", "B2", "C1", "C2"].map((level) => (
                <option key={level}>{level}</option>
              ))}
            </Select>
            <Field
              label={tr("Topic")}
              value={draft.topic}
              onChange={(topic) => setDraft((d) => ({ ...d, topic }))}
            />
            <div className="flex justify-end gap-2">
              <Btn
                onClick={() =>
                  setDraft((d) => ({ ...d, level: "", topic: "" }))
                }
              >
                {tr("Clear filters")}
              </Btn>
              <Btn primary type="submit">
                {tr("Apply")}
              </Btn>
            </div>
          </form>
        </PracticeModal>
      )}
      {opened && (
        <Preview
          lang={lang}
          deck={opened}
          onClose={() => setOpened(null)}
          onSave={save}
          pending={action.pending}
          error={action.error}
        />
      )}
      {studying && (
        <PublicDeckStudy
          lang={lang}
          deck={studying}
          onClose={() => setStudying(null)}
          onRequireAccount={() =>
            onRequireAccount({ kind: "flashcard", id: studying.id })
          }
        />
      )}
    </Page>
  );
}
