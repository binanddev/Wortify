import StaffTools from "../features/staff/StaffTools.jsx";
import { configureStaffWorkspace } from "../lib/staff-workspace.js";
import {guestRoute} from "./guest-route.js";
const PublicPracticeLesson = lazy(() => import('./public-practice-lesson.jsx').then(module => ({default:module.PublicPracticeLesson})));
import { PracticeModal } from "../features/practice/practice-workspace.jsx";

import { t as tr, setLanguage, useLocale } from "../i18n/index.js";
import { ReadingWorkspace, Explore, ExerciseStudio, PracticeGuide, FlashcardStudio, PracticeHub, Admin } from "./workspace-pages.js";
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
import { legacyPracticeDestination } from "../features/practice/practice-navigation.js";
import {
  useLearningSync,
  pendingLearning,
  flushLearning,
} from "../features/learning/learning-sync.js";
import Soundscape from "../features/audio/Soundscape.jsx";
import { useEffect, useLayoutEffect, useState, lazy, Suspense } from "react";
const WindowsTaskbar = lazy(
  () => import("../themes/windows-xp/WindowsDesktop.jsx"),
);
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
const FlashcardDiscover = lazy(() => import('../features/flashcards/flashcard-discover.jsx'));
const Library = lazy(() => import('../features/flashcards/library.jsx').then(module => ({default:module.Library})));
const Deck = lazy(() => import('../features/flashcards/library.jsx').then(module => ({default:module.Deck})));
const Session = lazy(() => import('../features/flashcards/study.jsx').then(module => ({default:module.Session})));
const ExtraStudy = lazy(() => import('../features/flashcards/study.jsx').then(module => ({default:module.ExtraStudy})));
const Community = lazy(() => import('../features/settings/learning.jsx').then(module => ({default:module.Community})));
const Settings = lazy(() => import('../features/settings/learning.jsx').then(module => ({default:module.Settings})));

