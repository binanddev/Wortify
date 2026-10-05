import { useEffect, useRef } from "react";
import { playAmbientNote } from "./soundscape-engine";
import { ambientTrack, ambientStep } from "./soundscape-presets";
export default function Soundscape({
  interactions,
  ambient,
  track = "morning",
  volume = 0.25,
}) {
  const preset = useRef(ambientTrack(track));
  preset.current = ambientTrack(track);
  const state = useRef(null),
    level = useRef(volume);
  level.current = volume;
  useEffect(() => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx || (!interactions && !ambient)) return;
    const ctx = new Ctx(),
      master = ctx.createGain(),
      background = ctx.createGain();
    master.gain.value = Math.max(0, Math.min(1, level.current));
    master.connect(ctx.destination);
    background.connect(master);
    const active = new Set();
    let disposed = false,
      unlocked = false,
      nextNote = 0,
      noteIndex = 0;
    const occupied = () =>
      document.hidden ||
      window.speechSynthesis?.speaking ||
      [...document.querySelectorAll("audio,video")].some(
        (media) => !media.paused && !media.ended,
      );
    const pulse = () => {
      if (disposed) return;
      const busy = occupied();
      background.gain.setTargetAtTime(busy ? 0 : 1, ctx.currentTime, 0.08);
      if (
        !ambient ||
        !unlocked ||
        busy ||
        ctx.state !== "running" ||
        ctx.currentTime < nextNote
      )
        return;
      const note = ambientStep(preset.current, noteIndex++);
      playAmbientNote(ctx, background, note.frequency, active, note);
      nextNote = ctx.currentTime + note.interval;
    };
    const activate = (event) => {
      if (
        event.type === "keydown" &&
        (event.repeat || !["Enter", " "].includes(event.key))
      )
        return;
      if (document.hidden) return;
      ctx
        .resume()
        .then(() => {
          if (!disposed) {
            unlocked = true;
            pulse();
          }
        })
        .catch(() => {});
      if (
        interactions &&
        event.target instanceof Element &&
        event.target.closest("button,a,select,summary") &&
        !occupied()
      ) {
        const osc = ctx.createOscillator(),
          gain = ctx.createGain(),
          now = ctx.currentTime;
        osc.frequency.value = 760;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.04, now + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
        osc.connect(gain);
        gain.connect(master);
        active.add(osc);
        osc.onended = () => {
          active.delete(osc);
          osc.disconnect();
          gain.disconnect();
        };
        osc.start(now);
        osc.stop(now + 0.08);
      }
    };
    const visibility = () => {
      if (document.hidden) ctx.suspend().catch(() => {});
      else if (unlocked)
        ctx
          .resume()
          .then(pulse)
          .catch(() => {});
    };
    document.addEventListener("pointerdown", activate);
    document.addEventListener("keydown", activate);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("play", pulse, true);
    const timer = setInterval(pulse, 100);
    state.current = {
      ctx,
      master,
      reset: () => {
        active.forEach((node) => {
          try {
            node.stop();
          } catch {}
        });
        noteIndex = 0;
        nextNote = 0;
      },
    };
    ctx
      .resume()
      .then(() => {
        if (!disposed && ctx.state === "running") {
          unlocked = true;
          pulse();
        }
      })
      .catch(() => {});
    return () => {
      disposed = true;
      clearInterval(timer);
      document.removeEventListener("pointerdown", activate);
      document.removeEventListener("keydown", activate);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("play", pulse, true);
      active.forEach((node) => {
        try {
          node.stop();
        } catch {}
      });
      state.current = null;
      ctx.close().catch(() => {});
    };
  }, [interactions, ambient]);
  useEffect(() => {
    state.current?.reset();
  }, [track]);
  useEffect(() => {
    const audio = state.current;
    if (audio)
      audio.master.gain.setTargetAtTime(
        Math.max(0, Math.min(1, volume)),
        audio.ctx.currentTime,
        0.05,
      );
  }, [volume]);
  return null;
}
