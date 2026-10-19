import { guestRoute } from "./guest-route.js";
import { useState, useLayoutEffect, useEffect } from "react";
import {
  Link,
  Btn,
  Page,
  Heading,
  Field,
  Glass,
  Loading,
} from "../components/ui/ui.jsx";
import { useResource, useNavigate, endpoint } from "../lib/core.js";
import { t as tr, useLocale } from "../i18n/index.js";
import { applyAppearance } from "../themes/apply.js";
import FlashcardDiscover from "../features/flashcards/flashcard-discover.jsx";
import ReadingDiscover from "../features/reading/ReadingDiscover.jsx";
import { PracticeModal } from "../features/practice/practice-workspace.jsx";
import { PracticeActivity } from "../features/practice/practice-activity.jsx";
import { TheoryActivity } from "../features/practice/practice-theory.jsx";
import { previewData } from "../features/practice/exercise-types.js";
import Home from "../home/home.jsx";

function PublicPractice({ lang, onRequireAccount, initialId }) {
  const [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [folder, setFolder] = useState(""),
    [opened, setOpened] = useState(initialId || null);
  const resource = useResource(
    endpoint(
      lang,
      `practice-hub/explore/?${new URLSearchParams({ browse: "1", q, page, folder })}`,
    ),
  );
  return (
    <Page>
      <Heading title={tr("Practice Hub")} />
      <form
        className="flex gap-2 items-end mb-5"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(search);
          setPage(1);
        }}
      >
        <Field label={tr("Search")} value={search} onChange={setSearch} />
        <Btn type="submit">{tr("Search")}</Btn>
      </form>
      <Loading resource={resource}>
        {(data) => (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              <Btn
                onClick={() => {
                  setFolder("");
                  setPage(1);
                }}
              >
                {tr("Explore")}
              </Btn>
              {data.ancestors.map((n) => (
                <Btn
                  key={n.id}
                  onClick={() => {
                    setFolder(n.id);
                    setPage(1);
                  }}
                >
                  {n.title}
                </Btn>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.results.map((n) => (
                <Glass key={n.id}>
                  <h2 className="text-lg font-semibold">{n.title}</h2>
                  <p className="text-sm text-(--muted)">{n.author}</p>
                  <Btn
                    primary
                    onClick={() =>
                      n.kind === "folder"
                        ? (setFolder(n.id), setPage(1))
                        : setOpened(n.id)
                    }
                  >
                    {tr(n.kind === "folder" ? "Open" : "Study now")}
                  </Btn>
                  <Btn
                    onClick={() =>
                      onRequireAccount({ kind: "practice", id: n.id })
                    }
                  >
                    {tr("Save to my library")}
                  </Btn>
                </Glass>
              ))}
            </div>
            {!data.results.length && <p>{tr("Content not found.")}</p>}
            <div className="flex gap-3 mt-5">
              <Btn isDisabled={page === 1} onClick={() => setPage(page - 1)}>
                {tr("Previous")}
              </Btn>
              <Btn
                isDisabled={!data.has_more}
                onClick={() => setPage(page + 1)}
              >
                {tr("Next")}
              </Btn>
            </div>
          </>
        )}
      </Loading>
      {opened && (
        <PublicPracticeLesson
          key={opened}
          lang={lang}
          id={opened}
          onClose={() => setOpened(null)}
          onOpen={setOpened}
          onRequireAccount={onRequireAccount}
        />
      )}
    </Page>
  );
}
function PublicPracticeLesson({ lang, id, onClose, onOpen, onRequireAccount }) {
  const resource = useResource(endpoint(lang, `practice-hub/public/${id}/`));
  return (
    <PracticeModal
      title={resource.data?.title || tr("Practice Hub")}
      onClose={onClose}
      size="5xl"
    >
      <Loading resource={resource}>
        {(data) => (
          <>
            <Btn onClick={() => onRequireAccount({ kind: "practice", id })}>
              {tr("Save to my library")}
            </Btn>
            {data.kind === "folder" ? (
              data.children.map((child) => (
                <Btn key={child.id} onClick={() => onOpen(child.id)}>
                  {child.title}
                </Btn>
              ))
            ) : data.kind === "theory" ? (
              <TheoryActivity payload={data.payload} />
            ) : (
              <PracticeActivity
                preview
                lang={lang}
                data={previewData(data.payload)}
              />
            )}
          </>
        )}
      </Loading>
    </PracticeModal>
  );
}
export default function GuestWorkspace({ lang, route, renderLogin }) {
  useLocale();
  const navigate = useNavigate();
  const destination = guestRoute(route),
    activeLang = destination.lang,
    section = destination.kind;
  const publicRoute = !destination.needsAccount;
  const [register, setRegister] = useState(false);
  const [intent, setIntent] = useState(null);
  const [auth, setAuth] = useState(!publicRoute);
  useEffect(() => {
    if (!publicRoute) setAuth(true);
  }, [route, publicRoute]);
  useLayoutEffect(() => {
    applyAppearance();
    document.documentElement.dataset.interface = "studio";
    document.documentElement.style.setProperty("--site-bg-image", "none");
  }, []);
  const requireAccount = (next) => {
    setIntent(next?.kind ? next : null);
    setRegister(false);
    setAuth(true);
  };
  const initialId = destination.id;
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-(--line) p-4">
        <Link to="/" className="font-bold text-2xl">
          wortify.
        </Link>
        <nav className="flex flex-wrap gap-3" aria-label={tr("Explore")}>
          <Link to={`/${activeLang}/flashcard/discover`}>
            {tr("Flashcard")}
          </Link>
          <Link to={`/${activeLang}/explore`}>{tr("Practice Hub")}</Link>
          <Link to={`/${activeLang}/reading/discover`}>{tr("Reading")}</Link>
        </nav>
        <div className="flex gap-3 items-center">
          <Link to={`/${activeLang === "de" ? "en" : "de"}/flashcard/discover`}>
            {activeLang === "de" ? "English" : "Deutsch"}
          </Link>
          <Btn onClick={requireAccount}>{tr("Sign in")}</Btn>
          <Btn
            primary
            onClick={() => {
              setIntent(null);
              setRegister(true);
              setAuth(true);
            }}
          >
            {tr("Create account")}
          </Btn>
        </div>
      </header>
      {section === "home" ? (
        <Home embedded />
      ) : (
        <div
          className={`max-w-7xl mx-auto p-4 sm:p-6 ${section === "flashcard" ? "grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]" : ""}`}
        >
          {section === "flashcard" && (
            <aside id="workspace-tools" className="min-w-0" />
          )}
          {(section === "flashcard" || !publicRoute) && (
            <FlashcardDiscover
              key={`${activeLang}:${initialId || 0}`}
              initialDeckId={initialId}
              lang={activeLang}
              onRequireAccount={requireAccount}
            />
          )}
          {(section === "explore" || section === "practice") && (
            <PublicPractice
              key={`${activeLang}:${initialId || 0}`}
              lang={activeLang}
              initialId={initialId}
              onRequireAccount={requireAccount}
            />
          )}
          {section === "reading" && (
            <ReadingDiscover
              key={`${activeLang}:${initialId || 0}`}
              initialReadingId={initialId}
              lang={activeLang}
              onRequireAccount={requireAccount}
            />
          )}
        </div>
      )}
      {auth && (
        <PracticeModal
          title={tr("Sign in to continue")}
          onClose={() => {
            setAuth(false);
            if (!publicRoute) navigate(`/${activeLang}/flashcard/discover`);
          }}
        >
          {renderLogin(register, intent)}
        </PracticeModal>
      )}
    </>
  );
}