export default function App() {
  useLocale();
  const route = useRoute(),
    [user, setUser] = useState(undefined),
    [appearance, setAppearance] = useState({ background_url: "" }),
    [error, setError] = useState("");
  const [accountPrompt,setAccountPrompt]=useState(false);
  const requireAccount=()=>setAccountPrompt(true);
  useLayoutEffect(() => {
    if (user) setLanguage(user.preferences?.uiLanguage || "en");
  }, [user?.id, user?.preferences?.uiLanguage]);
  useEffect(() => {
    const changed = e => setUser(old => old ? { ...old, preferences: { ...old.preferences, uiLanguage: e.detail } } : old);
    window.addEventListener("interface-language-changed", changed);
    return () => window.removeEventListener("interface-language-changed", changed);
  }, []);
  configureStaffWorkspace(user);
  const isWorkspace = /^\/(en|de|manage)(\/|\?|$)/.test(route);
  useLayoutEffect(() => {
    if (!isWorkspace) {
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
          <h1>{tr("Unable to connect")}</h1>
          <Status error={error} />
          <Btn icon="refresh" onClick={() => location.reload()}>{tr("Reconnect")}</Btn>
        </Glass>
      </div>
    );
  if (user === undefined)
    return (
      <div className="welcome">
        <span className="loader" />
        <p>{tr("Loading…")}</p>
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
  if (!user && /^\/(login|register)(?:\?|$)/.test(route)) return <Login key={route.split('?')[0]} initialRegister={route.startsWith('/register')} onLogin={created=>{setUser(created);setAccountPrompt(false);navigate(`/${activeLanguage}/flashcard/discover`);}}/>;
  if (!user) {
    if (!lang && parts[0] !== 'manage') return <Home />;
    const guestLang=lang || 'de';
    const guest={id:null,username:tr('Guest'),guest:true,preferences:{}};
    return <><Workspace key={`guest:${guestLang}`} user={guest} setUser={setUser} lang={guestLang} parts={parts} route={route} appearance={{data:{}}} onRequireAccount={requireAccount}/>
      {accountPrompt && <PracticeModal title={tr('Sign in to continue')} onClose={()=>setAccountPrompt(false)}>
        <div className="flex gap-3"><Btn primary onClick={()=>{setAccountPrompt(false);navigate('/register');}}>{tr('Create account')}</Btn><Btn onClick={()=>{setAccountPrompt(false);navigate('/login');}}>{tr('Sign in')}</Btn></div>
      </PracticeModal>}
    </>;
  }
  if (appearance.key !== appearanceKey)
    return (
      <div className="welcome">
        <span className="loader" />
        <p>{tr("Preparing your workspace…")}</p>
      </div>
    );
  if (parts[0] === "manage" || (["en", "de"].includes(parts[0]) && parts[1] === "admin"))
    return user.staff || user.superuser ? <Suspense fallback={<p>{tr("Opening administration…")}</p>}><Admin user={user} /></Suspense> : <Home {...{user,setUser}}><Status error="You do not have administrative access." /></Home>;
  if (!lang) return <Home {...{ user, setUser }} />;
  return (
    <Workspace
      key={`${user.id}:${lang}`}
      {...{ user, setUser, lang, parts, route }}
      appearance={appearance}
    />
  );
}
function Login({ onLogin, setupKey, initialRegister = false, compact = false }) {
  useLocale();
  const [register, setRegister] = useState(Boolean(setupKey || initialRegister)),
    [values, setValues] = useState({
      username: "",
      password: "",
      password1: "",
      password2: "",
    }),
    action = useAction();
  const [authenticated,setAuthenticated]=useState(null);
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
    <div className={compact ? "auth-layout min-h-0! p-0!" : "auth-layout"}>
      <Glass className="auth-card">
        <span className="eyebrow">WORTIFY</span>
        <h2>
          {setupKey
            ? tr("Create admin account")
            : register
              ? tr("Create account")
              : tr("Sign in")}
        </h2>
        {setupState === "loading" && <p>{tr("Checking paths…")}</p>}
        <Status error={setupError} />
        {setupState === "ready" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              action.run(async (s) => {
                if(authenticated){await onLogin(authenticated);return;}
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
                setAuthenticated(d.user);
                await onLogin(d.user);
              });
            }}
          >
            <Field
              label={tr("Username")}
              value={values.username}
              onChange={(v) => setValues({ ...values, username: v })}
              autoComplete="username"
              isRequired
            />
            {(register ? ["password1", "password2"] : ["password"]).map(
              (key, i) => (
                <Field
                  key={key}
                  label={i ? tr("Confirm password") : tr("Password")}
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
              {authenticated ? tr("Retry") : register ? tr("Create account") : tr("Sign in")}
              <Icon name="arrow" />
            </Btn>
          </form>
        )}
        {!setupKey && !authenticated && (
          <div className="auth-switch">
            {register ? tr("Already have an account?") : tr("No account yet?")}
            <Btn
              onClick={() => {
                setRegister(!register);
                action.setError("");
              }}
            >
              {register ? tr("Sign in") : tr("Create account")}
            </Btn>
          </div>
        )}
        {setupKey && <Link to="/">{tr("Back to main page")}</Link>}
      </Glass>
    </div>
  );
}
function Brand() {
  useLocale();
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
export function Workspace({ user, setUser, lang, parts, route, appearance, onRequireAccount }) {
  useLocale();
  const sync = useLearningSync(user.id, lang);
  const [contentRevision, setContentRevision] = useState(0);
  useEffect(()=>{const changed=()=>setContentRevision(value=>value+1);window.addEventListener("staff-content-changed",changed);return()=>window.removeEventListener("staff-content-changed",changed);},[]);
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
        interface: user.staff && !user.superuser ? "studio" : interfaceName(p.interface),
        curvature: p.curvature ?? 18,
        glassLens: p.glassLens ?? 40,
        navPinned: p.navPinned !== false,
        navScale: navScale(
          p.navScale ??
            (readPreference(`nav-width:${user.id}`, 295.4) / 422) * 100,
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
        textSize: Math.min(22, Math.max(16, Number(p?.textSize) || 16)),
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
    () => window.matchMedia("(max-width: 1024px), (any-pointer: coarse)").matches,
  );
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1024px), (any-pointer: coarse)");
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
  useEffect(() => {
    setLocalPrefs(old => ({ ...old, uiLanguage: user.preferences?.uiLanguage || "en" }));
  }, [user.preferences?.uiLanguage]);
  const setPrefs = (requested) => {
    const v = updateAppearance(
      prefs,
      user.staff && !user.superuser ? {...requested, interface:"studio"} : requested,
      appearance.data?.[lang]?.theme_id,
    );
    setLocalPrefs(v);
    savePreference(prefKey, v);
    savePreference(
      `wortify:${user.id}:${user.appearance_session}:${lang}:live-display`,
      v,
    );
    if(user.guest) return;
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
  useEffect(()=>{if(user.guest && guestRoute(route).needsAccount) onRequireAccount();},[route,user.guest]);
  const contextItems = getContextItems(lang, section, parts);
  return (
    <div
      className="app-shell"
      onClickCapture={event=>{
        if(!user.guest)return;
        const link=event.target.closest('a[href]');
        if(!link)return;
        const url=new URL(link.href,location.origin);
        if(url.origin===location.origin && guestRoute(url.pathname+url.search).needsAccount){event.preventDefault();event.stopPropagation();onRequireAccount();}
      }}
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
                  guest={user.guest}
                  route={windowRoute}
                />
              ) : null
            }
            renderContent={(windowRoute) => (
              <>
              {(user.staff || user.superuser) && <StaffTools user={user} lang={lang} section={windowRoute.split("?")[0].split("/")[2] || "flashcard"} libraryLevel={!windowRoute.split("?")[0].split("/")[3] || windowRoute.split("?")[0].split("/")[3] === "all"}/>}
              <WorkspaceContent
                {...{ lang, user, prefs, setPrefs, appearance, onRequireAccount }}
                route={windowRoute}
              />
              </>
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
      <a className="skip-link" href="#main-content">{tr("Skip to main content")}</a>
      {prefs.interface !== "xp" && (
        <>
          <div className="mobile-nav-bar">
            <button
              id="mobile-nav-toggle"
              aria-controls="app-navigation"
              aria-expanded={navOpen && !navBack}
              onClick={() => {
                setNavBack(false);
                setNavOpen((open) => navBack || !open);
              }}
            >
              <Icon name="menu" />{tr(" Menu")}</button>
            <button
              aria-controls="app-navigation"
              aria-expanded={navOpen && navBack}
              onClick={() => {
                setNavBack(true);
                setNavOpen((open) => !navBack || !open);
              }}
            >{tr("Page tools")}</button>
          </div>
          {smallScreen && navOpen && (
            <button
              className="nav-scrim"
              aria-label={tr("Close menu")}
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
                  {prefs.interface === "rpg" && <button className="nav-link" onClick={() => setTerminalOpen(v => !v)}>{terminalOpen ? tr("Exit terminal") : tr("Terminal")}</button>}
                  {prefs.interface === "rpg" && terminalOpen ? <QuestConsole lang={lang} onExit={() => setTerminalOpen(false)} /> : <>
                  <nav>
                    {[
                      ["flashcard", "cards", "Flashcard"],
                      ["practice", "exercise", "Practice Hub"],
                      ["reading", "book", "Reading"],
                    ].map(([id, icon, title]) => (
                      <Link
                        key={id}
                        to={`/${lang}/${id === "practice" ? "practice/all" : id}`}
                        className={`nav-link ${(section === id || (id === "practice" && practiceArea(section))) ? "active" : ""}`}
                        aria-current={(section === id || (id === "practice" && practiceArea(section))) ? "page" : undefined}
                      >
                        <Icon name={icon} />
                        {tr(title)}
                        
                      </Link>
                    ))}
                  </nav>

                  <nav>
                    {[
                      ["profile", "journey", "Learning journey"],
                      ["classes", "class", "Classes & sharing"],
                    ].map(([id, icon, title]) => (
                      <Link
                        key={id}
                        to={`/${lang}/${id === "practice" ? "practice/all" : id}`}
                        className={`nav-link ${(section === id || (id === "practice" && practiceArea(section))) ? "active" : ""}`}
                        aria-current={(section === id || (id === "practice" && practiceArea(section))) ? "page" : undefined}
                      >
                        <Icon name={icon} />
                        {tr(title)}
                      </Link>
                    ))}
                  </nav>
                  <div className="sidebar-bottom">

                    <Link
                      className={`nav-link ${section === "settings" ? "active" : ""}`}
                      to={`/${lang}/settings`}
                    >
                      <Icon name="settings" />{tr("Study settings")}</Link>
                    <div className={user.guest ? "account guest-account" : "account"}>
                      {user.guest ? <>
                        <Btn primary fullWidth onClick={()=>navigate("/register")}>{tr("Create account")}</Btn>
                        <Btn fullWidth variant="bordered" onClick={()=>navigate("/login")}>{tr("Sign in")}</Btn>
                      </> : <>
                      <Link to={`/${lang}/profile`} className="account-name">
                        <span className="avatar">
                          {user.username[0].toUpperCase()}
                        </span>
                        <span>{user.username}</span>
                      </Link>
                      <Btn
                        aria-label={tr("Sign out")}
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
                    </>} </div>
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
                  aria-label={tr("Tools and contents")}
                  inert={!navBack}
                  aria-hidden={!navBack}
                >
                  <h2>{contextItems.title}</h2>
                  {section === "flashcard" && (
                    <FlashcardNavigation
                      key={`${user.id}:${lang}`}
                      lang={lang}
                      userId={user.id}
                      guest={user.guest}
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
                <span className="studio-kicker">{tr("WORTIFY / LEARNING SPACE")}</span>
                <strong>{contextItems.title}</strong>
              </div>
              {!(user.staff && !user.superuser) && <Link
                to={`/${lang}/settings`}
                className="studio-appearance-link"
                aria-label={tr("Change appearance in Settings")}
              >
                <Icon name="palette" />{tr(" Appearance")}</Link>}
            </header>
          )}
          <main id="main-content" tabIndex={-1}>
            {(user.staff || user.superuser) && <StaffTools user={user} lang={lang} section={parts[1] || "flashcard"} libraryLevel={!parts[2] || parts[2] === "all"}/>}
            <WorkspaceContent key={contentRevision}
              {...{ route, lang, user, prefs, setPrefs, appearance, onRequireAccount }}
            />
          </main>
        </div>
      )}
    </div>
  );
}
function NavStatic({ navBack, setNavBack, onClose }) {
  useLocale();
  return (
    <div className="nav-static">
      <Brand />
      <button
        className="mobile-nav-close"
        aria-label={tr("Close menu")}
        onClick={onClose}
      >
        <Icon name="close" />
      </button>
      <button
        className="nav-rotate"
        aria-label={navBack ? tr("Main navigation") : tr("Page tools")}
        title={navBack ? tr("Main navigation") : tr("Page tools")}
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
        reading: "Reading",
        explore: "Explore",
        create: "Create",
        settings: "Settings",
        profile: "Learning journey",
        classes: "Classes",
        admin: "Users",
      }[section] || "Tools",
  };
}

function WorkspaceContent({ route, lang, user, prefs, setPrefs, appearance, onRequireAccount }) {
  useLocale();
  const parts = route.split("?")[0].split("/").filter(Boolean);
  const section = parts[0] === "manage" ? "admin" : parts[1] || "flashcard";
  const legacyDestination = legacyPracticeDestination(lang, section, parts[2]);
  let content;
  if(user.guest) {
    const destination=guestRoute(route);
    if(section==='reading') return <Suspense fallback={<Status>{tr("Loading workspace…")}</Status>}><ReadingWorkspace key={route} route={`/${lang}/reading/discover`} lang={lang} initialReadingId={destination.id} onRequireAccount={onRequireAccount}/></Suspense>;
    if(practiceArea(section) && !destination.needsAccount) return <Suspense fallback={<Status>{tr('Loading workspace…')}</Status>}><PracticeArea lang={lang} section={section}><Explore lang={lang} userId={null} onRequireAccount={onRequireAccount}/>{destination.id && <PublicPracticeLesson lang={lang} id={destination.id} onClose={()=>navigate(`/${lang}/explore`)} onOpen={id=>navigate(`/${lang}/practice/${id}`)} onRequireAccount={onRequireAccount}/>}</PracticeArea></Suspense>;
    return <Suspense fallback={<Status>{tr('Loading workspace…')}</Status>}><FlashcardDiscover key={route} lang={lang} initialDeckId={destination.kind==='flashcard'?destination.id:undefined} onRequireAccount={onRequireAccount}/></Suspense>;
  }
  if (section === "flashcard") {
    content =
      parts[2] === "discover" ? <FlashcardDiscover lang={lang} userId={user.id}/> : parts[2] === "deck" ? (
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
  } else if (section === "reading") content = <ReadingWorkspace key={`${lang}:${route}`} lang={lang} route={route} userId={user.id} sound={prefs.sound} />;
  else if (legacyDestination)
    content = (
      <Page>
        <Status>{tr("Opening Create…")}</Status>
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
        <Suspense fallback={<p>{tr("Opening administration…")}</p>}>
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
        <Heading title={tr("Page not found")} />
        <Link to={`/${lang}/flashcard`}>{tr("Back to library")}</Link>
      </Page>
    );

  return <Suspense fallback={<Status>{tr("Loading workspace…")}</Status>}>{practiceArea(section) ? <PracticeArea lang={lang} section={section} focused={!!parts[2] && section !== "explore"}>{content}</PracticeArea> : content}</Suspense>;
}
