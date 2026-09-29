import { loadLoginSnapshot, clearLoginAppearance } from "./appearance-cache";
import { applyAppearance } from "./appearance-preferences";
import FlashcardNavigation from "./flashcard-navigation";
import { NavResize, useNavWidth } from "./nav-resize";
import { Explore } from "./explore";
import { ExerciseStudio } from "./exercise-studio";
import { legacyPracticeDestination } from "./practice-navigation";
import { PracticeGuide } from "./practice-guide";
import {
  useLearningSync,
  pendingLearning,
  flushLearning,
} from "./learning-sync";
import FlashcardStudio from "./flashcard-studio";
import Soundscape from "./Soundscape";
import { PracticeHub } from "./practice-hub";
import { useEffect, useState, lazy, Suspense } from "react";
const Admin = lazy(() => import("./admin/Admin.jsx"));
import {
  request,
  useAction,
  useRoute,
  navigate,
  readPreference,
  savePreference,
} from "./core";
import { Btn, Icon, Glass, Page, Heading, Field, Status, Link } from "./ui";
import { Library, Deck } from "./library";
import { Session, ExtraStudy } from "./study";
import { Community, Settings } from "./learning";

export default function App() {
  const route = useRoute(),
    [user, setUser] = useState(undefined),
    [appearance, setAppearance] = useState({ background_url: "" }),
    [error, setError] = useState("");
  useEffect(() => {
    applyAppearance(user?.preferences);
  }, [user]);
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
  const appearanceKey = user ? `${user.id}:${user.appearance_session}` : "";
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
            warning: "Không thể lưu theme trên trình duyệt. Hãy đăng nhập lại.",
          });
      });
    return () => {
      disposed = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [appearanceKey, user === null]);
  useEffect(() => {
    const url =
      appearance.key === appearanceKey
        ? appearance.data?.[activeLanguage]?.background_url
        : "";
    document.documentElement.style.setProperty(
      "--site-bg-image",
      url ? `url("${url}")` : "none",
    );
    return () =>
      document.documentElement.style.removeProperty("--site-bg-image");
  }, [appearance, appearanceKey, activeLanguage]);
  const parts = route.split("?")[0].split("/").filter(Boolean),
    lang = ["en", "de"].includes(parts[0]) ? parts[0] : null;
  if (error)
    return (
      <div className="welcome">
        <Glass>
          <h1>Không thể kết nối</h1>
          <Status error={error} />
          <Btn icon="refresh" onClick={() => location.reload()}>
            Kết nối lại
          </Btn>
        </Glass>
      </div>
    );
  if (user === undefined)
    return (
      <div className="welcome">
        <span className="loader" />
        <p>Đang tải…</p>
      </div>
    );
  if (!user) return <Login onLogin={setUser} />;
  if (appearance.key !== appearanceKey)
    return (
      <div className="welcome">
        <span className="loader" />
        <p>Đang chuẩn bị không gian…</p>
      </div>
    );
  if (parts[0] === "manage")
    return (
      <Workspace
        user={user}
        setUser={setUser}
        lang="en"
        parts={["en", "admin"]}
        route={route}
        appearance={appearance}
      />
    );
  if (!lang) return <Welcome {...{ user, setUser }} />;
  return (
    <Workspace
      key={`${user.id}:${lang}`}
      {...{ user, setUser, lang, parts, route }}
      appearance={appearance}
    />
  );
}
function Login({ onLogin }) {
  const [register, setRegister] = useState(false),
    [values, setValues] = useState({
      username: "",
      password: "",
      password1: "",
      password2: "",
    }),
    action = useAction();
  return (
    <div className="auth-layout">
      <Glass className="auth-card">
        <span className="eyebrow">WORTIFY</span>
        <h2>{register ? "Tạo tài khoản" : "Đăng nhập"}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            action.run(async (s) => {
              const d = await request(
                "/api/session/",
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
            label="Tên tài khoản"
            value={values.username}
            onChange={(v) => setValues({ ...values, username: v })}
            autoComplete="username"
            isRequired
          />
          {(register ? ["password1", "password2"] : ["password"]).map(
            (key, i) => (
              <Field
                key={key}
                label={i ? "Nhập lại mật khẩu" : "Mật khẩu"}
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
            {register ? "Tạo tài khoản" : "Đăng nhập"}
            <Icon name="arrow" />
          </Btn>
        </form>
        <div className="auth-switch">
          {register ? "Đã có tài khoản?" : "Chưa có tài khoản?"}
          <Btn
            onClick={() => {
              setRegister(!register);
              action.setError("");
            }}
          >
            {register ? "Đăng nhập" : "Tạo tài khoản"}
          </Btn>
        </div>
      </Glass>
    </div>
  );
}
function Brand() {
  return (
    <Link to="/" className="brand">
      <span className="brand-mark">
        <Icon name="book" size={23} />
      </span>
      wortify<span className="brand-dot">.</span>
    </Link>
  );
}
function Welcome({ user, setUser }) {
  const action = useAction();
  return (
    <div className="welcome-page">
      <header>
        <Brand />
        {(user.superuser || user.staff) && (
          <Link to="/manage">Quản trị người dùng ↗</Link>
        )}
        <Btn
          onClick={() =>
            action.run(async (s) => {
              await request("/api/session/", "DELETE", undefined, s);
              setUser(null);
            })
          }
        >
          Đăng xuất <Icon name="logout" />
        </Btn>
      </header>
      <Page>
        <Heading eyebrow={`XIN CHÀO, ${user.username}`} title="Chọn ngôn ngữ" />
        <div className="language-grid">
          {[
            [
              "en",
              "English",
              "Tiếng Anh",
              "Hello.",
              "A world of possibilities.",
            ],
            ["de", "Deutsch", "Tiếng Đức", "Hallo.", "Ein neuer Anfang."],
          ].map(([lang, name, label, word, sub]) => (
            <Link
              key={lang}
              to={`/${lang}/flashcard`}
              className="language-card"
            >
              <span className="eyebrow">{label}</span>
              <strong>{word}</strong>
              <div>
                <h2>{name}</h2>
                <span className="round-arrow">
                  <Icon name="arrow" />
                </span>
              </div>
            </Link>
          ))}
        </div>
        <Status error={action.error} />
      </Page>
    </div>
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
      const p = {
        ...user.preferences,
        ...Object.assign({}, ...pending.map((e) => e.payload)),
        ...appearance.data?.[lang]?.preferences,
        ...readPreference(
          `wortify:${user.id}:${user.appearance_session}:${lang}:live-display`,
          {},
        ),
      };
      return {
        curvature: p.curvature ?? 18,
        glassLens: p.glassLens ?? 40,
        navPinned: p.navPinned !== false,
        font: Math.min(60, Math.max(24, Number(p?.font) || 36)),
        sound: p?.sound === true,
        ambient: p?.ambient === true,
        volume: Math.min(1, Math.max(0, Number(p?.volume ?? 0.25))),
        transparency: Math.min(100, Math.max(0, Number(p?.transparency ?? 25))),
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
  const [navWidth, setNavWidth] = useNavWidth(user.id);
  const setPrefs = (v) => {
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
  useEffect(() => {
    applyAppearance(prefs);
  }, [prefs]);
  useEffect(() => {
    document.querySelector("#main-content")?.focus();
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [route]);
  const section = parts[1] || "flashcard";
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
        <Library lang={lang} />
      );
  } else if (legacyDestination)
    content = (
      <Page>
        <Status>Đang mở Create…</Status>
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
        <Suspense fallback={<p>Đang mở quản trị…</p>}>
          <Admin user={user} />
        </Suspense>
      ) : (
        <Status error="Bạn không có quyền quản trị." />
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
        <Heading title="Không tìm thấy trang" />
        <Link to={`/${lang}/flashcard`}>Về thư viện</Link>
      </Page>
    );
  return (
    <div className="app-shell" style={{ "--nav-width": `${navWidth}px` }}>
      <Soundscape
        interactions={prefs.sound}
        ambient={prefs.ambient}
        volume={prefs.volume}
      />
      <a className="skip-link" href="#main-content">
        Đến nội dung chính
      </a>
      <div className="nav-flip">
        <NavResize width={navWidth} setWidth={setNavWidth} />
        <div className={`nav-flip-inner ${navBack ? "is-flipped" : ""}`}>
          <div
            inert={navBack}
            aria-hidden={navBack}
            className={`nav-face nav-front ${navBack ? "" : "is-active"}`}
          >
            <NavStatic navBack={navBack} setNavBack={setNavBack} />
            <aside
              className="sidebar open"
              inert={navBack}
              aria-hidden={navBack}
            >
              <Link className="workspace-select" to="/">
                <span className="language-monogram">{lang.toUpperCase()}</span>
                <span>{lang === "en" ? "English" : "Deutsch"}</span>
                <span>⌄</span>
              </Link>

              <nav>
                {[
                  ["flashcard", "cards", "Flashcard"],
                  ["practice", "book", "Practice Hub"],
                  ["explore", "search", "Explore"],
                  ["create", "edit", "Create"],
                ].map(([id, icon, title]) => (
                  <Link
                    key={id}
                    to={`/${lang}/${id}`}
                    className={`nav-link ${section === id ? "active" : ""}`}
                    aria-current={section === id ? "page" : undefined}
                  >
                    <Icon name={icon} />
                    {title}
                    {section === id && <span className="nav-dot" />}
                  </Link>
                ))}
              </nav>

              <nav>
                {[
                  ["profile", "user", "Hành trình học"],
                  ["classes", "class", "Lớp học & chia sẻ"],
                ].map(([id, icon, title]) => (
                  <Link
                    key={id}
                    to={`/${lang}/${id}`}
                    className={`nav-link ${section === id ? "active" : ""}`}
                    aria-current={section === id ? "page" : undefined}
                  >
                    <Icon name={icon} />
                    {title}
                  </Link>
                ))}
              </nav>
              <div className="sidebar-bottom">
                {(user.superuser || user.staff) && (
                  <Link className="nav-link" to={`/${lang}/admin`}>
                    <Icon name="settings" /> Quản trị
                  </Link>
                )}
                <Link
                  className={`nav-link ${section === "settings" ? "active" : ""}`}
                  to={`/${lang}/settings`}
                >
                  <Icon name="settings" />
                  Cài đặt học tập
                </Link>
                <div className="account">
                  <Link to={`/${lang}/profile`} className="account-name">
                    <span className="avatar">
                      {user.username[0].toUpperCase()}
                    </span>
                    <span>{user.username}</span>
                  </Link>
                  <Btn
                    aria-label="Đăng xuất"
                    isLoading={action.pending}
                    onClick={() =>
                      action.run(async (s) => {
                        await Promise.all([
                          flushLearning(user.id, "en"),
                          flushLearning(user.id, "de"),
                        ]);
                        await request("/api/session/", "DELETE", undefined, s);
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
            </aside>
          </div>
          <div
            inert={!navBack}
            aria-hidden={!navBack}
            className={`nav-face nav-back ${navBack ? "is-active" : ""}`}
          >
            <NavStatic navBack={navBack} setNavBack={setNavBack} />
            <aside
              className="workspace-context context-panel open"
              aria-label="Công cụ và chỉ mục"
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
      <div className="main-shell">
        <main id="main-content" tabIndex={-1}>
          {content}
        </main>
      </div>
    </div>
  );
}
function NavStatic({ navBack, setNavBack }) {
  return (
    <div className="nav-static">
      <Brand />
      <button
        className="nav-rotate"
        aria-label={navBack ? "Điều hướng chính" : "Công cụ trang"}
        title={navBack ? "Điều hướng chính" : "Công cụ trang"}
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
        flashcard: parts[2] === "deck" ? "Bộ thẻ" : "Flashcard",
        practice: "Practice Hub",
        explore: "Explore",
        create: "Create",
        settings: "Cài đặt",
        profile: "Hành trình học",
        classes: "Lớp học",
        admin: "Người dùng",
      }[section] || "Công cụ",
  };
}
