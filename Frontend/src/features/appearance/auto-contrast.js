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
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', {willReadFrequently:true});
  if (!ctx) return () => {};
  const selector = 'button,a,input,textarea,select,label,p,h1,h2,h3,h4,span,small,strong,summary,svg.app-icon';
  const controls = 'button,a,[role=button],input,textarea,select';
  const painted = new Map();
  const dirty = new Set();
  let frame = null, full = true, previousControl = null;
  const clear = element => {
    element.removeAttribute('data-auto-ink');
    element.style.removeProperty('--auto-ink');
    painted.delete(element);
  };
  const paint = () => {
    frame = null;
    const root = document.documentElement;
    const auto = root.dataset.textAuto === 'true';
    if (root.dataset.interface === 'glass') {
      for (const element of painted.keys()) clear(element);
      dirty.clear(); full = false;
      return;
    }
    const candidates = new Set();
    const collect = element => {
      if (!element?.isConnected) return;
      if (element.matches(selector)) candidates.add(element);
      element.querySelectorAll(selector).forEach(child => candidates.add(child));
    };
    if (full) collect(document.body);
    else for (const element of dirty) collect(element);
    full = false; dirty.clear();
    for (const element of painted.keys()) if (!element.isConnected) painted.delete(element);
    const backgrounds = new Map();
    const background = element => {
      if (!element || element === root) return [255,255,255];
      if (backgrounds.has(element)) return backgrounds.get(element);
      const parent = background(element.parentElement);
      ctx.clearRect(0,0,1,1);
      ctx.fillStyle = getComputedStyle(element).backgroundColor;
      ctx.fillRect(0,0,1,1);
      const rgba = ctx.getImageData(0,0,1,1).data;
      const value = parent.map((channel,i) => rgba[i]*(rgba[3]/255)+channel*(1-rgba[3]/255));
      backgrounds.set(element,value);
      return value;
    };
    // Read geometry/styles first, then write once; do not alternate layout reads and writes.
    const updates = [];
    for (const element of candidates) {
      const active = auto || element.closest('button:hover,a:hover,[role=button]:hover,button:focus-visible,a:focus-visible');
      if (!active) {
        if (painted.has(element)) updates.push([element,null]);
        continue;
      }
      if (element.getClientRects().length) updates.push([element,readableInk(background(element))]);
    }
    for (const [element,ink] of updates) {
      if (ink === null) clear(element);
      else if (painted.get(element) !== ink || !element.hasAttribute('data-auto-ink')) {
        element.style.setProperty('--auto-ink',ink);
        element.setAttribute('data-auto-ink','');
        painted.set(element,ink);
      }
    }
  };
  const schedule = element => {
    if (element?.nodeType === 1) dirty.add(element);
    if (frame === null) frame = requestAnimationFrame(paint);
  };
  const observer = new MutationObserver(records => {
    for (const record of records) {
      // Replacing text alone cannot change its background.
      for (const node of record.addedNodes) if (node.nodeType === 1) schedule(node);
      if (record.removedNodes.length) schedule();
    }
  });
  observer.observe(document.body,{childList:true,subtree:true});
  const refresh = () => {full = true; schedule();};
  window.addEventListener('theme-styles-loaded', refresh);
  const rootObserver = new MutationObserver(refresh);
  rootObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-interface','data-text-auto','data-background','style']});
  const changed = event => {
    const element = event.target?.closest?.(controls);
    if (event.type === 'pointerover' || event.type === 'pointerout') {
      const related = event.relatedTarget?.closest?.(controls);
      if (element === related) return;
      if (previousControl) schedule(previousControl);
      previousControl = event.type === 'pointerout' ? related : element;
      if (related) schedule(related);
    }
    schedule(element || event.target);
  };
  const events = ['pointerover','pointerout','focusin','focusout','change','transitionend'];
  events.forEach(event => document.addEventListener(event,changed,true));
  schedule();
  return () => {
    observer.disconnect(); rootObserver.disconnect();
    window.removeEventListener('theme-styles-loaded', refresh);
    if (frame !== null) cancelAnimationFrame(frame);
    events.forEach(event => document.removeEventListener(event,changed,true));
    for (const element of painted.keys()) clear(element);
  };
}
