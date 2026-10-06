export function luminance(rgb) {
  return rgb
    .slice(0, 3)
    .map((v) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    })
    .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
}
export function readableInk(background) {
  const light = 1.05 / (luminance(background) + 0.05),
    dark = (luminance(background) + 0.05) / 0.05;
  return light > dark ? "#ffffff" : "#000000";
}
export function installAutoContrast() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const selector =
    "button,a,input,textarea,select,label,p,h1,h2,h3,h4,span,small,strong,summary,svg.app-icon";
  let frame;
  const paint = () => {
    frame = null;
    if (document.documentElement.dataset.interface === "glass") {
      document
        .querySelectorAll("[data-auto-ink]")
        .forEach((el) => el.removeAttribute("data-auto-ink"));
      return;
    }
    const auto = document.documentElement.dataset.textAuto === "true";
    if (!auto)
      document
        .querySelectorAll("[data-auto-ink]")
        .forEach((el) => el.removeAttribute("data-auto-ink"));
    const cache = new Map();
    const background = (el) => {
      if (!el || el === document.documentElement) return [255, 255, 255];
      if (cache.has(el)) return cache.get(el);
      const parent = background(el.parentElement);
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = getComputedStyle(el).backgroundColor;
      ctx.fillRect(0, 0, 1, 1);
      const rgba = ctx.getImageData(0, 0, 1, 1).data,
        alpha = rgba[3] / 255;
      const result = parent.map((v, i) => rgba[i] * alpha + v * (1 - alpha));
      cache.set(el, result);
      return result;
    };
    document.querySelectorAll(selector).forEach((el) => {
      if (!el.getClientRects().length) return;
      if (
        !auto &&
        !el.closest(
          "button:hover,a:hover,[role=button]:hover,button:focus-visible,a:focus-visible",
        )
      )
        return;
      el.style.setProperty("--auto-ink", readableInk(background(el)));
      el.setAttribute("data-auto-ink", "");
    });
  };
  const schedule = () => {
    if (!frame) frame = setTimeout(paint, 16);
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  const rootObserver = new MutationObserver(schedule);
  rootObserver.observe(document.documentElement, { attributes: true });
  const events = [
    "pointerover",
    "pointerout",
    "focusin",
    "focusout",
    "change",
    "transitionend",
  ];
  events.forEach((event) => document.addEventListener(event, schedule, true));
  schedule();
  return () => {
    observer.disconnect();
    rootObserver.disconnect();
    clearTimeout(frame);
    events.forEach((event) =>
      document.removeEventListener(event, schedule, true),
    );
  };
}
