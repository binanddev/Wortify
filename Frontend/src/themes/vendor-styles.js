// Insert vendor rules before the shared design system, just as in index.css.
// Vendor CSS contains plain declarations; load it without compiling Tailwind again.
const loaders = {
  xp: () => import('../vendor/windows-libraries.css?raw'),
  retro: () => import('./retro/vendor-css.js'),
  rpg: () => import('../vendor/terminal-scoped.css?raw'),
};
const pending = new Map();
export function loadThemeVendor(theme) {
  if (!loaders[theme] || typeof document === 'undefined') return Promise.resolve();
  if (!pending.has(theme)) {
    pending.set(theme, loaders[theme]().then(({default:css}) => {
      const style = document.createElement('style');
      style.dataset.themeVendor = theme;
      style.textContent = css;
      document.head.insertBefore(style, document.head.firstChild);
      window.dispatchEvent(new Event('theme-styles-loaded'));
    }).catch(error => {pending.delete(theme); throw error;}));
  }
  return pending.get(theme);
}
