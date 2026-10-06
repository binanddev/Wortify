import { Link, Icon, Btn, Status } from "./ui";
import { request, useAction } from "./core";
export default function Home({ user, setUser, children }) {
  const action = useAction();
  return (
    <div className="landing" id="wortify-home">
      <header className="landing-header">
        <Link to="/" className="landing-brand">
          wortify<span>.</span>
        </Link>
        <nav aria-label="Trang chủ">
          <a href="#languages">Ngôn ngữ</a>
          <a href="#method">Cách học</a>
          {user ? (
            <button
              onClick={() =>
                action.run(async (signal) => {
                  await request("/api/session/", "DELETE", undefined, signal);
                  setUser(null);
                })
              }
            >
              Đăng xuất
            </button>
          ) : (
            <a href="#home-account">Đăng nhập ↗</a>
          )}
        </nav>
      </header>
      <main>
        <section className="landing-hero">
          <div className="landing-copy">
            <span className="landing-eyebrow">A LITTLE EVERY DAY.</span>
            <h1>
              Mở thêm một
              <br />
              ngôn ngữ.
              <br />
              <em>Mở thêm một thế giới.</em>
            </h1>
            <p>
              Từ những tấm thẻ đầu tiên đến câu nói của riêng bạn. Học tiếng Anh
              và tiếng Đức trong một không gian dành cho sự tập trung.
            </p>
            <a
              className="landing-cta"
              href={user ? "#languages" : "#home-account"}
            >
              {user ? "Chọn không gian học" : "Bắt đầu hành trình"}{" "}
              <span>↗</span>
            </a>
            <div className="landing-note">
              FLASHCARDS <span>＋</span> THỰC HÀNH <span>＋</span> TIẾN BỘ
            </div>
          </div>
          <div className="landing-art" aria-hidden="true">
            <div className="landing-orbit" />
            <div className="landing-sticker">
              Little steps.
              <br />
              Big possibilities.
            </div>
            <div className="landing-word">
              <small>DE / DANH TỪ</small>
              <strong>die Neugier</strong>
              <span>sự tò mò</span>
              <div>✦</div>
            </div>
            <div className="landing-word secondary">
              <small>EN / YOUR NEXT WORD</small>
              <strong>Discover.</strong>
              <span>Luôn có điều mới để khám phá.</span>
            </div>
            <div className="landing-dot">W.</div>
          </div>
        </section>
        <section className="landing-languages" id="languages">
          <div>
            <span className="landing-eyebrow">YOUR NEXT CHAPTER</span>
            <h2>
              {user
                ? `Sẵn sàng chưa, ${user.username}?`
                : "Bạn muốn khám phá ngôn ngữ nào?"}
            </h2>
          </div>
          <div className="landing-language-grid">
            {[
              ["en", "01", "English", "Một thế giới kết nối.", "Hello."],
              ["de", "02", "Deutsch", "Một góc nhìn mới.", "Hallo."],
            ].map(([lang, n, name, sub, hello]) => (
              <Link
                key={lang}
                to={user ? `/${lang}/flashcard` : "/#home-account"}
                className={`landing-language language-${lang}`}
              >
                <small>
                  {n} / {name.toUpperCase()}
                </small>
                <strong>{hello}</strong>
                <div>
                  <span>{sub}</span>
                  <span>↗</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
        <section id="method" className="landing-method">
          {[
            [
              "01",
              "Gặp một từ mới",
              "Lưu từ vựng cùng nghĩa và ngữ cảnh vào bộ thẻ của bạn.",
            ],
            [
              "02",
              "Biến nhớ thành hiểu",
              "Thực hành bằng viết câu, nối cặp và những bài tập tương tác.",
            ],
            [
              "03",
              "Đi theo nhịp của bạn",
              "Quay lại điều cần ôn và xây dựng thói quen từng ngày.",
            ],
          ].map(([n, title, body]) => (
            <article key={n}>
              <span>{n}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </section>
        {children && (
          <section id="home-account" className="landing-account">
            <div>
              <span className="landing-eyebrow">MAKE IT YOURS</span>
              <h2>
                Một nơi lưu giữ
                <br />
                mọi điều bạn học.
              </h2>
              <p>Đăng nhập hoặc tạo tài khoản để bắt đầu.</p>
            </div>
            {children}
          </section>
        )}
        <Status error={action.error} />
      </main>
      <footer className="landing-footer">
        <span>wortify. / Learn with curiosity.</span>
        {user && (user.staff || user.superuser) && (
          <Link to="/manage">Quản trị ↗</Link>
        )}
        <span>English & Deutsch</span>
      </footer>
    </div>
  );
}
