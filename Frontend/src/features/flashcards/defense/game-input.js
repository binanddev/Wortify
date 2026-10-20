// Native text events preserve composition and mobile keyboard input.
export function bindGameInput(element, { active, accept, composing }) {
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
  element.addEventListener("input", input);
  element.addEventListener("compositionstart", start);
  element.addEventListener("compositionend", end);
  return () => {
    element.removeEventListener("input", input);
    element.removeEventListener("compositionstart", start);
    element.removeEventListener("compositionend", end);
    composing(false);
  };
}
