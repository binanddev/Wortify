import { useEffect, useState } from "react";
import { Skeleton } from "@heroui/react";
import { motion, useReducedMotion } from "framer-motion";
import {
  endpoint,
  useNavigate,
  readPreference,
  savePreference,
  useResource,
  useRoute,
  request,
} from "../../lib/core.js";
import {
  Page,
  SidebarTools,
  Link,
  Icon,
  Status,
  Btn,
  Field,
  Heading,
  Select,
} from "../../components/ui/ui.jsx";
import { EXERCISE_TYPES, previewData } from "../practice/exercise-types.js";
import { practiceRoutes } from "../practice/practice-navigation.js";
import {
  searchHistoryKey,
  normalizeHistory,
  rememberSearch,
  cleanSearch,
} from "./explore-history.js";
import { PracticeModal } from "../practice/practice-workspace.jsx";
import { PracticeActivity } from "../practice/practice-activity.jsx";
import { TheoryActivity } from "../practice/practice-theory.jsx";

function ExplorePreview({ lang, node, onClose }) {
  const resource = useResource(
    endpoint(lang, `practice-hub/nodes/${node.id}/`),
  );
  const content = resource.data?.node;
  return (
    <PracticeModal title={node.title} onClose={onClose}>
      <Status error={resource.error} />
      {resource.loading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (
        content && (
          <>
            <div className="flex justify-end">
              <Link
                className="studio-nav-icon"
                title="Start learning"
                aria-label="Start learning"
                to={`${practiceRoutes(lang).learn}/${node.id}`}
              >
                <Icon name="play" />
              </Link>
            </div>
            {content.kind === "exercise" ? (
              <PracticeActivity
                key={`${content.id}:${content.updated_at}`}
                preview
                data={previewData(content.payload)}
              />
            ) : (
              <TheoryActivity payload={content.payload} />
            )}
          </>
        )
      )}
    </PracticeModal>
  );
}

