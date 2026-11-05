// A static sky plate keeps the textured nebula and planetary atmosphere off
// the frame loop. Dimmer midtones leave the vocabulary cards in the foreground.
export function paintGalaxy(ctx, width, height) {
  let seed = 82417;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  function mist(x, y, radius, rgb, opacity) {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, `rgba(${rgb},${opacity})`);
    glow.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(x - radius, y - radius, 2 * radius, 2 * radius);
  }
  ctx.fillStyle = "#060c1c";
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 300; i++) {
    const t = random(),
      x = t * width;
    const y =
      height * (0.8 - t * 0.68 + 0.09 * Math.sin(7 * t)) +
      (random() - 0.5) * 140;
    mist(
      x,
      y,
      18 + random() * 100,
      t < 0.46 ? "41,110,140" : "118,71,151",
      0.025 + random() * 0.09,
    );
  }
  for (let i = 0; i < 3400; i++) {
    const x = random() * width,
      concentrated = i % 3 !== 0;
    const y = concentrated
      ? height * (0.8 - (x / width) * 0.68 + 0.09 * Math.sin((7 * x) / width)) +
        (random() + random() + random() - 1.5) * 105
      : random() * height;
    const size = random() < 0.96 ? 0.8 : 1.8;
    ctx.globalAlpha = 0.15 + random() * 0.55;
    ctx.fillStyle = i % 5 === 0 ? "#f5c0a2" : "#c7dfff";
    ctx.fillRect(x, y, size, size);
    if (size > 1 && i % 9 === 0) mist(x, y, 6, "157,197,255", 0.6);
  }
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.translate(width * 0.81, height * 0.24);
  ctx.rotate(-0.29);
  const r = height * 0.13;
  function rings(start, end) {
    for (let i = 0; i < 26; i++) {
      ctx.beginPath();
      ctx.ellipse(
        0,
        0,
        r * (1.25 + i * 0.024),
        r * (0.26 + i * 0.005),
        0,
        start,
        end,
      );
      ctx.strokeStyle = `rgba(206,181,161,${0.07 + 0.22 * Math.abs(Math.sin(i * 0.63))})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  }
  rings(Math.PI, 2 * Math.PI);
  mist(0, 0, r * 1.23, "110,153,203", 0.45);
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, 2 * Math.PI);
  ctx.clip();
  const surface = ctx.createLinearGradient(0, -r, 0, r);
  surface.addColorStop(0, "#c6ac9d");
  surface.addColorStop(0.35, "#8d8290");
  surface.addColorStop(0.7, "#625c72");
  surface.addColorStop(1, "#353e58");
  ctx.fillStyle = surface;
  ctx.fillRect(-r, -r, 2 * r, 2 * r);
  for (let i = 0; i < 65; i++) {
    const y = (random() * 2 - 1) * r;
    ctx.beginPath();
    ctx.moveTo(-r, y);
    ctx.quadraticCurveTo(0, y + 11, r, y - 4);
    ctx.lineWidth = 0.6 + random() * 3;
    ctx.strokeStyle = "rgba(238,211,188,0.13)";
    ctx.stroke();
  }
  const shade = ctx.createRadialGradient(
    -r * 0.73,
    -r * 0.65,
    0,
    -r * 0.73,
    -r * 0.65,
    r * 1.78,
  );
  shade.addColorStop(0, "rgba(226,230,239,0.28)");
  shade.addColorStop(0.44, "rgba(16,22,40,0.2)");
  shade.addColorStop(0.79, "rgba(9,15,32,0.91)");
  shade.addColorStop(1, "#0a1224");
  ctx.fillStyle = shade;
  ctx.fillRect(-r, -r, 2 * r, 2 * r);
  ctx.restore();
  rings(0, Math.PI);
  ctx.restore();
}
