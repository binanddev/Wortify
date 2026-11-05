import { birdX, gateWidth } from "./bird-engine.js";
import { glyphs, answerLetters } from "./defense-engine.js";
export function launchDefense(
  container,
  engine,
  { audio, onFrame, onReady, onEnd, labels, reducedMotion },
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
      radius = Math.min(28, Math.min(w, h) * 0.055);
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
    const altitudeY = (value) =>
      ground - radius - value * (ground - 2 * radius - 10);
    const gate = s.gate;
    const gx = gate.x * w,
      gw = gateWidth * w;
    ctx.save();
    ctx.globalAlpha = gate.brushed ? 0.28 : 0.85;
    for (const [edge, end] of [
      [0, altitudeY(gate.top)],
      [ground, altitudeY(gate.bottom)],
    ]) {
      const stone = ctx.createLinearGradient(gx - gw / 2, 0, gx + gw / 2, 0);
      stone.addColorStop(0, "#375964");
      stone.addColorStop(0.5, "#71918a");
      stone.addColorStop(1, "#284951");
      ctx.fillStyle = stone;
      ctx.fillRect(gx - gw / 2, Math.min(edge, end), gw, Math.abs(edge - end));
      ctx.fillStyle = "#c6c893";
      ctx.fillRect(gx - gw / 2 - 3, end - 3, gw + 6, 6);
    }
    ctx.restore();
    const x = w * birdX,
      bw = Math.min(375, x - radius * 1.5 - 16);
    const left = x - radius * 1.6 - bw,
      boardHeight = card.partOfSpeech ? 68 : 52,
      boardY = Math.max(2, Math.min(ground - boardHeight, y - boardHeight / 2));
    ctx.strokeStyle = "#eed29a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - radius * 0.7, y);
    ctx.lineTo(left + bw, boardY + 10);
    ctx.moveTo(x - radius * 0.7, y);
    ctx.lineTo(left + bw, boardY + boardHeight - 9);
    ctx.stroke();
    ctx.fillStyle = "#142737";
    ctx.strokeStyle = "#d1b982";
    ctx.beginPath();
    ctx.roundRect(left, boardY, bw, boardHeight, 7);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = "center";
    if (card.partOfSpeech) {
      ctx.fillStyle = "#ffd793";
      ctx.font = "600 12px system-ui";
      ctx.fillText(card.partOfSpeech, left + bw / 2, boardY + 15, bw - 14);
    }
    ctx.font = "600 17px system-ui";
    ctx.fillStyle = "#fff1d9";
    ctx.fillText(
      s.options.direction === "audio" ? labels.listen : card.prompt,
      left + bw / 2,
      boardY + boardHeight - 32,
      bw - 10,
    );
    const entered = s.rocks[0].typed;
    ctx.font = "bold 14px monospace";
    ctx.fillStyle = "#9ce7d8";
    const count = glyphs(answerLetters(card.answer)).length;
    ctx.fillText(
      entered +
        "＿".repeat(Math.min(12, Math.max(0, count - glyphs(entered).length))),
      left + bw / 2,
      boardY + boardHeight - 10,
      bw - 12,
    );
    if (!reducedMotion) {
      const line =
        entered +
        "＿".repeat(Math.min(12, Math.max(0, count - glyphs(entered).length)));
      const lineWidth = ctx.measureText(line).width;
      const scale = Math.min(1, (bw - 12) / Math.max(1, lineWidth));
      for (const shot of s.flyingLetters) {
        const progress = Math.min(1, (s.time - shot.time) / 0.22);
        const prefix = glyphs(entered).slice(0, shot.index).join("");
        const endX =
          shot.target === s.target
            ? left +
              bw / 2 +
              scale *
                (ctx.measureText(prefix).width +
                  ctx.measureText(shot.letter).width / 2 -
                  lineWidth / 2)
            : left + bw / 2;
        const endY = boardY + boardHeight - 10;
        ctx.fillStyle = "#ffe9ad";
        ctx.fillText(
          shot.letter,
          endX + 48 * (1 - progress),
          endY + 50 * (1 - progress),
        );
      }
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(radius, radius);
    const wing = reducedMotion
      ? 0.1
      : 0.28 * Math.sin(s.time * (s.velocity > 0 ? 18 : 7));
    ctx.fillStyle = "#29455c";
    ctx.beginPath();
    ctx.moveTo(-0.55, 0);
    ctx.lineTo(-1.65, -0.37);
    ctx.lineTo(-1.2, 0.22);
    ctx.lineTo(-0.4, 0.36);
    ctx.fill();
    ctx.fillStyle = "#f6bc75";
    ctx.beginPath();
    ctx.ellipse(0, 0, 1, 0.65, -0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#cf754d";
    ctx.beginPath();
    ctx.arc(0.59, -0.39, 0.52, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffde8b";
    ctx.beginPath();
    ctx.moveTo(0.98, -0.46);
    ctx.lineTo(1.48, -0.31);
    ctx.lineTo(1, -0.19);
    ctx.fill();
    ctx.fillStyle = "#213447";
    ctx.beginPath();
    ctx.arc(0.76, -0.49, 0.105, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(wing);
    ctx.fillStyle = "#428391";
    ctx.beginPath();
    ctx.moveTo(0.28, -0.1);
    ctx.quadraticCurveTo(-0.4, -0.7, -1.03, -0.52);
    ctx.quadraticCurveTo(-0.55, 0.65, 0.28, -0.1);
    ctx.fill();
    ctx.restore();
    if (s.featherUntil > s.time) {
      ctx.strokeStyle = "#ffdfad";
      ctx.beginPath();
      ctx.arc(x, y, radius * 1.6, 0, Math.PI * 2);
      ctx.stroke();
    }
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
