import { useEffect, useRef } from "react";
import { ambientTrack } from "./ambient-recordings";
export default function Soundscape({
  interactions,
  ambient,
  track = "morning",
  volume = 0.25,
}) {
  const player = useRef(null),
    level = useRef(volume);
  level.current = volume;
  useEffect(() => {
    if (player.current)
      player.current.volume = Math.max(0, Math.min(1, volume));
  }, [volume]);
  useEffect(() => {
    if (!ambient) return;
    const audio = new Audio(ambientTrack(track).src);
    audio.loop = true;
    audio.preload = "none";
    audio.volume = Math.max(0, Math.min(1, level.current));
    player.current = audio;
    let unlocked = Boolean(navigator.userActivation?.hasBeenActive),
      disposed = false,
      pending = false;
    const busy = () =>
      document.hidden ||
      window.speechSynthesis?.speaking ||
      [...document.querySelectorAll("audio,video")].some(
        (el) => !el.paused && !el.ended,
      );
    const update = () => {
      if (disposed) return;
      if (busy()) {
        audio.pause();
        return;
      }
      if (unlocked && audio.paused && !pending) {
        pending = true;
        audio
          .play()
          .catch(() => {
            unlocked = false;
          })
          .finally(() => {
            pending = false;
            if (disposed || busy()) audio.pause();
          });
      }
    };
    const unlock = (event) => {
      if (
        event.type === "keydown" &&
        (event.repeat || !["Enter", " "].includes(event.key))
      )
        return;
      unlocked = true;
      update();
    };
    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);
    document.addEventListener("visibilitychange", update);
    document.addEventListener("play", update, true);
    const timer = setInterval(update, 300);
    update();
    return () => {
      disposed = true;
      clearInterval(timer);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      player.current = null;
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
      document.removeEventListener("visibilitychange", update);
      document.removeEventListener("play", update, true);
    };
  }, [ambient, track]);
  useEffect(() => {
    if (!interactions) return;
    let ctx;
    const click = (event) => {
      if (document.hidden || !event.target.closest?.("button,a,summary"))
        return;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      ctx ||= new Ctx();
      ctx.resume().catch(() => {});
      const osc = ctx.createOscillator(),
        gain = ctx.createGain(),
        now = ctx.currentTime;
      osc.frequency.value = 760;
      gain.gain.setValueAtTime(Math.max(0.0001, 0.025 * level.current), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
      osc.start();
      osc.stop(now + 0.07);
    };
    document.addEventListener("pointerdown", click);
    return () => {
      document.removeEventListener("pointerdown", click);
      ctx?.close().catch(() => {});
    };
  }, [interactions]);
  return null;
}
