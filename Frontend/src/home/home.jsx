import { Link, Status } from "../components/ui/ui.jsx";
import { request, useAction } from "../lib/core.js";
export default function Home({ user, setUser, children }) {
  const action = useAction();
  return (
    <div id="wortify-home" className="home-simple">
      <header>
        <Link to="/" className="home-brand">
          wortify<span>.</span>
        </Link>
        {user && (
          <button
            onClick={() =>
              action.run(async (signal) => {
                await request("/api/session/", "DELETE", undefined, signal);
                setUser(null);
              })
            }
          >
            Sign out
          </button>
        )}
      </header>
      <main>
        {children || (
          <section className="home-choice">
            <h1>Choose a language</h1>
            <p>Continue your learning.</p>
            <div>
              {[
                ["en", "English", "English"],
                ["de", "Deutsch", "German"],
              ].map(([id, name, label]) => (
                <Link key={id} to={`/${id}/flashcard`}>
                  <span>
                    <strong>{name}</strong>
                    <small>{label}</small>
                  </span>
                  <span aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
            {(user?.staff || user?.superuser) && (
              <Link className="home-admin" to="/manage">
                Open Admin center →
              </Link>
            )}
          </section>
        )}
        <Status error={action.error} />
      </main>
      <footer>English & Deutsch</footer>
    </div>
  );
}
