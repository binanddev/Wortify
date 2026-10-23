let account = null;
let workspace = "shared";
export function configureStaffWorkspace(user) {
  const editor = Boolean(user && (user.staff || user.superuser));
  const id = editor ? user.id : null;
  if (account === id) return;
  account = id;
  try { workspace = sessionStorage.getItem(`wortify:editor-workspace:${id}`) === "personal" ? "personal" : "shared"; }
  catch { workspace = "shared"; }
}
export function staffWorkspace() { return account === null ? null : workspace; }
export function selectStaffWorkspace(value) {
  if (account === null || !["shared", "personal"].includes(value)) return;
  workspace = value;
  try { sessionStorage.setItem(`wortify:editor-workspace:${account}`, value); } catch {}
}
export function workspaceSection(path) {
  const match = /^\/api\/(en|de)\/(decks|folders|practice-hub|reading)\//.exec(path);
  return match ? `${match[1]}:${({decks:"flashcards", folders:"flashcards", "practice-hub":"practice", reading:"reading"})[match[2]]}` : null;
}

export function workspaceUrl(path) {
  const selected = staffWorkspace();
  return selected ? `${path}${path.includes("?") ? "&" : "?"}workspace=${selected}` : path;
}
