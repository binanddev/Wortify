import { useCallback, useEffect, useRef, useState } from "react";

// Only the question that owns the current utterance may stop it.
let currentUtterance = null;
export function useQuestionSpeech({text, voice, enabled, autoplay}) {
  const own = useRef(null), played = useRef(false);
  const [error, setError] = useState("");
  const stop = useCallback(() => {
    if (own.current && currentUtterance === own.current) {
      currentUtterance = null;
      window.speechSynthesis?.cancel();
    }
    own.current = null;
  }, []);
  const play = useCallback(() => {
    if (!enabled || document.hidden) return;
    played.current = true;
    setError("");
    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") {
      setError("This browser does not support speech synthesis.");
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = voice;
      utterance.rate = 0.9;
      own.current = currentUtterance = utterance;
      const finish = () => {
        if (currentUtterance === utterance) currentUtterance = null;
        if (own.current === utterance) own.current = null;
      };
      utterance.onend = finish;
      utterance.onerror = event => {
        finish();
        if (!["canceled", "interrupted"].includes(event.error)) setError("Could not play pronunciation. Check the voice selected in settings.");
      };
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);
    } catch {
      stop();
      setError("Could not play pronunciation. Check the voice selected in settings.");
    }
  }, [enabled, text, voice, stop]);
  useEffect(() => { played.current = false; setError(""); }, [text, voice]);
  useEffect(() => {
    // Defer until after effect setup so React StrictMode cleanup cannot swallow autoplay.
    const timer = enabled && autoplay && !played.current ? setTimeout(play, 0) : null;
    if (!enabled) stop();
    const hidden = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", hidden);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", hidden); stop(); };
  }, [enabled, autoplay, play, stop]);
  return {play, stop, error, onFocus:() => {if (!played.current) play();}};
}
