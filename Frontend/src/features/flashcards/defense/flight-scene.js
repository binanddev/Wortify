import Phaser from "phaser";
import { mask } from "./defense-engine.js";
export function launchDefense(
  parent,
  engine,
  { audio, labels, onFrame, onEnd, onReady, onFocus, reducedMotion = false },
) {
  class FlightScene extends Phaser.Scene {
    create() {
      this.world = this.add.graphics();
      this.particles = this.add.graphics();
      this.title = this.add
        .text(0, 24, "", {
          fontFamily: "system-ui",
          fontSize: 15,
          color: "#bcf5ff",
          align: "center",
        })
        .setOrigin(0.5);
      this.clue = this.add
        .text(0, 0, "", {
          fontFamily: "system-ui",
          fontSize: 22,
          color: "#ffffff",
          align: "center",
          wordWrap: { width: 300 },
        })
        .setOrigin(0.5);
      this.answer = this.add
        .text(0, 0, "", {
          fontFamily: "system-ui",
          fontSize: 22,
          color: "#a5ffcf",
          align: "center",
          wordWrap: { width: 300 },
        })
        .setOrigin(0.5);
      this.lastFrame = 0;
      this.flash = 0;
      this.input.on("pointerdown", () => {
        engine.flap();
        onFocus();
      });
      onReady?.();
      onFrame(engine.state);
    }
    update(time, delta) {
      engine.tick(delta / 1000);
      const s = engine.state,
        w = this.scale.width,
        h = this.scale.height,
        g = this.world;
      for (const e of engine.drain()) {
        if (e.type === "end") {
          audio.stop();
          onEnd(s);
        } else audio.tone(e.type);
        if (e.type === "impact" && !reducedMotion)
          this.cameras.main.flash(140, 180, 40, 60);
      }
      if (s.quiz && !s.paused && s.options.direction === "audio")
        audio.repeat(
          s.rocks.map((r) => r.card),
          s.rocks[0]?.card,
        );
      g.clear();
      g.fillGradientStyle(0x111f49, 0x24234a, 0x163652, 0x103040, 1).fillRect(
        0,
        0,
        w,
        h,
      );
      // Parallax stars, layered peaks, orbital sun and drifting clouds.
      for (let i = 0; i < 65; i++) {
        const x =
            (i * 83.7 - (reducedMotion ? 0 : s.time * (3 + (i % 4))) + w * 20) %
            w,
          y = (i * 47.3) % (h * 0.8);
        g.fillStyle(0xd2ecff, 0.25 + (i % 3) * 0.18).fillCircle(
          x,
          y,
          i % 3 === 0 ? 1.5 : 0.8,
        );
      }
      g.fillStyle(s.storm ? 0x9769bb : 0xffc580, 0.12).fillCircle(
        w * 0.82,
        h * 0.22,
        Math.min(90, w * 0.2),
      );
      g.lineStyle(1, 0xbde9ff, 0.12).strokeCircle(
        w * 0.82,
        h * 0.22,
        Math.min(100, w * 0.22),
      );
      for (let layer = 0; layer < 3; layer++) {
        const points = [{ x: 0, y: h }];
        for (let x = 0; x <= w + 40; x += 40)
          points.push({
            x,
            y:
              h -
              20 -
              layer * 32 -
              Math.abs(Math.sin(x * 0.01 + layer + s.time * 0.025)) * 45,
          });
        points.push({ x: w, y: h });
        g.fillStyle([0x16354a, 0x19495d, 0x205970][layer], 0.85).fillPoints(
          points,
          true,
        );
      }
      const gate = s.gate,
        c = gate.center + (s.storm ? Math.sin(s.time * 1.7) * 0.045 : 0),
        x = gate.x * w,
        top = (c - gate.gap / 2) * h,
        bottom = (c + gate.gap / 2) * h,
        wide = Math.max(20, w * 0.055);
      const color = s.storm ? 0xe995ff : 0x79dfdb;
      for (const [y, height] of [
        [0, top],
        [bottom, h - bottom],
      ]) {
        g.fillStyle(0x142d40).fillRoundedRect(x - wide / 2, y, wide, height, 5);
        g.lineStyle(2, color, 0.85).strokeRoundedRect(
          x - wide / 2,
          y,
          wide,
          height,
          5,
        );
        for (let yy = y + 10; yy < y + height - 8; yy += 24)
          g.lineStyle(1, color, 0.2).lineBetween(
            x - wide / 2 + 5,
            yy,
            x + wide / 2 - 5,
            yy + 7,
          );
      }
      if (!gate.answered) {
        g.fillStyle(color, 0.1).fillRect(x - wide / 2, top, wide, bottom - top);
        g.lineStyle(2, color, 0.6).lineBetween(x, top, x, bottom);
      } else {
        g.lineStyle(2, 0x9fffca, 0.4).strokeCircle(
          x,
          c * h,
          Math.min(32, (bottom - top) * 0.18),
        );
      }
      if (gate.drone) {
        const dx = (gate.x + 0.22) * w,
          dy = (0.5 + Math.sin(s.time * 2) * 0.28) * h;
        g.lineStyle(3, 0xff9c98, 0.9).strokeCircle(dx, dy, 13);
        g.fillStyle(0x462635).fillCircle(dx, dy, 9);
        g.fillStyle(0xffdc89).fillCircle(dx, dy, 4);
        g.lineStyle(2, 0xff9c98, 0.6).lineBetween(dx - 23, dy, dx + 23, dy);
      }
      const bx = 0.25 * w,
        by = s.bird.y * h;
      for (let i = 7; i > 0; i--)
        g.fillStyle(0x6feeff, (8 - i) * 0.025).fillCircle(
          bx - i * 8,
          by + Math.sin(s.time * 6 - i) * 3,
          Math.max(1, 9 - i),
        );
      if (s.shield > 0) g.lineStyle(2, 0x97ffe1, 0.6).strokeCircle(bx, by, 24);
      g.fillStyle(0x63d9ef).fillEllipse(bx, by, 31, 24);
      g.fillStyle(0xf9d892).fillTriangle(
        bx + 12,
        by - 4,
        bx + 23,
        by + 1,
        bx + 11,
        by + 5,
      );
      g.fillStyle(0xf7ffff).fillCircle(bx + 7, by - 5, 6);
      g.fillStyle(0x122338).fillCircle(bx + 9, by - 5, 2.5);
      const wing = s.paused || reducedMotion ? 0 : Math.sin(s.time * 12) * 5;
      g.fillStyle(0x2e91bd).fillEllipse(bx - 7, by + 6 + wing, 18, 10);
      this.title
        .setPosition(w / 2, 22)
        .setText(`${s.storm ? labels.storm : labels.gate} · ${s.round}`);
      this.clue.setVisible(s.quiz);
      this.answer.setVisible(s.quiz);
      if (s.quiz) {
        const boxWidth = Math.min(w - 32, 480);
        g.fillStyle(0x081526, 0.96).fillRoundedRect(
          (w - boxWidth) / 2,
          h * 0.3,
          boxWidth,
          h * 0.36,
          16,
        );
        g.lineStyle(1, 0x90e8ee, 0.65).strokeRoundedRect(
          (w - boxWidth) / 2,
          h * 0.3,
          boxWidth,
          h * 0.36,
          16,
        );
        this.clue
          .setWordWrapWidth(boxWidth - 28)
          .setPosition(w / 2, h * 0.4)
          .setText(
            s.options.direction === "audio"
              ? labels.listen
              : s.rocks[0].card.prompt,
          );
        this.answer
          .setWordWrapWidth(boxWidth - 28)
          .setPosition(w / 2, h * 0.54)
          .setText(mask(s.rocks[0]));
      }
      if (time - this.lastFrame > 70) {
        this.lastFrame = time;
        onFrame(s);
      }
    }
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: parent.clientWidth,
    height: parent.clientHeight,
    backgroundColor: "#0b1830",
    scene: FlightScene,
    input: { keyboard: false },
    audio: { noAudio: true },
    scale: { mode: Phaser.Scale.NONE },
  });
  const resize = new ResizeObserver(() => {
    if (
      game.isBooted &&
      game.canvas &&
      parent.clientWidth &&
      parent.clientHeight
    )
      game.scale.resize(parent.clientWidth, parent.clientHeight);
  });
  resize.observe(parent);
  return () => {
    resize.disconnect();
    game.destroy(true);
  };
}
