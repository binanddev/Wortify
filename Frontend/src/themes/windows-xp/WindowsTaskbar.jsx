import { useEffect, useRef, useState } from "react";
import { ThemeProvider, StyleSheetManager } from "styled-components";
import { Button, Frame, Toolbar } from "react95";
import original from "react95/dist/themes/original";
import { navigate } from "../../lib/core.js";
import { Icon } from "../../components/ui/ui.jsx";

// React95 v4 still forwards legacy styling props; keep them off native DOM nodes.
const stylingProps = new Set([
  "noPadding",
  "active",
  "fullWidth",
  "primary",
  "square",
  "shadow",
  "variant",
]);
const forwardProp = (prop, target) =>
  typeof target !== "string" || !stylingProps.has(prop);

export default function WindowsTaskbar({
  lang,
  title,
  windows,
  onWindow,
  onLaunch,
  canManage,
  onLogout,
}) {
  const [open, setOpen] = useState(false);
  const root = useRef(null),
    trigger = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (event) => {
      if (event.type === "keydown" && event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      } else if (
        event.type === "pointerdown" &&
        !root.current?.contains(event.target)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <StyleSheetManager shouldForwardProp={forwardProp}>
      <ThemeProvider theme={original}>
        <div className="windows-taskbar" ref={root}>
          {open && (
            <Frame className="windows-start-menu">
              <strong>Wortify · Windows</strong>
              <nav id="windows-start-navigation" aria-label="Start menu">
                {[
                  ["flashcard", "cards", "Decks"],
                  ["practice", "book", "Exercises"],
                  ["create", "edit", "Create content"],
                  ["profile", "user", "Learning journey"],
                  ["explore", "search", "Explore"],
                  ["classes", "users", "Classes & sharing"],
                  ["settings", "settings", "Settings"],
                ].map(([path, icon, label]) => (
                  <Button
                    key={path}
                    fullWidth
                    onClick={() => {
                      setOpen(false);
                      (onLaunch || navigate)(`/${lang}/${path}`);
                    }}
                  >
                    <Icon name={icon} />
                    {label}
                  </Button>
                ))}
              </nav>
              {canManage && (
                <Button
                  fullWidth
                  onClick={() => {
                    setOpen(false);
                    onLaunch?.(`/${lang}/admin`);
                  }}
                >
                  Administration
                </Button>
              )}
              <Button
                fullWidth
                onClick={() => {
                  setOpen(false);
                  navigate("/");
                }}
              >
                Home
              </Button>
              {onLogout && (
                <Button fullWidth onClick={onLogout}>
                  Sign out
                </Button>
              )}
            </Frame>
          )}
          <Toolbar>
            <Button
              ref={trigger}
              active={open}
              aria-controls="windows-start-navigation"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              <span className="windows-start-mark" aria-hidden="true">
                ▦
              </span>{" "}
              Start
            </Button>
            {windows ? (
              windows.map((win) => (
                <Button
                  key={win.id}
                  className="windows-task-title"
                  active={win.active && !win.minimized}
                  aria-pressed={win.active && !win.minimized}
                  onClick={() => onWindow(win.id)}
                  title={`${win.minimized ? "Restore" : "Switch to"} ${win.title}`}
                >
                  <Icon name={win.id === "nav" ? "cards" : "book"} />
                  <span>{win.title}</span>
                </Button>
              ))
            ) : (
              <Frame variant="well" className="windows-task-title">
                <Icon name="book" />
                {title}
              </Frame>
            )}
            <span className="windows-language">{lang.toUpperCase()}</span>
          </Toolbar>
        </div>
      </ThemeProvider>
    </StyleSheetManager>
  );
}
