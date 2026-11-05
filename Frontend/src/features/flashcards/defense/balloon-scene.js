export function launchDefense(
  container,
  engine,
  { audio, onFrame, onReady, onEnd, labels },
) {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:100%;height:100%;display:block";
  container.append(canvas);
  const ctx = canvas.getContext("2d");
  let frame,
    previous = performance.now(),
    lastHud = 0;
  function draw(now) {
    const w = container.clientWidth,
      h = container.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    engine.tick((now - previous) / 1000);
    previous = now;
    const s = engine.state,
      card = s.rocks[0].card;
    const ground = h * 0.92,
      radius = Math.min(w, h) * 0.08;
    const y = ground - radius - s.height * (ground - 2 * radius - 10);
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#162544");
    sky.addColorStop(0.65, "#536f96");
    sky.addColorStop(1, "#e4ad93");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    for (let layer = 0; layer < 2; layer++) {
      ctx.beginPath();
      ctx.moveTo(0, ground);
      for (let x = 0; x < w + 9; x += 8) {
        ctx.lineTo(
          x,
          ground -
            h *
              (0.09 +
                0.045 * Math.sin((x / w) * 9 + layer * 3) +
                0.075 * (1 - layer)),
        );
      }
      ctx.lineTo(w, ground);
      ctx.closePath();
      ctx.fillStyle = layer ? "#385967" : "#637c91";
      ctx.fill();
    }
    ctx.fillStyle = "#305951";
    ctx.fillRect(0, ground, w, h - ground);
    ctx.beginPath();
    ctx.arc(w / 2, y, radius, 0, Math.PI * 2);
    const glow = ctx.createRadialGradient(
      w / 2 - radius * 0.35,
      y - radius * 0.4,
      0,
      w / 2,
      y,
      radius,
    );
    glow.addColorStop(0, "#fff0b3");
    glow.addColorStop(0.45, "#ff9b6e");
    glow.addColorStop(1, "#bd4565");
    ctx.fillStyle = glow;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(
      w / 2 - radius * 0.3,
      y - radius * 0.3,
      radius * 0.17,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = "#ffd6ad";
    ctx.fill();
    ctx.textAlign = "center";
    ctx.font = "bold 20px system-ui";
    ctx.fillStyle = "white";
    ctx.fillText(
      s.options.direction === "audio" ? labels.listen : card.prompt,
      w / 2,
      y < h / 2 ? y + radius + 28 : y - radius - 12,
      w * 0.9,
    );
    if (s.ended) {
      onEnd(s);
      return;
    }
    if (!s.paused && (s.options.autoListen || s.options.direction === "audio"))
      audio.repeat([card], card);
    if (now - lastHud >= 75) {
      onFrame(s);
      lastHud = now;
    }
    frame = requestAnimationFrame(draw);
  }
  frame = requestAnimationFrame(draw);
  onReady();
  return () => {
    cancelAnimationFrame(frame);
    canvas.remove();
  };
}
