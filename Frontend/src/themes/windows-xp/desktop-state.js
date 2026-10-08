export const desktopApps = [
  ["flashcard", "Flashcard", "cards"],
  ["practice", "Practice Hub", "book"],
  ["explore", "Explore", "search"],
  ["create", "Create", "edit"],
  ["profile", "Learning journey", "user"],
  ["classes", "Classes & sharing", "users"],
  ["settings", "Settings", "settings"],
];
export function windowKey(route) {
  const p = route.split("?")[0].split("/").filter(Boolean);
  return p[0] === "manage" ? "admin" : p[1] || "flashcard";
}
export function desktopReducer(state, a) {
  const update = (patch) => ({
    ...state,
    windows: state.windows.map((w) => (w.id === a.id ? { ...w, ...patch } : w)),
  });
  switch (a.type) {
    case "open": {
      const id = windowKey(a.route),
        old = state.windows.find((w) => w.id === id),
        root = /^\/(en|de)\/[^/?]+\/?$/.test(a.route);
      const win = old
        ? { ...old, route: root ? old.route : a.route, minimized: false }
        : {
            id,
            route: a.route,
            title: desktopApps.find((app) => app[0] === id)?.[1] || "Administration",
            x: 150 + (state.windows.length % 5) * 28,
            y: 24 + (state.windows.length % 5) * 28,
            width: 860,
            height: 580,
            minimized: false,
            maximized: false,
          };
      return {
        active: id,
        windows: [...state.windows.filter((w) => w.id !== id), win],
      };
    }
    case "navigate":
      return update({ route: a.route });
    case "focus": {
      const win = state.windows.find((w) => w.id === a.id);
      return win
        ? {
            active: a.id,
            windows: [
              ...state.windows.filter((w) => w.id !== a.id),
              { ...win, minimized: false },
            ],
          }
        : state;
    }
    case "minimize":
    case "close": {
      const windows =
        a.type === "close"
          ? state.windows.filter((w) => w.id !== a.id)
          : state.windows.map((w) =>
              w.id === a.id ? { ...w, minimized: true } : w,
            );
      return {
        windows,
        active:
          state.active === a.id
            ? windows.findLast((w) => !w.minimized)?.id || null
            : state.active,
      };
    }
    case "geometry":
      return update(a.patch);
    case "reset":
      return {
        ...state,
        windows: state.windows.map((w, i) => ({
          ...w,
          x: 24 + (i % 5) * 24,
          y: 24 + (i % 5) * 24,
          maximized: false,
        })),
      };
    default:
      return state;
  }
}
