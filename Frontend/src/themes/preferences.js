import { interfaceName } from "./registry.js";
import { glassPolicy } from "./glass/policy.js";
export const visualDefaults = {
  navScale: 100,
  font: 36,
  transparency: 25,
  textSize: 18,
  textWeight: 500,
  textContrast: 80,
  textColor: "auto",
  curvature: 18,
  glassLens: 40,
};
const snapshot = (p) =>
  Object.fromEntries(
    Object.keys(visualDefaults).map((k) => [k, p[k] ?? visualDefaults[k]]),
  );
const keyOf = (p, theme) =>
  `${theme ?? "default"}:${interfaceName(p.interface)}:${p.background || "mist"}`;
export function restoreAppearance(p, theme, restoreSelection = false) {
  if (restoreSelection)
    p = { ...p, ...p.appearanceSelections?.[theme ?? "default"] };
  return glassPolicy({
    ...p,
    interface: interfaceName(p.interface),
    ...(p.appearanceProfiles?.[keyOf(p, theme)] || {}),
  });
}
export function updateAppearance(previous, requested, theme) {
  const oldKey = keyOf(previous, theme),
    newKey = keyOf(requested, theme);
  const profiles = {
    ...previous.appearanceProfiles,
    [oldKey]: snapshot(previous),
  };
  const next =
    oldKey === newKey
      ? requested
      : { ...requested, ...(profiles[newKey] || visualDefaults) };
  const fixed = glassPolicy(next);
  return {
    ...fixed,
    appearanceSelections: {
      ...previous.appearanceSelections,
      [theme ?? "default"]: {
        interface: next.interface,
        background: next.background,
      },
    },
    appearanceProfiles: { ...profiles, [keyOf(fixed, theme)]: snapshot(fixed) },
  };
}
