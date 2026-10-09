export function glassPolicy(p) {
  if (p.interface !== "glass") return p;
  return {
    ...p,
    textColor: "#ffffff",
    textSize: 18,
    textWeight: 500,
    textContrast: 100,
    font: 36,
    navScale: Math.min(150, Math.max(50, Number(p.navScale) || 100)),
    curvature: 24,
    glassLens: 0,
    transparency: Math.min(100, Math.max(10, Number(p.transparency ?? 25) || 10)),
  };
}
