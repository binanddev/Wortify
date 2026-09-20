import { useEffect, useState, lazy, Suspense } from "react";
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
import { Community, Settings, Result } from "./learning";
import { Books } from "./books";
export default function App() {
  const route = useRoute(),
    [user, setUser] = useState(undefined),
    [error, setError] = useState("");
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
        <p>Đang chuẩn bị không gian học…</p>
      </div>
    );
  if (!user) return <Login onLogin={setUser} />;
  if (parts[0] === "manage")
    return user.staff || user.superuser ? (
      <Suspense fallback={<div className="loading">Đang mở quản trị…</div>}>
        <Admin user={user} />
      </Suspense>
    ) : (
      <div className="welcome">
        <h1>Bạn không có quyền quản trị.</h1>
        <Link to="/">Về trang học</Link>
      </div>
    );
  if (!lang) return <Welcome {...{ user, setUser }} />;
  return (
    <Workspace
      key={`${user.id}:${lang}`}
      {...{ user, setUser, lang, parts, route }}
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
      <div className="auth-story">
        <Brand />
        <div>
          <span className="eyebrow">A LITTLE EVERY DAY</span>
          <h1>
            Không gian nhỏ.
            <br />
            Khả năng lớn.
          </h1>
          <p>
            Học một từ mới. Hiểu thêm một điều.
            <br />
            Tạo nên hành trình của riêng bạn.
          </p>
          <div className="decor-card">
            <span>learn / lɜːrn /</span>
            <strong>
              Khám phá.
              <br />
              Và ghi nhớ.
            </strong>
            <small>Mỗi ngày, một chút tiến bộ.</small>
          </div>
        </div>
        <small>LERNRAUM · YOUR SPACE TO GROW</small>
      </div>
      <Glass className="auth-card">
        <span className="eyebrow">CHÀO MỪNG ĐẾN LERNRAUM</span>
        <h2>{register ? "Bắt đầu hành trình." : "Rất vui được gặp lại."}</h2>
        <p>
          {register
            ? "Tạo tài khoản để lưu tiến độ học của bạn."
            : "Đăng nhập để tiếp tục những điều đang khám phá."}
        </p>
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
      lernraum<span className="brand-dot">.</span>
    </Link>
  );
}
function Welcome({ user, setUser }) {
  const action = useAction();
  return (
    <div className="welcome-page">
      <header>
        <Brand />
        {(user.staff || user.superuser) && (
          <Link to="/manage">Quản trị nội dung ↗</Link>
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
        <Heading
          eyebrow={`XIN CHÀO, ${user.username}`}
          title={"Hôm nay, bạn muốn\nkhám phá điều gì?"}
          description="Chọn một ngôn ngữ. Bước vào không gian học của riêng bạn."
        />
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
              <p>{sub}</p>
              <div>
                <h2>{name}</h2>
                <span className="round-arrow">
                  <Icon name="arrow" />
                </span>
              </div>
            </Link>
          ))}
        </div>
        <p className="workspace-note">
          Flashcard & Bookdigital · Học liệu và tiến độ riêng cho mỗi ngôn ngữ
        </p>
        <Status error={action.error} />
      </Page>
    </div>
  );
}
function Workspace({ user, setUser, lang, parts, route }) {
  const prefKey = `lernraum:${user.id}:${lang}:appearance`,
    [prefs, setLocalPrefs] = useState(() => {
      const p = readPreference(prefKey, {});
      return {
        font: Math.min(60, Math.max(24, Number(p?.font) || 36)),
        sound: p?.sound === true,
        background: ["mist", "paper", "night"].includes(p?.background)
          ? p.background
          : "mist",
      };
    }),
    [menu, setMenu] = useState(false);
  const setPrefs = (v) => {
    setLocalPrefs(v);
    savePreference(prefKey, v);
  };
  const action = useAction();
  useEffect(() => {
    document.documentElement.dataset.background = prefs.background;
    document.documentElement.style.setProperty(
      "--card-font",
      `${prefs.font}px`,
    );
    return () => {
      delete document.documentElement.dataset.background;
      document.documentElement.style.removeProperty("--card-font");
    };
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
  let content;
  if (section === "flashcard") {
    content =
      parts[2] === "deck" ? (
        <Deck key={parts[3]} lang={lang} id={parts[3]} sound={prefs.sound} />
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
  } else if (section === "books")
    content = <Books key={route} lang={lang} parts={parts} userId={user.id} />;
  else if (section === "profile")
    content = <Community key={route} {...{ lang, section, id: parts[2] }} />;
  else if (section === "settings")
    content = <Settings {...{ lang, prefs, setPrefs }} />;
  else if (section === "results")
    content = <Result lang={lang} id={parts[2]} />;
  else
    content = (
      <Page>
        <Heading title="Không tìm thấy trang" />
        <Link to={`/${lang}/flashcard`}>Về thư viện</Link>
      </Page>
    );
  return (
    <div className="app-shell">
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
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Brand />
        <Link className="workspace-select" to="/">
          <span className="language-monogram">{lang.toUpperCase()}</span>
          <span>
            {lang === "en" ? "English" : "Deutsch"}
            <small>Không gian học tập</small>
          </span>
          <span>⌄</span>
        </Link>
        <div className="nav-label">HỌC & KHÁM PHÁ</div>
        <nav>
          {[
            ["flashcard", "cards", "Flashcard"],
            ["books", "book", "Bookdigital"],
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
        <div className="nav-label">GÓC CỦA BẠN</div>
        <nav>
          {[["profile", "user", "Hành trình học"]].map(([id, icon, title]) => (
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
          <div className="quiet-note">
            <Icon name="spark" />
            <p>
              Không cần hoàn hảo.
              <br />
              Chỉ cần thêm một chút mỗi ngày.
            </p>
          </div>
          <Link
            className={`nav-link ${section === "settings" ? "active" : ""}`}
            to={`/${lang}/settings`}
          >
            <Icon name="settings" />
            Cài đặt học tập
          </Link>
          <div className="account">
            <Link to={`/${lang}/profile`} className="account-name">
              <span className="avatar">{user.username[0].toUpperCase()}</span>
              <span>
                {user.username}
                <small>Không gian cá nhân</small>
              </span>
            </Link>
            <Btn
              aria-label="Đăng xuất"
              isLoading={action.pending}
              onClick={() =>
                action.run(async (s) => {
                  await request("/api/session/", "DELETE", undefined, s);
                  setUser(null);
                  navigate("/");
                })
              }
            >
              <Icon name="logout" size={18} />
            </Btn>
          </div>
          <Status error={action.error} />
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="toolbar">
            <Btn
              className="mobile-menu btn"
              aria-label="Mở điều hướng"
              onClick={() => setMenu(!menu)}
            >
              ☰
            </Btn>
            <span className="topbar-label">
              {lang === "en" ? "English" : "Deutsch"} <span>/</span>{" "}
              {
                {
                  flashcard: "Flashcard",
                  books: "Bookdigital",
                  profile: "Hành trình",
                  classes: "Lớp học",
                  reviews: "Bài chấm",
                  settings: "Cài đặt",
                  results: "Kết quả",
                }[section]
              }
            </span>
          </div>
          <div className="toolbar">
            <Btn
              aria-label="Giảm cỡ chữ"
              isDisabled={prefs.font <= 24}
              onClick={() =>
                setPrefs({ ...prefs, font: Math.max(24, prefs.font - 2) })
              }
            >
              A−
            </Btn>
            <Btn
              aria-label="Tăng cỡ chữ"
              isDisabled={prefs.font >= 60}
              onClick={() =>
                setPrefs({ ...prefs, font: Math.min(60, prefs.font + 2) })
              }
            >
              A+
            </Btn>
            <Btn
              aria-label={
                prefs.sound
                  ? "Tắt âm thanh tương tác"
                  : "Bật âm thanh tương tác"
              }
              aria-pressed={prefs.sound}
              onClick={() => setPrefs({ ...prefs, sound: !prefs.sound })}
            >
              <Icon name="sound" />
              <span className="sound-label">{prefs.sound ? "Bật" : "Tắt"}</span>
            </Btn>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          {content}
        </main>
        <footer className="app-footer">
          LERNRAUM <span>Một chút mỗi ngày, một bước xa hơn.</span>
        </footer>
      </div>
    </div>
  );
}
