import { useEffect, useRef } from "react";
// All sounds are synthesized and buffered locally; no audio network requests.
export default function Soundscape({ interactions, ambient, volume = 0.25 }) {
  const state = useRef(null);
  useEffect(() => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx || (!interactions && !ambient)) return;
    const ctx = new Ctx(),
      master = ctx.createGain();
    master.gain.value = Math.max(0, Math.min(1, volume));
    master.connect(ctx.destination);
    const buffer = ctx.createBuffer(
        1,
        Math.floor(ctx.sampleRate * 0.07),
        ctx.sampleRate,
      ),
      data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate;
      data[i] = Math.sin(2 * Math.PI * 760 * t) * Math.exp(-t * 70) * 0.12;
    }
    const sources = [];
    if (ambient) {
      [130.81, 164.81, 196].forEach((f, i) => {
        const osc = ctx.createOscillator(),
          gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = f;
        gain.gain.value = 0.016;
        osc.connect(gain);
        gain.connect(master);
        osc.start();
        sources.push(osc);
      });
    }
    const activate = (event) => {
      ctx.resume().catch(() => {});
      if (interactions && event.target.closest("button,a,select,summary")) {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(master);
        source.start();
      }
    };
    const visibility = () => {
      if (document.hidden) ctx.suspend();
    };
    document.addEventListener("pointerdown", activate);
    document.addEventListener("keydown", activate);
    document.addEventListener("visibilitychange", visibility);
    ctx.resume().catch(() => {});
    state.current = ctx;
    return () => {
      document.removeEventListener("pointerdown", activate);
      document.removeEventListener("keydown", activate);
      document.removeEventListener("visibilitychange", visibility);
      sources.forEach((o) => o.stop());
      ctx.close().catch(() => {});
    };
  }, [interactions, ambient, volume]);
  return null;
}
