export function guestRoute(route) {
  const path = route.split("?")[0].replace(/\/$/, "") || "/";
  if (path === "/") return { kind: "home", lang: "de", needsAccount: false };
  if (path === "/login")
    return { kind: "flashcard", lang: "de", needsAccount: true };
  const match = /^\/(de|en)\/(.*)$/.exec(path);
  if (!match) return { kind: "flashcard", lang: "de", needsAccount: true };
  const [, lang, tail] = match;
  for (const [kind, pattern] of [
    ["flashcard", /^flashcard(?:\/discover)?$/],
    ["practice", /^(?:explore|practice(?:\/all)?)$/],
    ["reading", /^reading(?:\/discover)?$/],
  ])
    if (pattern.test(tail)) return { kind, lang, needsAccount: false };
  for (const [kind, pattern] of [
    ["flashcard", /^flashcard\/deck\/(\d+)$/],
    ["practice", /^practice\/(\d+)$/],
    ["reading", /^reading\/(\d+)(?:\/passage)?$/],
  ]) {
    const item = pattern.exec(tail);
    if (item) return { kind, lang, id: Number(item[1]), needsAccount: false };
  }
  return { kind: "flashcard", lang, needsAccount: true };
}
