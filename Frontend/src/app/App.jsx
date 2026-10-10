import PracticeArea from "../features/practice/PracticeArea.jsx";
import { practiceArea } from "../features/practice/practice-area.js";
import CrtOverlay from "../themes/rpg/CrtOverlay.jsx";
import { useThemeBackground } from "../themes/shared/useThemeBackground.js";
import QuestConsole from "../themes/rpg/QuestConsole.jsx";
import Home from "../home/home.jsx";
import { interfaceName } from "../themes/registry.js";
import { installAutoContrast } from "../features/appearance/auto-contrast.js";
import { restoreAppearance, updateAppearance } from "../themes/preferences.js";
import {
  loadLoginSnapshot,
  clearLoginAppearance,
} from "../features/appearance/appearance-cache.js";
import { applyAppearance } from "../themes/apply.js";
import FlashcardNavigation from "../features/flashcards/flashcard-navigation.jsx";
import { NavResize } from "../components/navigation/nav-resize.jsx";
import {
  navScale,
  navWidth as widthForScale,
} from "../components/navigation/navigation-settings.js";
import { ambientTrack } from "../features/audio/ambient-recordings.js";
import { Explore } from "../features/explore/explore.jsx";
import { ExerciseStudio } from "../features/practice/exercise-studio.jsx";
import { legacyPracticeDestination } from "../features/practice/practice-navigation.js";
import { PracticeGuide } from "../features/practice/practice-guide.jsx";
import {
  useLearningSync,
  pendingLearning,
  flushLearning,
} from "../features/learning/learning-sync.js";
import FlashcardStudio from "../features/flashcards/flashcard-studio.jsx";
import Soundscape from "../features/audio/Soundscape.jsx";
import { PracticeHub } from "../features/practice/practice-hub.jsx";
import { useEffect, useLayoutEffect, useState, lazy, Suspense } from "react";
const WindowsTaskbar = lazy(
  () => import("../themes/windows-xp/WindowsDesktop.jsx"),
);
const Admin = lazy(() => import("../features/admin/Admin.jsx"));
import {
  request,
  useAction,
  useRoute,
  navigate,
  readPreference,
  savePreference,
} from "../lib/core.js";
import {
  Btn,
  Icon,
  Glass,
  Page,
  Heading,
  Field,
  Status,
  Link,
} from "../components/ui/ui.jsx";
import { Library, Deck } from "../features/flashcards/library.jsx";
import { Session, ExtraStudy } from "../features/flashcards/study.jsx";
import { Community, Settings } from "../features/settings/learning.jsx";

