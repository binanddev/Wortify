import SidebarResize from "./SidebarResize.jsx";
import DesktopShortcut from "./DesktopShortcut.jsx";
import {
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { WindowContext, navigate } from "../../lib/core.js";
import { Confirm } from "../../components/ui/ui.jsx";
import WindowsTaskbar from "./WindowsTaskbar.jsx";
import { desktopApps, desktopReducer, windowKey } from "./desktop-state.js";
function address(route) {
  if (location.pathname + location.search === route) return;
  history.replaceState({}, "", route);
  const event = new PopStateEvent("popstate");
  event.desktopFocus = true;
  window.dispatchEvent(event);
}
export default function WindowsDesktop({
  lang,
  route,
  renderContent,
  renderNavigation,
  canManage,
  onLogout,
}) {
  const [state, dispatch] = useReducer(
    desktopReducer,
    { active: null, windows: [] },
    (s) => desktopReducer(s, { type: "open", route }),
  );
  const active = state.windows.find((w) => w.id === state.active);
  useEffect(() => {
    const open = (e) => {
      if (!e.desktopFocus && location.pathname.startsWith("/" + lang + "/"))
        dispatch({ type: "open", route: location.pathname + location.search });
    };
    const reset = () => dispatch({ type: "reset" });
    window.addEventListener("popstate", open);
    window.addEventListener("resize", reset);
    return () => {
      window.removeEventListener("popstate", open);
      window.removeEventListener("resize", reset);
    };
  }, [lang]);
  useEffect(() => {
    if (active) address(active.route);
  }, [active?.route, state.active]);
  const launch = (path) => dispatch({ type: "open", route: path });
  const go = (id, path) => {
    if (!path.startsWith("/" + lang + "/")) {
      navigate(path);
      return;
    }
    dispatch(
      windowKey(path) === id
        ? { type: "navigate", id, route: path }
        : { type: "open", route: path },
    );
  };
  const apps = desktopApps;
  return (
    <>
      <div className="xp-desktop-area" id="main-content" tabIndex={-1}>
        <div className="xp-desktop-launchers" aria-label="Applications">
          {apps.map(([id, label, icon]) => (
            <DesktopShortcut
              key={id}
              id={id}
              label={label}
              index={apps.findIndex((app) => app[0] === id)}
              onOpen={() => launch(`/${lang}/${id}`)}
            />
          ))}
        </div>
        {state.windows.map((win, index) => (
          <DesktopWindow
            key={win.id}
            win={win}
            index={index}
            active={state.active === win.id}
            dispatch={dispatch}
            renderNavigation={renderNavigation}
            navigate={(path) => go(win.id, path)}
          >
            {renderContent(win.route)}
          </DesktopWindow>
        ))}
      </div>
      <WindowsTaskbar
        lang={lang}
        windows={state.windows.map((w) => ({
          ...w,
          active: w.id === state.active,
        }))}
        onWindow={(id) => dispatch({ type: "focus", id })}
        onLaunch={launch}
        canManage={canManage}
        onLogout={onLogout}
      />
    </>
  );
}
function DesktopWindow({
  win,
  index,
  active,
  dispatch,
  renderNavigation,
  navigate,
  children,
}) {
  const [closing, setClosing] = useState(false);
  const [target] = useState(() => {
    const node = document.createElement("div");
    node.className = "xp-window-tools";
    return node;
  });
  const drag = useRef(null);
  const [toolsHost, setToolsHost] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(248);
  useLayoutEffect(() => {
    if (!toolsHost) return;
    toolsHost.appendChild(target);
    return () => target.remove();
  }, [toolsHost, target]);
  const focus = () => dispatch({ type: "focus", id: win.id });
  const start = (e, resize = false) => {
    if (
      e.button !== 0 ||
      win.maximized ||
      (!resize && e.target.closest("button"))
    )
      return;
    focus();
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      left: win.x,
      top: win.y,
      w: win.width,
      h: win.height,
      resize,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x,
      dy = e.clientY - d.y;
    dispatch({
      type: "geometry",
      id: win.id,
      patch: d.resize
        ? {
            width: Math.max(300, Math.min(innerWidth - 12, d.w + dx)),
            height: Math.max(200, Math.min(innerHeight - 70, d.h + dy)),
          }
        : {
            x: Math.max(0, Math.min(innerWidth - 120, d.left + dx)),
            y: Math.max(0, Math.min(innerHeight - 130, d.top + dy)),
          },
    });
  };
  const stop = () => (drag.current = null);
  const maximize = () =>
    dispatch({
      type: "geometry",
      id: win.id,
      patch: { maximized: !win.maximized },
    });
  return (
    <WindowContext.Provider
      value={{
        route: win.route,
        navigate,
        toolsTarget: target,
        activate: focus,
        active: active && !win.minimized,
      }}
    >
      <section
        className="xp-app-window"
        aria-label={win.title}
        data-window-id={win.id}
        data-active={active}
        data-maximized={win.maximized}
        hidden={win.minimized}
        inert={win.minimized}
        onPointerDownCapture={() => {
          if (!active) focus();
        }}
        onFocusCapture={() => {
          if (!active) focus();
        }}
        style={{
          left: Math.min(win.x, Math.max(0, innerWidth - 310)),
          top: Math.min(win.y, Math.max(0, innerHeight - 270)),
          width: win.width,
          height: win.height,
          zIndex: 20 + index,
        }}
      >
        <header
          className="xp-window-title"
          onPointerDown={(e) => start(e)}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerCancel={stop}
          onLostPointerCapture={stop}
          onDoubleClick={(e) => {
            if (!e.target.closest("button")) maximize();
          }}
        >
          <span aria-hidden="true">▣</span>
          <strong>{win.title} — Wortify</strong>
          <div className="xp-window-controls">
            <button
              title="Toggle sidebar"
              aria-label={`Toggle ${win.title} sidebar`}
              onClick={() => setSidebarOpen((v) => !v)}
            >
              ☰
            </button>
            <button
              title="Minimize"
              aria-label={`Minimize ${win.title}`}
              onClick={() => dispatch({ type: "minimize", id: win.id })}
            >
              _
            </button>
            <button
              title="Maximize / Restore"
              aria-label={`Maximize or restore ${win.title}`}
              onClick={maximize}
            >
              {win.maximized ? "❐" : "□"}
            </button>
            <button
              className="xp-close"
              title="Close"
              aria-label={`Close ${win.title}`}
              onClick={() => {
                setClosing(true);
              }}
            >
              ×
            </button>
          </div>
        </header>
        <div className="xp-window-body">
          <aside
            className="xp-app-sidebar"
            style={{ width: sidebarWidth }}
            hidden={!sidebarOpen}
            aria-label={`${win.title} navigation`}
          >
            <h2>{win.title}</h2>
            {renderNavigation?.(win.route)}
            <div ref={setToolsHost} className="xp-sidebar-tools" />
          </aside>
          {sidebarOpen && <SidebarResize width={sidebarWidth} onChange={setSidebarWidth} title={win.title} />}
          <div className="xp-window-viewport">
            <div className="xp-window-core">{children}</div>
          </div>
        </div>
        <footer className="xp-window-status">
          <span>{win.title}</span>
          <button
            aria-label="Arrange windows"
            onClick={() => dispatch({ type: "reset" })}
          >
            ▦
          </button>
          <button
            className="xp-window-resize"
            aria-label={`Resize ${win.title}`}
            onPointerDown={(e) => start(e, true)}
            onPointerMove={move}
            onPointerUp={stop}
            onPointerCancel={stop}
            onLostPointerCapture={stop}
            onKeyDown={(e) => {
              if (e.key.startsWith("Arrow")) {
                e.preventDefault();
                dispatch({
                  type: "geometry",
                  id: win.id,
                  patch: {
                    width: Math.max(
                      300,
                      win.width +
                        ({ ArrowLeft: -20, ArrowRight: 20 }[e.key] || 0),
                    ),
                    height: Math.max(
                      200,
                      win.height +
                        ({ ArrowUp: -20, ArrowDown: 20 }[e.key] || 0),
                    ),
                  },
                });
              }
            }}
          >
            ◢
          </button>
        </footer>
      </section>
      {closing && (
        <Confirm
          title={`Close ${win.title}?`}
          description="Unsaved content in this window may be lost."
          confirmLabel="Close window"
          onClose={() => setClosing(false)}
          onConfirm={() => dispatch({ type: "close", id: win.id })}
        />
      )}
    </WindowContext.Provider>
  );
}
