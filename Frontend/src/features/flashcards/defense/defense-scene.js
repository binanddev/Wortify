import { paintGalaxy } from "./galaxy.js";
import Phaser from "phaser";
import { DIFFICULTIES, letterSlots } from "./defense-engine.js";
const colors = {
  normal: 0x70e1ff,
  pulse: 0x9e94ff,
  beacon: 0xffdb80,
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
      const texture = this.textures.createCanvas("deep-space", 1280, 720);
      paintGalaxy(texture.context, 1280, 720);
      texture.refresh();
      this.sky = this.add.image(0, 0, "deep-space").setOrigin(0);
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
      this.sky.setDisplaySize(w, h);
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
    aim(point) {
      const x = this.scale.width / 2,
        y = this.scale.height - 43;
      const angle = point
        ? Math.atan2(point.y - y, point.x - x)
        : (this.aimAngle ?? -Math.PI / 2);
      this.aimAngle = angle;
      return { x: x + 54 * Math.cos(angle), y: y + 54 * Math.sin(angle) };
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
      const target = engine.state.rocks.find(
        (r) => r.id === engine.state.target,
      );
      const muzzle = this.aim(target && this.position(target));
      g.lineStyle(17, 0x426579).lineBetween(x, y - 8, muzzle.x, muzzle.y);
      g.lineStyle(4, 0x80edff).lineBetween(x, y - 8, muzzle.x, muzzle.y);
      g.fillStyle(0xa4f0ff).fillCircle(muzzle.x, muzzle.y, 5);
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
      let y = 65 + (h - 180) * rock.y;
      if (columns < cap) {
        const siblings = engine.state.rocks
          .filter((r) => r.lane % columns === rock.lane % columns)
          .sort((a, b) => b.y - a.y || a.id - b.id);
        if (siblings.length > 1) {
          const gap = Math.min(175, Math.max(100, h - 200));
          const lower = Math.max(
            65 + gap,
            Math.min(h - 110, 65 + (h - 180) * siblings[0].y),
          );
          y =
            siblings[0].id === rock.id
              ? lower
              : Math.max(65, Math.min(y, lower - gap));
        }
      }
      return { x: (((rock.lane % columns) + 0.5) * w) / columns, y, width };
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
      const category = rock.card.partOfSpeech
        ? this.add
            .text(0, -26, rock.card.partOfSpeech, {
              fontFamily: font,
              fontSize: 12,
              color: "#ffd793",
              align: "center",
              wordWrap: { width: p.width - 24 },
            })
            .setOrigin(0.5, 0)
        : null;
      const clue = this.add
        .text(
          0,
          category ? category.y + category.height + 3 : -20,
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
      const slots = letterSlots(rock).map(() =>
        this.add
          .text(0, 0, "", { fontFamily: font, fontSize: 17, fontStyle: "bold" })
          .setOrigin(0.5, 0),
      );
      container.add([badge, ...(category ? [category] : []), clue, ...slots]);
      container.setSize(p.width, 124).setInteractive();
      container.on("pointerdown", () => {
        if (engine.state.paused || engine.state.ended) return;
        engine.select(rock.id);
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
      v.container.setAlpha(engine.state.target && !locked ? 0.55 : 1);
      v.badge.setText(
        `${rock.lane + 1} · ${rock.kind !== "normal" ? (locked ? "◆ " : "") + labels[rock.kind] : locked ? labels.target : ""}`,
      );
      const layout = [p.width, rock.typed, rock.hints].join("|");
      if (v.layout !== layout) {
        v.layout = layout;
        v.clue.setWordWrapWidth(p.width - 24);
        const columns = Math.max(1, Math.floor((p.width - 24) / 20));
        const colors = {
          typed: "#b4ffe0",
          hint: "#ffad64",
          empty: "#81e4ff",
          space: "#81e4ff",
        };
        letterSlots(rock).forEach(({ text, state }, i) => {
          const row = Math.floor(i / columns);
          const count = Math.min(columns, v.slots.length - row * columns);
          v.slots[i]
            .setText(text)
            .setColor(colors[state])
            .setPosition(
              ((i % columns) - (count - 1) / 2) * 20,
              v.clue.y + 7 + v.clue.height + row * 22,
            );
        });
        v.height = Math.max(
          104,
          60 +
            v.clue.y +
            v.clue.height +
            Math.ceil(v.slots.length / columns) * 22,
        );
      }
      const height = v.height;
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
    pulse(rock, kind, letterValue, index) {
      if (!rock) return;
      const p = this.position(rock),
        color = colors[rock.kind];
      if (["pulse", "health", "freeze", "beacon", "nuke"].includes(kind)) {
        const name = this.add
          .text(p.x, Math.max(30, p.y - 35), labels[rock.kind], {
            fontFamily: "system-ui",
            fontSize: "17px",
            fontStyle: "bold",
            color: hex(color),
            stroke: "#091628",
            strokeThickness: 4,
          })
          .setOrigin(0.5)
          .setDepth(29);
        this.tweens.add({
          targets: name,
          y: name.y - (reducedMotion ? 0 : 24),
          alpha: 0,
          delay: 350,
          duration: 380,
          onComplete: () => name.destroy(),
        });
        if (!reducedMotion && (kind === "pulse" || kind === "nuke")) {
          const wave = this.add
            .circle(p.x, p.y, 15)
            .setStrokeStyle(2, color)
            .setDepth(24);
          this.tweens.add({
            targets: wave,
            scale: kind === "pulse" ? 22 : 12,
            alpha: 0,
            duration: 440,
            onComplete: () => wave.destroy(),
          });
        }
      }
      if (kind === "hit") {
        const origin = this.aim(p);
        this.laser
          .clear()
          .lineStyle(6, 0x64e6ff, 0.12)
          .lineBetween(origin.x, origin.y, p.x, p.y);
        this.laser
          .lineStyle(1.5, 0xb4faff, 0.85)
          .lineBetween(origin.x, origin.y, p.x, p.y);
        this.laser.alpha = 1;
        this.tweens.add({ targets: this.laser, alpha: 0, duration: 140 });
        if (kind === "hit" && !reducedMotion && rock.typed) {
          const shot = (index + 1) % 3;
          if (shot === 1) {
            const orb = this.add
              .circle(origin.x, origin.y, 6, 0xba83ff)
              .setStrokeStyle(3, 0xe9ceff)
              .setDepth(25);
            this.tweens.add({
              targets: orb,
              x: p.x,
              y: p.y,
              scale: 0.55,
              duration: 130,
              onComplete: () => orb.destroy(),
            });
          } else if (shot === 2) {
            for (const side of [-1, 1]) {
              const bolt = this.add
                .triangle(origin.x, origin.y, 0, 12, 3, 0, 6, 12, 0xffcb67)
                .setDepth(25);
              bolt.setRotation(
                Math.atan2(p.y - origin.y, p.x - origin.x) + Math.PI / 2,
              );
              this.tweens.add({
                targets: bolt,
                x: p.x + side * 4,
                y: p.y,
                duration: 100,
                onComplete: () => bolt.destroy(),
              });
            }
          }
          const letter = this.add
            .text(origin.x, origin.y, letterValue, {
              fontSize: "21px",
              color: "#b4ffe0",
            })
            .setOrigin(0.5)
            .setDepth(26);
          this.tweens.add({
            targets: letter,
            x: p.x,
            y: p.y,
            duration: 150,
            onComplete: () => letter.destroy(),
          });
        }
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
        if (
          !state.options.autoListen &&
          state.options.direction !== "audio" &&
          e.type === "hint" &&
          e.level === 2
        )
          audio.speak(e.rock.card);
        this.pulse(e.rock, e.type, e.letter, e.index);
        if (e.type !== "spawn" && e.type !== "hint") audio.tone(e.type);
        if (["wrong", "impact"].includes(e.type) && !reducedMotion)
          this.cameras.main.flash(100, 140, 25, 55, false);
        if (e.type === "nuke" && !reducedMotion)
          this.cameras.main.flash(180, 180, 115, 40, false);
      }
      if (
        !state.paused &&
        !state.ended &&
        (state.options.autoListen || state.options.direction === "audio")
      ) {
        audio.repeat(
          state.rocks.map((r) => r.card),
          state.rocks.find((r) => r.id === state.target)?.card,
        );
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
