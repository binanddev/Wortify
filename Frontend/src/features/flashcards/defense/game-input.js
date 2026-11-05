// Read ordinary keys in the user's keyboard layout. On Windows an active IME
// can report Process instead of the letter; use its physical code only for
// plain Latin targets. Native composition remains available for accented words.
export function gameTypingKey(event, answer) {
  if (
    event.ctrlKey ||
    event.altKey ||
    event.metaKey ||
    (event.key === " " && event.target?.closest?.("button"))
  )
    return null;
  if (answer && !/^[\x20-\x7e]+$/.test(answer)) return null;
  if (event.key === "Backspace") return "Backspace";
  if (
    answer &&
    (event.key === "Process" ||
      event.key === "Unidentified" ||
      event.keyCode === 229) &&
    /^Key[A-Z]$/.test(event.code)
  ) {
    const letter = event.code.slice(3);
    return Boolean(event.shiftKey) !==
      Boolean(event.getModifierState?.("CapsLock"))
      ? letter
      : letter.toLowerCase();
  }
  if (event.isComposing || (!answer && event.key === "Dead")) return null;
  return /^[\x20-\x7e]$/.test(event.key) ? event.key : null;
}
// Native text events preserve composition and mobile keyboard input.
export function bindGameInput(
  element,
  { active, accept, composing, current, replayTarget },
) {
  let inComposition = false,
    afterComposition = null;
  const input = () => {
    if (inComposition) return;
    if (afterComposition !== null && element.value === afterComposition) {
      afterComposition = null;
      return;
    }
    afterComposition = null;
    if (!active()) {
      element.value = "";
      return;
    }
    element.value = accept(element.value);
  };
  const start = () => {
    inComposition = true;
    composing(true);
  };
  const end = () => {
    inComposition = false;
    composing(false);
    input();
    afterComposition = element.value;
  };
  // Mobile keyboards may submit just the new letter even when the hidden
  // field's selection has drifted. Append to the active card's progress.
  const before = (event) => {
    if (
      !current ||
      !active() ||
      inComposition ||
      event.isComposing ||
      !event.cancelable
    )
      return;
    if (event.inputType !== "insertText" || !event.data) return;
    event.preventDefault();
    afterComposition = null;
    if (event.data === " " && replayTarget) replayTarget();
    else element.value = accept(current() + event.data);
  };
  element.addEventListener("beforeinput", before);
  element.addEventListener("input", input);
  element.addEventListener("compositionstart", start);
  element.addEventListener("compositionend", end);
  return () => {
    element.removeEventListener("beforeinput", before);
    element.removeEventListener("input", input);
    element.removeEventListener("compositionstart", start);
    element.removeEventListener("compositionend", end);
    composing(false);
  };
}