export default function App() {
  const route = useRoute(),
    [user, setUser] = useState(undefined),
    [appearance, setAppearance] = useState({ background_url: "" }),
    [error, setError] = useState("");
  const isWorkspace = /^\/(en|de|manage)(\/|\?|$)/.test(route);
  useLayoutEffect(() => {
    if (!isWorkspace || !user) {
      applyAppearance();
      document.documentElement.dataset.interface = "home";
      document.documentElement.style.setProperty("--site-bg-image", "none");
    }
  }, [isWorkspace, user]);
  useEffect(() => {
    const c = new AbortController();
    request("/api/session/", "GET", undefined, c.signal)
      .then((d) => setUser(d.user))
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    const expire = () => setUser(null);
    window.addEventListener("session-expired", expire);
    return () => {
      c.abort();
      window.removeEventListener("session-expired", expire);
    };
  }, []);
  const [backgroundRevision, setBackgroundRevision] = useState(0);
  useEffect(() => {
    const changed = () => setBackgroundRevision((n) => n + 1);
    window.addEventListener("background-changed", changed);
    return () => window.removeEventListener("background-changed", changed);
  }, []);
  const appearanceKey = user
    ? `${user.id}:${user.appearance_session}:background-library-v2`
    : "";
  const activeLanguage =
    route.startsWith("/en") || route.startsWith("/manage") ? "en" : "de";
  useEffect(() => {
    if (!user) {
      setAppearance({ background_url: "" });
      if (user === null) void clearLoginAppearance();
      return;
    }
    let disposed = false;
    const urls = [];
    loadLoginSnapshot(
      appearanceKey,
      () =>
        request(
          "/api/me/appearance/",
          "GET",
          undefined,
          AbortSignal.timeout(20000),
        ),
      (url) =>
        fetch(url, {
          credentials: "same-origin",
          cache: "no-store",
          signal: AbortSignal.timeout(120000),
        }),
    )
      .then((snapshot) => {
        if (disposed) return;
        const data = {};
        for (const [lang, item] of Object.entries(snapshot.data)) {
          const blob = snapshot.images[item.background_url];
          const background_url = blob ? URL.createObjectURL(blob) : "";
          if (background_url) urls.push(background_url);
          data[lang] = { ...item, background_url };
        }
        setAppearance({ key: appearanceKey, data, warning: snapshot.warning });
      })
      .catch(() => {
        if (!disposed)
          setAppearance({
            key: appearanceKey,
            data: {},
            warning: "Unable to save the theme in this browser. Please sign in again.",
          });
      });
    return () => {
      disposed = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [appearanceKey, user === null, backgroundRevision]);
  const parts = route.split("?")[0].split("/").filter(Boolean),
    lang = ["en", "de"].includes(parts[0]) ? parts[0] : null;
  const setupKey = /^\/setup-7f3c91d8\/([A-Za-z0-9_-]+)\/?$/.exec(
    route.split("?")[0],
  )?.[1];
  if (error)
    return (
      <div className="welcome">
        <Glass>
          <h1>Unable to connect</h1>
          <Status error={error} />
          <Btn icon="refresh" onClick={() => location.reload()}>
            Reconnect
          </Btn>
        </Glass>
      </div>
    );
  if (user === undefined)
    return (
      <div className="welcome">
        <span className="loader" />
        <p>Loading…</p>
      </div>
    );
  if (setupKey)
    return (
      <Login
        key={setupKey}
        setupKey={setupKey}
        onLogin={(created) => {
          setUser(created);
          navigate("/");
        }}
      />
    );
  if (!user)
    return !lang && !setupKey ? (
      <Home>
        <Login key="normal-login" onLogin={setUser} />
      </Home>
    ) : (
      <Login key="normal-login" onLogin={setUser} />
    );
  if (appearance.key !== appearanceKey)
    return (
      <div className="welcome">
        <span className="loader" />
        <p>Preparing your workspace…</p>
      </div>
    );
  if (parts[0] === "manage" || (["en", "de"].includes(parts[0]) && parts[1] === "admin"))
    return user.staff || user.superuser ? <Suspense fallback={<p>Opening administration…</p>}><Admin user={user} /></Suspense> : <Home {...{user,setUser}}><Status error="You do not have administrative access." /></Home>;
  if (!lang) return <Home {...{ user, setUser }} />;
  return (
    <Workspace
      key={`${user.id}:${lang}`}
      {...{ user, setUser, lang, parts, route }}
      appearance={appearance}
    />
  );
}
function Login({ onLogin, setupKey }) {
  const [register, setRegister] = useState(Boolean(setupKey)),
    [values, setValues] = useState({
      username: "",
      password: "",
      password1: "",
      password2: "",
    }),
    action = useAction();
  const [setupState, setSetupState] = useState(setupKey ? "loading" : "ready");
  const [setupError, setSetupError] = useState("");
  const authEndpoint = setupKey
    ? `/api/superuser-registration/${encodeURIComponent(setupKey)}/`
    : "/api/session/";
  useEffect(() => {
    if (!setupKey) return;
    const controller = new AbortController();
    request(authEndpoint, "GET", undefined, controller.signal)
      .then(() => {
        if (!controller.signal.aborted) setSetupState("ready");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setSetupState("error");
        setSetupError(error.message);
      });
    return () => controller.abort();
  }, [setupKey, authEndpoint]);
  return (
    <div className="auth-layout">
      <Glass className="auth-card">
        <span className="eyebrow">WORTIFY</span>
        <h2>
          {setupKey
            ? "Create admin account"
            : register
              ? "Create account"
              : "Sign in"}
        </h2>
        {setupState === "loading" && <p>Checking paths…</p>}
        <Status error={setupError} />
        {setupState === "ready" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              action.run(async (s) => {
                const d = await request(
                  authEndpoint,
                  "POST",
                  register
                    ? {
                        register: true,
                        username: values.username,
                        password1: values.password1,
                        password2: values.password2,
                      }
                    : { username: values.username, password: values.password },
                  s,
                );
                onLogin(d.user);
              });
            }}
          >
            <Field
              label="Username"
              value={values.username}
              onChange={(v) => setValues({ ...values, username: v })}
              autoComplete="username"
              isRequired
            />
            {(register ? ["password1", "password2"] : ["password"]).map(
              (key, i) => (
                <Field
                  key={key}
                  label={i ? "Confirm password" : "Password"}
                  type="password"
                  value={values[key]}
                  onChange={(v) => setValues({ ...values, [key]: v })}
                  autoComplete={register ? "new-password" : "current-password"}
                  isRequired
                />
              ),
            )}
            <Status error={action.error} />
            <Btn
              primary
              type="submit"
              className="btn primary full"
              isLoading={action.pending}
            >
              {register ? "Create account" : "Sign in"}
              <Icon name="arrow" />
            </Btn>
          </form>
        )}
        {!setupKey && (
          <div className="auth-switch">
            {register ? "Already have an account?" : "No account yet?"}
            <Btn
              onClick={() => {
                setRegister(!register);
                action.setError("");
              }}
            >
              {register ? "Sign in" : "Create account"}
            </Btn>
          </div>
        )}
        {setupKey && <Link to="/">Back to main page</Link>}
      </Glass>
    </div>
  );
}
function Brand() {
  return (
    <Link to="/" className="brand">
      <img
        className="brand-logo"
        src="/brand/wortify-logo.png"
        alt=""
        width="44"
        height="36"
      />
      wortify<span className="brand-dot">.</span>
    </Link>
  );
}
function Workspace({ user, setUser, lang, parts, route, appearance }) {
  const sync = useLearningSync(user.id, lang);
  const prefKey = `wortify:${user.id}:appearance`,
    [prefs, setLocalPrefs] = useState(() => {
      const pending = [
        ...pendingLearning(user.id, "en"),
        ...pendingLearning(user.id, "de"),
      ]
        .filter((e) => e.kind === "preferences")
        .sort((a, b) => a.at.localeCompare(b.at));
      const merged = {
        ...user.preferences,
        ...Object.assign({}, ...pending.map((e) => e.payload)),
        ...appearance.data?.[lang]?.preferences,
        ...readPreference(
          `wortify:${user.id}:${user.appearance_session}:${lang}:live-display`,
          {},
        ),
      };
      const p = restoreAppearance(
        merged,
        appearance.data?.[lang]?.theme_id,
        true,
      );
      return {
        appearanceProfiles: p.appearanceProfiles || {},
        appearanceSelections: p.appearanceSelections || {},
        interface: interfaceName(p.interface),
        curvature: p.curvature ?? 18,
        glassLens: p.glassLens ?? 40,
        navPinned: p.navPinned !== false,
        navScale: navScale(
          p.navScale ??
            (readPreference(`nav-width:${user.id}`, 422) / 422) * 100,
        ),
        ambientTrack: ambientTrack(p.ambientTrack).id,
        font: Math.min(60, Math.max(24, Number(p?.font) || 36)),
        sound: p?.sound === true,
        ambient: p?.ambient === true,
        volume: Math.min(1, Math.max(0, Number(p?.volume ?? 0.25))),
        transparency: Math.min(100, Math.max(0, Number(p?.transparency ?? 25))),
        exerciseTextSize: Math.min(36, Math.max(16, Number(p.exerciseTextSize) || 22)),
        exerciseTextWeight: Math.min(700, Math.max(400, Number(p.exerciseTextWeight) || 500)),
        textWeight: Math.min(700, Math.max(400, Number(p.textWeight) || 500)),
        textContrast: Math.min(100, Math.max(0, Number(p.textContrast ?? 80))),
        textColor: /^#[0-9a-f]{6}$/i.test(p.textColor) ? p.textColor : "auto",
        textSize: Math.min(22, Math.max(16, Number(p?.textSize) || 18)),
        background: ["mist", "paper", "night"].includes(p?.background)
          ? p.background
          : "mist",
      };
    }),
    [navBack, setNavBack] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  useThemeBackground(prefs.interface, user.id);
  const navWidth = widthForScale(prefs.navScale);
  const [smallScreen, setSmallScreen] = useState(
    () => window.matchMedia("(max-width: 1024px)").matches,
  );
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1024px)");
    const change = () => {
      setSmallScreen(media.matches);
      setNavOpen(false);
    };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    setNavOpen(false);
  }, [route]);
  useEffect(() => {
    if (!smallScreen || !navOpen) return;
    const escape = (event) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !document.querySelector('[aria-modal="true"]')
      ) {
        setNavOpen(false);
        document.getElementById("mobile-nav-toggle")?.focus();
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [smallScreen, navOpen]);
  const setPrefs = (requested) => {
    const v = updateAppearance(
      prefs,
      requested,
      appearance.data?.[lang]?.theme_id,
    );
    setLocalPrefs(v);
    savePreference(prefKey, v);
    savePreference(
      `wortify:${user.id}:${user.appearance_session}:${lang}:live-display`,
      v,
    );
    setUser((u) => ({ ...u, preferences: v }));
    sync.enqueue(
      "preferences",
      Object.fromEntries(
        Object.entries(v).filter(([k, value]) => prefs[k] !== value),
      ),
    );
  };
  const action = useAction();
  useEffect(() => installAutoContrast(), []);
  useLayoutEffect(() => {
    applyAppearance(prefs);
  }, [prefs]);
  useEffect(() => {
    if (prefs.interface === "xp") return;
    document.querySelector("#main-content")?.focus();
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [route]);
  const section = parts[1] || "flashcard";
  useEffect(() => {
    if (section === "settings") setNavBack(true);
  }, [section]);
  const legacyDestination =
    section === "exercise-studio"
      ? route.replace("/exercise-studio", "/create")
      : legacyPracticeDestination(lang, section, parts[2]);
  useEffect(() => {
    if (legacyDestination) {
      history.replaceState({}, "", legacyDestination);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }, [legacyDestination]);
  const contextItems = getContextItems(lang, section, parts);
  return (
    <div
      className="app-shell"
      style={{
        "--nav-width": `${navWidth}px`,

      }}
    >
      {prefs.interface === "xp" && (
        <Suspense fallback={null}>
          <WindowsTaskbar
            lang={lang}
            title={contextItems.title}
            route={route}
            canManage={user.staff || user.superuser}
            onLogout={() =>
              action.run(async (signal) => {
                await Promise.all([
                  flushLearning(user.id, "en"),
                  flushLearning(user.id, "de"),
                ]);
                await request("/api/session/", "DELETE", undefined, signal);
                setUser(null);
                navigate("/");
              })
            }
            renderNavigation={(windowRoute) =>
              windowRoute.includes("/flashcard") ? (
                <FlashcardNavigation
                  lang={lang}
                  userId={user.id}
                  route={windowRoute}
                />
              ) : null
            }
            renderContent={(windowRoute) => (
              <WorkspaceContent
                {...{ lang, user, prefs, setPrefs, appearance }}
                route={windowRoute}
              />
            )}
          />
        </Suspense>
      )}
      <Soundscape
        interactions={prefs.sound}
        ambient={prefs.ambient}
        track={prefs.ambientTrack}
        volume={prefs.volume}
      />
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      {prefs.interface !== "xp" && (
        <>
          <div className="mobile-nav-bar">
            <button
              id="mobile-nav-toggle"
              aria-controls="app-navigation"
              aria-expanded={navOpen}
              onClick={() => {
                setNavBack(false);
                setNavOpen((open) => !open);
              }}
            >
              <Icon name="menu" /> Menu
            </button>
            <button
              aria-controls="app-navigation"
              aria-expanded={navOpen && navBack}
              onClick={() => {
                setNavBack(true);
                setNavOpen(true);
              }}
            >
              Page tools
            </button>
          </div>
          {smallScreen && navOpen && (
            <button
              className="nav-scrim"
              aria-label="Close menu"
              onClick={() => setNavOpen(false)}
            />
          )}
          <div
            id="app-navigation"
            className={`nav-flip ${navOpen ? "open" : ""}`}
            inert={smallScreen && !navOpen}
            aria-hidden={smallScreen && !navOpen}
            onClick={(event) => {
              if (smallScreen && event.target.closest("a[href]"))
                setNavOpen(false);
            }}
          >
            {(
              <NavResize
                width={navWidth}
                setWidth={(width) =>
                  setPrefs({
                    ...prefs,
                    navScale: navScale((width / 422) * 100),
                  })
                }
              />
            )}
            <div className={`nav-flip-inner ${navBack ? "is-flipped" : ""}`}>
              <div
                inert={navBack}
                aria-hidden={navBack}
                className={`nav-face nav-front ${navBack ? "" : "is-active"}`}
              >
                <NavStatic
                  navBack={navBack}
                  setNavBack={setNavBack}
                  onClose={() => setNavOpen(false)}
                />
                <aside
                  className="sidebar open"
                  inert={navBack}
                  aria-hidden={navBack}
                >
                  {prefs.interface === "rpg" && <button className="nav-link" onClick={() => setTerminalOpen(v => !v)}>{terminalOpen ? "Exit terminal" : "Terminal"}</button>}
                  {prefs.interface === "rpg" && terminalOpen ? <QuestConsole lang={lang} onExit={() => setTerminalOpen(false)} /> : <>
                  <nav>
                    {[
                      ["flashcard", "cards", "Flashcard"],
                      ["practice", "book", "Practice Hub"],
                    ].map(([id, icon, title]) => (
                      <Link
                        key={id}
                        to={`/${lang}/${id === "practice" ? "practice/all" : id}`}
                        className={`nav-link ${(section === id || (id === "practice" && practiceArea(section))) ? "active" : ""}`}
                        aria-current={(section === id || (id === "practice" && practiceArea(section))) ? "page" : undefined}
                      >
                        <Icon name={icon} />
                        {title}
                        
                      </Link>
                    ))}
                  </nav>

                  <nav>
                    {[
                      ["profile", "user", "Learning journey"],
                      ["classes", "class", "Classes & sharing"],
                    ].map(([id, icon, title]) => (
                      <Link
                        key={id}
                        to={`/${lang}/${id === "practice" ? "practice/all" : id}`}
                        className={`nav-link ${(section === id || (id === "practice" && practiceArea(section))) ? "active" : ""}`}
                        aria-current={(section === id || (id === "practice" && practiceArea(section))) ? "page" : undefined}
                      >
                        <Icon name={icon} />
                        {title}
                      </Link>
                    ))}
                  </nav>
                  <div className="sidebar-bottom">

                    <Link
                      className={`nav-link ${section === "settings" ? "active" : ""}`}
                      to={`/${lang}/settings`}
                    >
                      <Icon name="settings" />
                      Study settings
                    </Link>
                    <div className="account">
                      <Link to={`/${lang}/profile`} className="account-name">
                        <span className="avatar">
                          {user.username[0].toUpperCase()}
                        </span>
                        <span>{user.username}</span>
                      </Link>
                      <Btn
                        aria-label="Sign out"
                        isLoading={action.pending}
                        onClick={() =>
                          action.run(async (s) => {
                            await Promise.all([
                              flushLearning(user.id, "en"),
                              flushLearning(user.id, "de"),
                            ]);
                            await request(
                              "/api/session/",
                              "DELETE",
                              undefined,
                              s,
                            );
                            setUser(null);
                            navigate("/");
                          })
                        }
                      >
                        <Icon name="logout" size={18} />
                      </Btn>
                    </div>
                    <Status error={action.error || sync.error} />
                  </div>
                  </>}
                </aside>
              </div>
              <div
                inert={!navBack}
                aria-hidden={!navBack}
                className={`nav-face nav-back ${navBack ? "is-active" : ""}`}
              >
                <NavStatic
                  navBack={navBack}
                  setNavBack={setNavBack}
                  onClose={() => setNavOpen(false)}
                />
                <aside
                  className="workspace-context context-panel open"
                  aria-label="Tools and contents"
                  inert={!navBack}
                  aria-hidden={!navBack}
                >
                  <h2>{contextItems.title}</h2>
                  {section === "flashcard" && (
                    <FlashcardNavigation
                      key={`${user.id}:${lang}`}
                      lang={lang}
                      userId={user.id}
                      route={route}
                    />
                  )}
                  <div id="workspace-tools" />
                </aside>
              </div>
            </div>
          </div>
        </>
      )}
      {prefs.interface !== "xp" && (
        <div className="main-shell">
          {prefs.interface === "rpg" && <CrtOverlay />}
          
          {prefs.interface === "studio" && (
            <header className="studio-masthead">
              <div>
                <span className="studio-kicker">WORTIFY / LEARNING SPACE</span>
                <strong>{contextItems.title}</strong>
              </div>
              <Link
                to={`/${lang}/settings`}
                className="studio-appearance-link"
                aria-label="Change appearance in Settings"
              >
                <Icon name="palette" /> Appearance
              </Link>
            </header>
          )}
          <main id="main-content" tabIndex={-1}>
            <WorkspaceContent
              {...{ route, lang, user, prefs, setPrefs, appearance }}
            />
          </main>
        </div>
      )}
    </div>
  );
}
function NavStatic({ navBack, setNavBack, onClose }) {
  return (
    <div className="nav-static">
      <Brand />
      <button
        className="mobile-nav-close"
        aria-label="Close menu"
        onClick={onClose}
      >
        <Icon name="close" />
      </button>
      <button
        className="nav-rotate"
        aria-label={navBack ? "Main navigation" : "Page tools"}
        title={navBack ? "Main navigation" : "Page tools"}
        aria-pressed={navBack}
        onClick={() => setNavBack((v) => !v)}
      >
        <Icon name="flip" size={23} />
      </button>
    </div>
  );
}
function getContextItems(lang, section, parts) {
  return {
    title:
      {
        flashcard: parts[2] === "deck" ? "Decks" : "Flashcard",
        practice: "Practice Hub",
        explore: "Explore",
        create: "Create",
        settings: "Settings",
        profile: "Learning journey",
        classes: "Classes",
        admin: "Users",
      }[section] || "Tools",
  };
}

function WorkspaceContent({ route, lang, user, prefs, setPrefs, appearance }) {
  const parts = route.split("?")[0].split("/").filter(Boolean);
  const section = parts[0] === "manage" ? "admin" : parts[1] || "flashcard";
  const legacyDestination = legacyPracticeDestination(lang, section, parts[2]);
  let content;
  if (section === "flashcard") {
    content =
      parts[2] === "deck" ? (
        parts[4] === "edit" ? (
          <Deck key={parts[3]} lang={lang} id={parts[3]} sound={prefs.sound} />
        ) : (
          <FlashcardStudio
            key={parts[3]}
            lang={lang}
            id={parts[3]}
            userId={user.id}
            sound={prefs.sound}
          />
        )
      ) : parts[2] === "session" ? (
        <Session
          key={parts[3]}
          lang={lang}
          token={parts[3]}
          sound={prefs.sound}
        />
      ) : parts[2] === "study" ? (
        <ExtraStudy
          userId={user.id}
          key={route}
          lang={lang}
          params={new URLSearchParams(route.split("?")[1])}
          sound={prefs.sound}
        />
      ) : (
        <Library lang={lang} interfaceName={prefs.interface} />
      );
  } else if (legacyDestination)
    content = (
      <Page>
        <Status>Opening Create…</Status>
      </Page>
    );
  else if (section === "create" && parts[2] === "guide")
    content = <PracticeGuide lang={lang} />;
  else if (section === "create")
    content = (
      <ExerciseStudio
        key={lang}
        lang={lang}
        id={parts[2] === "new" ? undefined : parts[2]}
        create={parts[2] === "new"}
        edit={parts[3] === "edit"}
        parentId={new URLSearchParams(route.split("?")[1]).get("parent")}
      />
    );
  else if (section === "explore")
    content = (
      <Explore key={`${lang}:${user.id}`} lang={lang} userId={user.id} />
    );
  else if (section === "practice")
    content = (
      <PracticeHub
        key={lang}
        lang={lang}
        id={parts[2]}
        userId={user.id}
        sound={prefs.sound}
      />
    );
  else if (section === "profile")
    content = <Community key={route} {...{ lang, section, id: parts[2] }} />;
  else if (section === "classes")
    content = <Community key={route} {...{ lang, section, id: parts[2] }} />;
  else if (section === "admin")
    content =
      user.superuser || user.staff ? (
        <Suspense fallback={<p>Opening administration…</p>}>
          <Admin user={user} />
        </Suspense>
      ) : (
        <Status error="You do not have administrative access." />
      );
  else if (section === "settings")
    content = (
      <Settings
        {...{ lang, prefs, setPrefs }}
        userId={user.id}
        superuser={user.superuser}
        staff={user.staff}
        appearance={appearance}
      />
    );
  else
    content = (
      <Page>
        <Heading title="Page not found" />
        <Link to={`/${lang}/flashcard`}>Back to library</Link>
      </Page>
    );

  return practiceArea(section) ? <PracticeArea lang={lang} section={section} focused={!!parts[2] && section !== "explore"}>{content}</PracticeArea> : content;
}
