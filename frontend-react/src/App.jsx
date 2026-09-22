import {
  useLearningSync,
  pendingLearning,
  flushLearning,
} from "./learning-sync";
import FlashcardStudio from "./flashcard-studio";
import Soundscape from "./Soundscape";
import { PracticeHub } from "./practice-hub";
import { useEffect, useRef, useState, lazy, Suspense } from "react";
const Admin = lazy(() => import("../../frontend-admin/src/Admin.jsx"));
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
    const p = user?.preferences || {};
    document.documentElement.dataset.background = p.background || "mist";
    document.documentElement.style.setProperty(
      "--glass-alpha",
      String(1 - Math.min(85, Math.max(0, Number(p.transparency ?? 25))) / 100),
    );
    document.documentElement.style.setProperty(
      "--ui-font",
      `${Math.min(22, Math.max(16, Number(p.textSize) || 18))}px`,
    );
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
  useEffect(() => {
    if (!user) return undefined;
    const c = new AbortController();
    request("/api/site/appearance/", "GET", undefined, c.signal)
      .then(setAppearance)
      .catch((e) => {
        if (e.name !== "AbortError") setAppearance({ background_url: "" });
      });
    return () => c.abort();
  }, [user?.id]);
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--site-bg-image",
      appearance.background_url
        ? `url("${appearance.background_url}")`
        : "none",
    );
    return () =>
      document.documentElement.style.removeProperty("--site-bg-image");
  }, [appearance.background_url]);
  const parts = route.split("?")[0].split("/").filter(Boolean),
    lang = ["en", "de"].includes(parts[0]) ? parts[0] : null;
  if (error)
    return (
      <div className="welcome">
        <Glass>
          <h1>Không thể kết nối</h1>
          <Status error={error} />
          <Btn onClick={() => location.reload()}>Kết nối lại</Btn>
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
        {user.superuser && <Link to="/manage">Quản trị người dùng ↗</Link>}
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
      };
      return {
        navPinned: p.navPinned !== false,
        font: Math.min(60, Math.max(24, Number(p?.font) || 36)),
        sound: p?.sound === true,
        ambient: p?.ambient === true,
        volume: Math.min(1, Math.max(0, Number(p?.volume ?? 0.25))),
        transparency: Math.min(85, Math.max(0, Number(p?.transparency ?? 25))),
        textSize: Math.min(22, Math.max(16, Number(p?.textSize) || 18)),
        background: ["mist", "paper", "night"].includes(p?.background)
          ? p.background
          : "mist",
      };
    }),
    [menu, setMenu] = useState(false),
    [navBack, setNavBack] = useState(false),
    [navHover, setNavHover] = useState(false);
  const touchStart = useRef(null);
  const setPrefs = (v) => {
    setLocalPrefs(v);
    savePreference(prefKey, v);
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
    document.documentElement.dataset.background = prefs.background;
    document.documentElement.style.setProperty(
      "--glass-alpha",
      String(1 - prefs.transparency / 100),
    );
    document.documentElement.style.setProperty(
      "--ui-font",
      `${prefs.textSize}px`,
    );
    document.documentElement.style.setProperty(
      "--card-font",
      `${prefs.font}px`,
    );
  }, [prefs]);
  useEffect(() => {
    setMenu(false);
    document.querySelector("#main-content")?.focus();
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [route]);
  useEffect(() => {
    if (!menu) return;
    const close = (e) => {
      if (e.key === "Escape") setMenu(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menu]);
  const section = parts[1] || "flashcard";
  useEffect(() => {
    if (section === "practice") setNavBack(true);
  }, [section]);
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
          key={route}
          lang={lang}
          params={new URLSearchParams(route.split("?")[1])}
          sound={prefs.sound}
        />
      ) : (
        <Library lang={lang} />
      );
  } else if (section === "practice")
    content = (
      <PracticeHub
        key={lang}
        lang={lang}
        id={parts[2] === "new" ? undefined : parts[2]}
        createKind={parts[2] === "new" ? parts[3] : undefined}
        userId={user.id}
      />
    );
  else if (section === "profile")
    content = <Community key={route} {...{ lang, section, id: parts[2] }} />;
  else if (section === "classes")
    content = <Community key={route} {...{ lang, section, id: parts[2] }} />;
  else if (section === "admin")
    content = user.superuser ? (
      <Suspense fallback={<p>Đang mở quản trị…</p>}>
        <Admin user={user} />
      </Suspense>
    ) : (
      <Status error="Chỉ superuser được quản trị người dùng." />
    );
  else if (section === "settings")
    content = (
      <Settings
        {...{ lang, prefs, setPrefs }}
        userId={user.id}
        superuser={user.superuser}
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
    <div className={`app-shell ${prefs.navPinned ? "" : "nav-collapsed"}`}>
      <Soundscape
        interactions={prefs.sound}
        ambient={prefs.ambient}
        volume={prefs.volume}
      />
      <a className="skip-link" href="#main-content">
        Đến nội dung chính
      </a>
      {menu && (
        <button
          className="sidebar-scrim"
          aria-label="Đóng điều hướng"
          onClick={() => setMenu(false)}
        />
      )}
      <button
        className="nav-edge no-print"
        aria-label="Hiện thanh bên"
        onMouseEnter={() => setNavHover(true)}
        onFocus={() => setNavHover(true)}
        onClick={() => {
          setNavHover(true);
          setMenu(true);
        }}
      >
        ›
      </button>
      <div
        className={`nav-flip ${menu ? "open" : ""} ${navHover ? "peek" : ""}`}
        onMouseLeave={() => setNavHover(false)}
        onTouchStart={(e) => {
          if (!e.target.closest("input,textarea,select"))
            touchStart.current = {
              x: e.touches[0].clientX,
              y: e.touches[0].clientY,
            };
        }}
        onTouchEnd={(e) => {
          const start = touchStart.current;
          touchStart.current = null;
          if (!start) return;
          const dx = e.changedTouches[0].clientX - start.x,
            dy = e.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            e.preventDefault();
            setNavBack((v) => !v);
          }
        }}
      >
        <div className="nav-static">
          <Brand />
          <button
            className="nav-rotate"
            aria-label={navBack ? "Điều hướng chính" : "Công cụ trang"}
            title={navBack ? "Điều hướng chính" : "Công cụ trang"}
            aria-pressed={navBack}
            onClick={() => setNavBack((v) => !v)}
          >
            <svg
              width="23"
              height="23"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path d="M20 7a8 8 0 0 0-14-2L3 8m0-5v5h5M4 17a8 8 0 0 0 14 2l3-3m0 5v-5h-5" />
            </svg>
          </button>
          <button
            className="nav-hide"
            aria-label={
              prefs.navPinned ? "Thu gọn thanh bên" : "Ghim thanh bên"
            }
            title={prefs.navPinned ? "Thu gọn thanh bên" : "Ghim thanh bên"}
            onClick={() => {
              setPrefs({ ...prefs, navPinned: !prefs.navPinned });
              setNavHover(false);
              setMenu(false);
            }}
          >
            {" "}
            {prefs.navPinned ? "‹" : "›"}{" "}
          </button>
        </div>
        <div className={`nav-flip-inner ${navBack ? "is-flipped" : ""}`}>
          <aside
            className={`sidebar ${menu ? "open" : ""}`}
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
              ].map(([id, icon, title]) => (
                <Link
                  key={id}
                  to={`/${lang}/${id}`}
                  onClick={() => {
                    if (id === "practice") setNavBack(true);
                  }}
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
                  onClick={() => {
                    if (id === "practice") setNavBack(true);
                  }}
                  className={`nav-link ${section === id ? "active" : ""}`}
                  aria-current={section === id ? "page" : undefined}
                >
                  <Icon name={icon} />
                  {title}
                </Link>
              ))}
            </nav>
            <div className="sidebar-bottom">
              {user.superuser && (
                <Link className="nav-link" to={`/${lang}/admin`}>
                  Quản trị người dùng
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
          <aside
            className={`workspace-context ${menu ? "open" : ""}`}
            aria-label="Công cụ và chỉ mục"
            inert={!navBack}
            aria-hidden={!navBack}
          >
            <h2>{contextItems.title}</h2>
            <div id="workspace-tools" />
          </aside>
        </div>
      </div>
      <div className="main-shell">
        <button
          className="workspace-menu btn"
          aria-label="Mở điều hướng"
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          ☰
        </button>
        <main id="main-content" tabIndex={-1}>
          {content}
        </main>
      </div>
    </div>
  );
}
function getContextItems(lang, section, parts) {
  return {
    title:
      {
        flashcard: parts[2] === "deck" ? "Bộ thẻ" : "Flashcard",
        practice: "Practice Hub",
        settings: "Cài đặt",
        profile: "Hành trình học",
        classes: "Lớp học",
        admin: "Người dùng",
      }[section] || "Công cụ",
  };
}
