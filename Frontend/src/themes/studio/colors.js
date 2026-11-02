export const studioColorDefaults = {
  studioPageColor: "#f5faf6",
  studioNavColor: "#294b40",
  studioAccentColor: "#26735b",
};
const valid = (value) =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
export const studioColor = (prefs, key) =>
  valid(prefs[key]) ? prefs[key] : studioColorDefaults[key];
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
export function luminance(hex) {
  const channels = rgb(hex).map((v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
export function colorContrast(a, b) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const foreground = (bg) =>
  colorContrast(bg, "#000000") > colorContrast(bg, "#ffffff")
    ? "#000000"
    : "#ffffff";
const mix = (a, b, amount) =>
  "#" +
  rgb(a)
    .map((v, i) =>
      Math.round(v * (1 - amount) + rgb(b)[i] * amount)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
export function studioPalette(prefs = {}) {
  const page = studioColor(prefs, "studioPageColor"),
    nav = studioColor(prefs, "studioNavColor"),
    accent = studioColor(prefs, "studioAccentColor");
  const navDefault = nav.toLowerCase() === studioColorDefaults.studioNavColor;
  const accentDefault =
    accent.toLowerCase() === studioColorDefaults.studioAccentColor;
  const ink = foreground(nav),
    soft = mix(accent, "#ffffff", 0.87);
  let strong = accent;
  while (colorContrast(strong, soft) < 4.5)
    strong = mix(strong, "#000000", 0.12);
  const values = {
    page,
    glow:
      page.toLowerCase() === studioColorDefaults.studioPageColor
        ? "#e1f3e8"
        : mix(page, accent, 0.08),
    nav,
    "nav-ink": navDefault ? "#f2fbf5" : ink,
    "nav-muted": navDefault ? "#c4ddcf" : mix(nav, ink, 0.82),
    "nav-line": navDefault ? "#567c69" : mix(nav, ink, 0.35),
    "nav-surface": navDefault
      ? "#355b4b"
      : mix(nav, ink === "#ffffff" ? "#000000" : "#ffffff", 0.1),
    "nav-hover": navDefault
      ? "#416e59"
      : mix(nav, ink === "#ffffff" ? "#000000" : "#ffffff", 0.17),
    "nav-active": accentDefault ? "#c7ecd5" : mix(accent, "#ffffff", 0.72),
    "nav-active-ink": foreground(
      accentDefault ? "#c7ecd5" : mix(accent, "#ffffff", 0.72),
    ),
    accent,
    "accent-ink": foreground(accent),
    "accent-hover": mix(
      accent,
      foreground(accent) === "#ffffff" ? "#000000" : "#ffffff",
      0.12,
    ),
    "accent-soft": soft,
    "accent-strong": strong,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => ["--studio-" + key, value]),
  );
}
