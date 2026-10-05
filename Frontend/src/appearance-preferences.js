export function applyAppearance(p = {}) {
  const root = document.documentElement;
  const style = p.interface === "glass" ? "glass" : "studio";
  root.dataset.interface = style;
  root.dataset.textAuto = String(!p.textColor || p.textColor === "auto");
  const clamp = (v, lo, hi, fallback) =>
    Math.min(
      hi,
      Math.max(lo, Number.isFinite(Number(v)) ? Number(v) : fallback),
    );
  root.style.setProperty(
    "--control-radius",
    `${clamp(p.curvature ?? 18, 0, 32, 18)}px`,
  );
  root.style.setProperty(
    "--glass-lens-scale",
    String(1 + clamp(p.glassLens ?? 40, 0, 100, 40) / 5000),
  );
  root.style.setProperty(
    "--glass-lens-blur",
    `${clamp(p.glassLens ?? 40, 0, 100, 40) / 20}px`,
  );
  const night = style === "glass" && p.background === "night";
  root.dataset.background = p.background || "mist";
  root.style.setProperty(
    "--glass-alpha",
    String(Math.max(0.04, 1 - clamp(p.transparency ?? 25, 0, 100, 25) / 100)),
  );
  root.style.setProperty(
    "--ui-font",
    `${clamp(p.textSize ?? 18, 16, 22, 18)}px`,
  );
  root.style.setProperty("--card-font", `${clamp(p.font ?? 36, 24, 60, 36)}px`);
  root.style.setProperty(
    "--text-weight",
    String(clamp(p.textWeight ?? 500, 400, 700, 500)),
  );
  const color = /^#[0-9a-f]{6}$/i.test(p.textColor)
    ? p.textColor
    : night
      ? "#f0f5ff"
      : style === "studio"
        ? "#24304e"
        : "#152740";
  const contrast = clamp(p.textContrast ?? 80, 0, 100, 80);
  root.style.setProperty(
    "--ink",
    `color-mix(in srgb, ${color} ${70 + contrast * 0.3}%, var(--solid))`,
  );
  root.style.setProperty(
    "--muted",
    `color-mix(in srgb, var(--ink) ${55 + contrast * 0.45}%, var(--solid))`,
  );
}
