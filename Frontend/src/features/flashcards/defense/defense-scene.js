import Phaser from "phaser";
import { DIFFICULTIES, mask } from "./defense-engine.js";
const colors = {
  normal: 0x70e1ff,
  freeze: 0x8bdcff,
  nuke: 0xffbd68,
  health: 0x72f3bb,
  boss: 0xf59ac4,
};
const hex = (n) => `#${n.toString(16).padStart(6, "0")}`;
export function launchDefense(
  parent,
  engine,
  { audio, labels, onFrame, onEnd, onReady, onFocus, reducedMotion = false },
) {
  class DefenseScene extends Phaser.Scene {
    constructor() {
      super("defense");
      this.rocks = new Map();
      this.stars = [];
      this.lastFrame = 0;
    }
    create() {
      this.background = this.add.graphics();
      this.starlight = this.add.graphics();
      this.base = this.add.graphics();
      this.laser = this.add.graphics().setDepth(20);
      this.effects = this.add.container().setDepth(30);
      const spark = this.make.graphics({ x: 0, y: 0, add: false });
      spark.fillStyle(0xffffff).fillCircle(4, 4, 4);
      spark.generateTexture("spark", 8, 8);
      spark.destroy();
      this.particles = this.add
        .particles(0, 0, "spark", {
          emitting: false,
          lifespan: 500,
          speed: { min: 45, max: 210 },
          scale: { start: 0.7, end: 0 },
          alpha: { start: 1, end: 0 },
          blendMode: "ADD",
          maxParticles: 220,
        })
        .setDepth(25);
      for (let i = 0; i < 100; i++)
        this.stars.push({
          x: Math.random(),
          y: Math.random(),
          r: Math.random() * 1.3 + 0.3,
          speed: Math.random() * 0.012 + 0.003,
        });
      this.scale.on("resize", () => this.backdrop());
      this.backdrop();
      this.input.on("pointerdown", () => onFocus());
      onReady?.(this.game);
      onFrame(engine.state);
    }
    backdrop() {
      const { width: w, height: h } = this.scale;
      const g = this.background;
      g.clear();
      g.fillGradientStyle(0x070d24, 0x11112c, 0x0c2338, 0x071525, 1).fillRect(
        0,
        0,
        w,
        h,
      );
      // Distant orbital body, atmospheric rings and layered mountain silhouettes.
      const px = w * 0.77,
        py = h * 0.12,
        pr = Math.min(w * 0.14, 110);
      for (let r = pr + 55; r > pr; r -= 5)
        g.fillStyle(0x1f4162, 0.025).fillCircle(px, py, r);
      g.fillGradientStyle(0x31405f, 0x4a4762, 0x15283f, 0x19233c, 1).fillCircle(
        px,
        py,
        pr,
      );
      g.lineStyle(1, 0x8196bb, 0.12);
      for (let i = 0; i < 5; i++)
        g.strokeEllipse(px - 15, py + 10, pr * 3 + i * 8, pr * 0.65 + i * 4);
      for (let layer = 0; layer < 3; layer++) {
        const points = [{ x: 0, y: h }];
        for (let x = 0; x <= w + 50; x += 50)
          points.push({
            x,
            y: h - 55 - layer * 20 - Math.abs(Math.sin(x * 0.012 + layer) * 35),
          });
        points.push({ x: w, y: h });
        g.fillStyle([0x10263b, 0x102035, 0x142944][layer], 0.8).fillPoints(
          points,
          true,
        );
      }
      g.lineStyle(1, 0x54c8f4, 0.12);
      for (let x = -w; x < w * 2; x += 60) {
        g.lineBetween(w / 2, h - 100, x, h);
      }
      for (let y = h - 95; y < h; y += 20) g.lineBetween(0, y, w, y);
      this.paintBase();
    }
    paintBase() {
      const { width: w, height: h } = this.scale,
        x = w / 2,
        y = h - 35,
        g = this.base;
      g.clear();
      g.lineStyle(
        2,
        engine.state.frozen ? 0x9defff : 0x347fa0,
        0.5,
      ).lineBetween(0, h - 24, w, h - 24);
      g.fillStyle(0x13263c).fillRoundedRect(x - 85, y - 5, 170, 35, 7);
      g.lineStyle(1, 0x4898bc, 0.8).strokeRoundedRect(
        x - 85,
        y - 5,
        170,
        35,
        7,
      );
      g.fillStyle(0x27445b).fillTriangle(
        x - 52,
        y + 3,
        x,
        y - 38,
        x + 52,
        y + 3,
      );
      g.fillStyle(0x17364a).fillCircle(x, y - 8, 25);
      g.lineStyle(2, 0x83dceb, 0.8).strokeCircle(x, y - 8, 25);
      g.fillStyle(0x426579).fillRoundedRect(x - 9, y - 62, 18, 49, 3);
      g.fillStyle(0x80edff).fillRect(x - 5, y - 62, 10, 10);
      for (let i = -2; i <= 2; i++)
        g.fillStyle(i + 3 <= engine.state.hp ? 0x77ecc8 : 0x243848).fillRect(
          x + i * 23 - 6,
          y + 11,
          12,
          4,
        );
      g.lineStyle(1, 0x65dbef, 0.15).strokeEllipse(x, y + 5, 180, 40);
    }
    position(rock) {
      const { width: w, height: h } = this.scale,
        cap = DIFFICULTIES[engine.state.options.difficulty].cap;
      const columns = w < 650 ? Math.min(2, cap) : cap;
      const width = Math.min(cap === 1 ? 340 : 270, w / columns - 24);
      return {
        x: (((rock.lane % columns) + 0.5) * w) / columns,
        y:
          65 +
          (rock.lane >= columns ? 90 : 0) +
          (h - 180 - (rock.lane >= columns ? 90 : 0)) * rock.y,
        width,
      };
    }
    addRock(rock) {
      const p = this.position(rock),
        color = colors[rock.kind],
        container = this.add.container(p.x, p.y).setDepth(10);
      const body = this.add.graphics();
      container.add(body);
      const font = "system-ui, -apple-system, Segoe UI, sans-serif";
      const badge = this.add
        .text(0, -42, rock.kind === "normal" ? "" : labels[rock.kind], {
          fontFamily: font,
          fontSize: 10,
          fontStyle: "bold",
          color: hex(color),
          letterSpacing: 1,
        })
        .setOrigin(0.5);
      const clue = this.add
        .text(
          0,
          -20,
          engine.state.options.direction === "audio"
            ? labels.listen
            : rock.card.prompt,
          {
            fontFamily: font,
            fontSize: 16,
            color: "#eef7ff",
            align: "center",
            wordWrap: { width: p.width - 24 },
            maxLines: 3,
          },
        )
        .setOrigin(0.5, 0);
      const slots = this.add
        .text(0, 20, "", {
          fontFamily: font,
          fontSize: 17,
          fontStyle: "bold",
          color: "#81e4ff",
          align: "center",
          wordWrap: { width: p.width - 22 },
          maxLines: 3,
        })
        .setOrigin(0.5, 0);
      container.add([badge, clue, slots]);
      container.setSize(p.width, 124).setInteractive();
      container.on("pointerdown", () => {
        if (engine.state.paused || engine.state.ended) return;
        engine.unlock();
        engine.state.target = rock.id;
        audio.speak(rock.card, true);
        onFrame(engine.state);
        onFocus();
      });
      this.rocks.set(rock.id, { container, body, badge, clue, slots });
    }
    drawRock(rock) {
      if (!this.rocks.has(rock.id)) this.addRock(rock);
      const v = this.rocks.get(rock.id),
        p = this.position(rock),
        color = colors[rock.kind],
        locked = engine.state.target === rock.id;
      v.container.setPosition(p.x, p.y);
      v.clue.setWordWrapWidth(p.width - 24);
      v.slots.setWordWrapWidth(p.width - 24);
      const hintText = mask(rock);
      if (v.slots.text !== hintText) v.slots.setText(hintText);
      v.slots.setY(-13 + v.clue.height);
      const height = Math.max(104, 40 + v.clue.height + v.slots.height);
      v.container.setSize(p.width, height);
      const g = v.body;
      g.clear();
      // Plasma tail + a bevelled, shielded meteor housing.
      g.fillStyle(color, 0.045).fillTriangle(
        -p.width * 0.34,
        -40,
        0,
        -95,
        p.width * 0.34,
        -40,
      );
      g.lineStyle(1, color, 0.15).lineBetween(
        -p.width * 0.3,
        -40,
        -p.width * 0.15,
        -74,
      );
      const points = [
        { x: -p.width / 2 + 12, y: -52 },
        { x: p.width / 2 - 12, y: -52 },
        { x: p.width / 2, y: -40 },
        { x: p.width / 2, y: height - 64 },
        { x: p.width / 2 - 12, y: height - 52 },
        { x: -p.width / 2 + 12, y: height - 52 },
        { x: -p.width / 2, y: height - 64 },
        { x: -p.width / 2, y: -40 },
      ];
      g.fillStyle(0x0b1d33, 0.96).fillPoints(points, true);
      g.lineStyle(locked ? 2 : 1, color, locked ? 1 : 0.55).strokePoints(
        points,
        true,
      );
      g.lineStyle(3, color, 0.8).lineBetween(
        -p.width / 2 + 14,
        -52,
        -p.width / 2 + 46,
        -52,
      );
      if (rock.kind === "boss")
        for (let i = 0; i < 2; i++)
          g.fillStyle(i < rock.armor ? color : 0x30405a).fillRoundedRect(
            p.width / 2 - 42 + i * 16,
            -45,
            10,
            4,
            2,
          );
      if (locked) {
        g.lineStyle(2, 0xffffff, 0.65);
        for (const side of [-1, 1]) {
          g.lineBetween(
            side * (p.width / 2 + 6),
            -30,
            side * (p.width / 2 + 6),
            -43,
          );
          g.lineBetween(
            side * (p.width / 2 + 6),
            -43,
            side * (p.width / 2 - 4),
            -43,
          );
        }
      }
      if (rock.y > 0.88)
        g.lineStyle(2, 0xff8396, 0.8).lineBetween(
          -p.width / 2 + 12,
          height - 52,
          p.width / 2 - 12,
          height - 52,
        );
    }
    pulse(rock, kind) {
      if (!rock) return;
      const p = this.position(rock),
        color = colors[rock.kind];
      if (kind === "hit" || kind === "lock") {
        this.laser
          .clear()
          .lineStyle(6, 0x64e6ff, 0.12)
          .lineBetween(this.scale.width / 2, this.scale.height - 97, p.x, p.y);
        this.laser
          .lineStyle(1.5, 0xb4faff, 0.85)
          .lineBetween(this.scale.width / 2, this.scale.height - 97, p.x, p.y);
        this.laser.alpha = 1;
        this.tweens.add({ targets: this.laser, alpha: 0, duration: 140 });
        this.particles.setParticleTint(color);
        this.particles.explode(5, p.x, p.y + 35);
        return;
      }
      if (["destroy", "blast", "impact", "armor"].includes(kind)) {
        const ring = this.add
          .circle(p.x, p.y, 16)
          .setStrokeStyle(3, color)
          .setDepth(26);
        this.tweens.add({
          targets: ring,
          scale: kind === "armor" ? 2 : 5,
          alpha: 0,
          duration: 420,
          onComplete: () => ring.destroy(),
        });
        this.particles.setParticleTint(color);
        this.particles.explode(reducedMotion ? 8 : 32, p.x, p.y);
        if (kind === "destroy") {
          const missile = this.add
            .circle(this.scale.width / 2, this.scale.height - 97, 4, 0xffd18a)
            .setDepth(24);
          this.tweens.add({
            targets: missile,
            x: p.x,
            y: p.y,
            duration: 120,
            onComplete: () => missile.destroy(),
          });
        }
      }
    }
    update(time, delta) {
      if (!this.background) return;
      engine.tick(delta / 1000);
      const state = engine.state;
      const { width: w, height: h } = this.scale,
        g = this.starlight;
      g.clear();
      for (const star of this.stars) {
        if (!state.paused && !reducedMotion)
          star.y = (star.y + (star.speed * delta) / 1000) % 1;
        g.fillStyle(0xbddaf7, 0.2 + star.r * 0.3).fillCircle(
          star.x * w,
          star.y * h,
          star.r,
        );
      }
      for (const e of engine.drain()) {
        if (e.type === "end") {
          audio.stop();
          onEnd(state);
        }
        if (e.type === "spawn" && state.options.direction === "audio")
          audio.speak(e.rock.card);
        if (e.type === "hint" && e.level === 2) audio.speak(e.rock.card);
        this.pulse(e.rock, e.type);
        if (e.type !== "spawn" && e.type !== "hint") audio.tone(e.type);
        if (["wrong", "impact"].includes(e.type) && !reducedMotion)
          this.cameras.main.flash(100, 140, 25, 55, false);
        if (e.type === "nuke" && !reducedMotion)
          this.cameras.main.flash(180, 180, 115, 40, false);
      }
      for (const rock of state.rocks) this.drawRock(rock);
      for (const [id, view] of this.rocks)
        if (!state.rocks.some((r) => r.id === id)) {
          view.container.destroy();
          this.rocks.delete(id);
        }
      this.paintBase();
      if (time - this.lastFrame > 100) {
        this.lastFrame = time;
        onFrame(state);
      }
    }
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: parent.clientWidth,
    height: parent.clientHeight,
    backgroundColor: "#081127",
    transparent: false,
    antialias: true,
    scene: DefenseScene,
    input: { keyboard: false },
    audio: { noAudio: true },
    scale: { mode: Phaser.Scale.NONE },
    fps: { target: 60, forceSetTimeOut: false },
    render: { roundPixels: true },
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