export function Explore({ lang, userId }) {
  const route = useRoute();
  return (
    <ExploreContent
      key={`${userId}:${lang}:${route}`}
      lang={lang}
      userId={userId}
    />
  );
}
function ExploreContent({ lang, userId }) {
  const navigate = useNavigate();
  const routes = practiceRoutes(lang);
  const params = new URLSearchParams(useRoute().split("?")[1]);
  const query = params.get("q") || "";
  const mode = params.get("mode") || "";
  const sort = params.get("sort") === "newest" ? "newest" : "relevance";
  const parent = Number(params.get("folder")) || null;
  const historyKey = searchHistoryKey(userId, lang);
  const [historyState, setHistoryState] = useState(() => ({
    key: historyKey,
    rows: normalizeHistory(readPreference(historyKey, [])),
  }));
  const history =
    historyState.key === historyKey
      ? historyState.rows
      : normalizeHistory(readPreference(historyKey, []));
  const [historyOpen, setHistoryOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const updateHistory = (update) =>
    setHistoryState((previous) => {
      const next = update(
        previous.key === historyKey
          ? previous.rows
          : normalizeHistory(readPreference(historyKey, [])),
      );
      savePreference(historyKey, next);
      return { key: historyKey, rows: next };
    });
  const removeHistory = (query) =>
    updateHistory((rows) => rows.filter((row) => row.query !== query));
  const [draft, setDraft] = useState(query);
  const [filters, setFilters] = useState(false);
  const [preview, setPreview] = useState(null);
  const [notice, setNotice] = useState("");
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState({});
  const [view, setView] = useState(() =>
    readPreference(`wortify:explore-view:${lang}`, "grid") === "list"
      ? "list"
      : "grid",
  );
  const [results, setResults] = useState({
    loading: true,
    rows: [],
    error: "",
  });
  const [retry, setRetry] = useState(0);
  const [page, setPage] = useState(1);
  const [seed] = useState(() => String(Date.now()));
  const current = results.current;
  const viewsKey = `wortify:explore-views:${userId}:${lang}`;
  const [interests] = useState(() => {
    const viewed = readPreference(viewsKey, []);
    return [
      ...history.slice(0, 5).map((row) => row.query),
      ...(Array.isArray(viewed)
        ? viewed.slice(0, 5).map((row) => row.query || "")
        : []),
    ]
      .join(" ")
      .slice(0, 600);
  });
  const rememberView = (node) => {
    const old = readPreference(viewsKey, []);
    savePreference(
      viewsKey,
      [
        { id: node.id, query: `${node.title} ${(node.tags || []).join(" ")}` },
        ...(Array.isArray(old) ? old.filter((row) => row.id !== node.id) : []),
      ].slice(0, 20),
    );
  };
  const showPreview = (node) => {
    rememberView(node);
    setPreview(node);
  };
  const workspaceKey = `wortify:practice-workspace:${userId}:${lang}`;
  const [pinned, setPinned] = useState(() => {
    const value = readPreference(workspaceKey, []);
    return Array.isArray(value) ? value : [];
  });
  const reduced = useReducedMotion();
  useEffect(() => setDraft(query), [query]);

  const resultKey = `${lang}:${query}:${mode}:${sort}:${parent}`;
  useEffect(() => {
    const controller = new AbortController();
    const searchParams = new URLSearchParams({
      browse: "1",
      q: query,
      mode,
      sort,
      folder: parent || "",
      page: String(page),
      seed,
      interests,
    });
    setResults((previous) => ({ ...previous, loading: true, error: "" }));
    request(
      endpoint(lang, `practice-hub/explore/?${searchParams}`),
      "GET",
      undefined,
      controller.signal,
    )
      .then((data) => {
        if (!controller.signal.aborted)
          setResults((previous) => ({
            ...data,
            key: resultKey,
            loading: false,
            error: "",
            rows:
              page === 1 || previous.key !== resultKey
                ? data.results
                : [
                    ...previous.rows,
                    ...data.results.filter(
                      (n) => !previous.rows.some((old) => old.id === n.id),
                    ),
                  ],
          }));
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResults((previous) => ({
            ...previous,
            loading: false,
            error: error.message,
          }));
      });
    return () => controller.abort();
  }, [resultKey, page, seed, interests, retry]);
  const search = (changes) => {
    setPage(1);
    const next = new URLSearchParams(params);
    next.delete("page");
    next.delete("kind");
    for (const [key, value] of Object.entries(changes))
      value ? next.set(key, String(value)) : next.delete(key);
    navigate(`${routes.explore}${next.size ? `?${next}` : ""}`);
  };
  const submitSearch = (value, fromHistory = false) => {
    const text = cleanSearch(value);
    updateHistory((rows) => rememberSearch(rows, text));
    setDraft(text);
    setSuggestionsOpen(false);
    setHistoryOpen(false);
    search({ q: text, ...(fromHistory ? { folder: "", mode: "" } : {}) });
  };
  const recentRows = (rows, full = false) => (
    <ul className="explore-recent-list">
      {rows.map((row) => (
        <li key={row.query}>
          <button
            type="button"
            className="explore-recent-query"
            title={row.query}
            onClick={() => submitSearch(row.query, true)}
          >
            <Icon name="history" size={17} />
            <span>{row.query}</span>
            {full && (
              <small>{new Date(row.at).toLocaleDateString("en-GB")}</small>
            )}
          </button>
          <button
            type="button"
            className="tree-icon"
            title="Delete search"
            aria-label={`Delete search ${row.query}`}
            onClick={() => removeHistory(row.query)}
          >
            <Icon name="close" size={15} />
          </button>
        </li>
      ))}
    </ul>
  );
  const suggestions = history
    .filter((row) =>
      row.query.toLocaleLowerCase().includes(draft.trim().toLocaleLowerCase()),
    )
    .slice(0, 5);
  const openFolder = (id) => {
    const node =
      results.rows.find((n) => n.id === id) ||
      results.ancestors?.find((n) => n.id === id);
    if (node) rememberView(node);
    search({ folder: id, q: "", mode: "" });
  };
  const isPinned = (node) => pinned.includes(node.root_id || node.id);
  const toggle = async (node) => {
    if (!node.can_edit) {
      if (copying) return;
      if (copied[node.id]) {
        navigate(`${routes.studio}/${copied[node.id]}`);
        return;
      }
      setCopying(true);
      try {
        const result = await request(
          endpoint(lang, `practice-hub/nodes/${node.id}/copy/`),
          "POST",
          {},
        );
        setCopied((previous) => ({
          ...previous,
          [node.id]: result.id,
        }));
        setNotice(`Copied “${result.title}” to My Exercise Library.`);
      } catch (error) {
        setNotice(error.message);
      } finally {
        setCopying(false);
      }
      return;
    }
    const rootId = node.root_id || node.id;
    const exists = isPinned(node);
    setPinned((previous) => {
      const next = exists
        ? previous.filter((id) => id !== rootId)
        : [...previous, rootId];
      savePreference(workspaceKey, next);
      return next;
    });
    setNotice(exists ? "Removed from workspace." : "Added to workspace.");
  };
  const actionLabel = (node) =>
    node.can_edit
      ? isPinned(node)
        ? "Remove from workspace"
        : "Add to workspace"
      : copied[node.id]
        ? "Open copy in My Exercise Library"
        : "Copy to My Exercise Library";
  const items = results.key === resultKey ? results.rows : [];
  const loading = results.loading && !items.length;
  const error = results.error;
  const ancestors = results.ancestors || [];
  return (
    <Page>
      <SidebarTools navOnly>
        <div className="explore-nav">
          <nav className="studio-nav-shortcuts" aria-label="Explore tools">
            <Link
              className={`studio-nav-icon ${!parent ? "active" : ""}`}
              to={routes.explore}
              onClick={() => setPage(1)}
              title="Explore"
              aria-label="Explore"
            >
              <Icon name="home" size={23} />
            </Link>
            <Btn
              isIconOnly
              title="Filters"
              aria-label="Filters"
              aria-pressed={Boolean(mode || sort !== "relevance")}
              onClick={() => setFilters(true)}
            >
              <Icon name="settings" />
            </Btn>
            <Btn
              isIconOnly
              title="Search history"
              aria-label="Search history"
              onClick={() => setHistoryOpen(true)}
            >
              <Icon name="history" />
            </Btn>
          </nav>
          {current && (
            <div className="explore-current">
              <Icon name="folder" />
              <span className="truncate" title={current.title}>
                {current.title}
              </span>
            </div>
          )}
          {history.length > 0 && (
            <section className="explore-recent" aria-label="Recent searches">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">Recent</span>
                <button
                  type="button"
                  className="tree-icon"
                  title="Full history"
                  aria-label="Full history"
                  onClick={() => setHistoryOpen(true)}
                >
                  <Icon name="more" />
                </button>
              </div>
              {recentRows(history.slice(0, 4))}
            </section>
          )}
        </div>
      </SidebarTools>
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        {current && (
          <nav
            className="flex min-w-0 items-center gap-2 overflow-hidden text-sm"
            aria-label="Folder position"
          >
            <Link
              to={routes.explore}
              onClick={() => setPage(1)}
              title="Explore"
              aria-label="Explore"
            >
              <Icon name="home" />
            </Link>
            {ancestors.map((node) => (
              <span key={node.id} className="flex min-w-0 items-center gap-2">
                <Icon name="chevron_right" size={14} />
                <button
                  type="button"
                  className="truncate"
                  title={node.title}
                  onClick={() => openFolder(node.id)}
                >
                  {node.title}
                </button>
              </span>
            ))}
          </nav>
        )}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Heading title={current?.title || "Explore"} />
          <div className="flex gap-2">
            {[
              ["grid", "Grid view"],
              ["list", "List view"],
            ].map(([value, label]) => (
              <Btn
                key={value}
                isIconOnly
                title={label}
                aria-label={label}
                aria-pressed={view === value}
                onClick={() => {
                  setView(value);
                  savePreference(`wortify:explore-view:${lang}`, value);
                }}
              >
                <Icon name={value} />
              </Btn>
            ))}
            {current && (
              <Btn
                isIconOnly
                title={actionLabel(current)}
                aria-label={actionLabel(current)}
                aria-pressed={isPinned(current)}
                isDisabled={copying}
                onClick={() => toggle(current)}
              >
                <Icon
                  name={
                    current.can_edit
                      ? isPinned(current)
                        ? "check"
                        : "plus"
                      : "copy"
                  }
                />
              </Btn>
            )}
          </div>
        </header>
        <div
          className="explore-search"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setSuggestionsOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setSuggestionsOpen(false);
          }}
        >
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              submitSearch(draft);
            }}
          >
            <div className="min-w-0 flex-1">
              <Field
                aria-label="Search"
                placeholder={
                  current ? "Search trong folde…" : "Search folders or topics…"
                }
                value={draft}
                onChange={(value) => {
                  setDraft(value);
                  setSuggestionsOpen(true);
                }}
                onFocus={() => setSuggestionsOpen(true)}
                autoComplete="off"
                maxLength={200}
                aria-expanded={suggestionsOpen && suggestions.length > 0}
                aria-controls="explore-search-suggestions"
                startContent={<Icon name="search" />}
              />
            </div>
            <Btn
              type="submit"
              isIconOnly
              title="Search"
              aria-label="Search"
            >
              <Icon name="search" />
            </Btn>
            <Btn
              isIconOnly
              title="Filters"
              aria-label="Filters"
              aria-pressed={Boolean(mode || sort !== "relevance")}
              onClick={() => setFilters(true)}
            >
              <Icon name="settings" />
            </Btn>
          </form>
          {suggestionsOpen && suggestions.length > 0 && (
            <section
              id="explore-search-suggestions"
              className="explore-suggestions"
              aria-label="Recent searches"
            >
              <span className="px-2 text-sm text-(--muted)">
                Recent searches
              </span>
              {recentRows(suggestions)}
            </section>
          )}
        </div>
        {!query && !parent && results.suggestions?.length > 0 && (
          <div className="flex flex-wrap gap-2" aria-label="Search suggestions">
            {results.suggestions.map((tag) => (
              <button
                key={tag}
                className="pill"
                onClick={() => submitSearch(tag, true)}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
        <Status error={error} />
        {notice && (
          <p role="status" className="text-sm text-(--muted)">
            {notice}
          </p>
        )}
        {error && (
          <Btn
            icon="refresh"
            onClick={() => {
              setRetry((value) => value + 1);
            }}
          >
            Retry
          </Btn>
        )}
        {!loading && parent && !current ? (
          <Status>
            This folder is no longer public or accessible.
          </Status>
        ) : (
          <div className={`hub-grid library-view-${view}`} aria-busy={loading}>
            {loading
              ? Array.from({ length: 6 }, (_, index) => (
                  <Skeleton key={index} className="h-48 rounded-2xl" />
                ))
              : items.map((node, index) => {
                  const folder = node.kind === "folder";
                  const info = node;
                  const author = node.author;
                  return (
                    <motion.article
                      key={node.id}
                      data-kind={node.kind}
                      className="hub-tile library-card"
                      initial={reduced ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.18,
                        delay: Math.min(index, 5) * 0.02,
                      }}
                    >
                      <div className="library-card-top">
                        <span className="library-card-icon">
                          <Icon
                            name={
                              folder
                                ? "folder"
                                : node.kind === "exercise"
                                  ? "exercise"
                                  : "book"
                            }
                            size={24}
                          />
                        </span>
                      </div>
                      <button
                        type="button"
                        className="library-card-title text-left"
                        title={node.title}
                        onClick={() =>
                          folder ? openFolder(node.id) : showPreview(node)
                        }
                      >
                        {node.title}
                      </button>
                      <small>
                        {folder
                          ? `${node.child_count || 0} content`
                          : node.kind === "exercise"
                            ? `${info?.question_count || 0} questions`
                            : "Reading content"}
                        {author
                          ? ` · ${author}`
                          : node.can_edit
                            ? " · You"
                            : ""}
                      </small>
                      {node.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {node.tags.slice(0, 4).map((tag) => (
                            <button
                              key={tag}
                              className="pill"
                              onClick={() => submitSearch(tag, true)}
                            >
                              #{tag}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="library-card-actions">
                        <Btn
                          isIconOnly
                          title={folder ? "Open folder" : "Preview"}
                          aria-label={`${folder ? "Open" : "Preview"} ${node.title}`}
                          onClick={() =>
                            folder ? openFolder(node.id) : showPreview(node)
                          }
                        >
                          <Icon name={folder ? "arrow" : "eye"} />
                        </Btn>
                        <Btn
                          isIconOnly
                          title={actionLabel(node)}
                          aria-label={actionLabel(node)}
                          aria-pressed={isPinned(node)}
                          isDisabled={copying}
                          onClick={() => toggle(node)}
                        >
                          <Icon
                            name={
                              node.can_edit
                                ? isPinned(node)
                                  ? "check"
                                  : "plus"
                                : "copy"
                            }
                          />
                        </Btn>
                      </div>
                    </motion.article>
                  );
                })}
          </div>
        )}
        {!loading && !error && !items.length && (!parent || current) && (
          <div className="rounded-2xl border border-dashed border-(--line) p-10 text-center text-(--muted)">
            <Icon name="search" />
            <p className="mt-3">
              {query || mode
                ? "No matching results."
                : "No public content yet."}
            </p>
          </div>
        )}
        {results.has_more && items.length > 0 && (
          <div className="flex justify-center">
            <Btn
              icon="more"
              isLoading={results.loading}
              isDisabled={results.loading}
              onClick={() =>
                error ? setRetry((v) => v + 1) : setPage((v) => v + 1)
              }
            >
              Show more results
            </Btn>
          </div>
        )}
      </section>
      {historyOpen && (
        <PracticeModal
          title="Search history"
          size="lg"
          onClose={() => setHistoryOpen(false)}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-(--muted)">
              Saved in this browser ·{" "}
              {lang === "de" ? "German" : "English"}
            </span>
            <Btn
              isIconOnly
              title="Delete all"
              aria-label="Clear search history"
              isDisabled={!history.length}
              onClick={() => updateHistory(() => [])}
            >
              <Icon name="trash" />
            </Btn>
          </div>
          {history.length ? (
            recentRows(history, true)
          ) : (
            <p className="text-sm text-(--muted)">No recent searches.</p>
          )}
        </PracticeModal>
      )}
      {filters && (
        <PracticeModal
          title="Filters"
          size="sm"
          onClose={() => setFilters(false)}
        >
          <Select
            label="Exercise type"
            value={mode}
            onChange={(value) => search({ mode: value })}
          >
            <option value="">All</option>
            {EXERCISE_TYPES.map(([key, title]) => (
              <option key={key} value={key}>
                {title}
              </option>
            ))}
          </Select>
          <Select
            label="Sort"
            value={sort}
            onChange={(value) => search({ sort: value })}
          >
            <option value="relevance">Most relevant</option>
            <option value="newest">Recently updated</option>
          </Select>
          <div className="flex justify-end gap-2">
            <Btn icon="refresh" onClick={() => search({ mode: "", sort: "" })}>
              Reset filters
            </Btn>
            <Btn icon="check" onClick={() => setFilters(false)}>
              Xong
            </Btn>
          </div>
        </PracticeModal>
      )}
      {preview && (
        <ExplorePreview
          key={preview.id}
          lang={lang}
          node={preview}
          onClose={() => setPreview(null)}
        />
      )}
    </Page>
  );
}
