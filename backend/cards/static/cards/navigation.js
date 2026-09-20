'use strict';
(() => {
  const exercisePage = () => location.pathname === '/study/' || /\/match\/$/.test(location.pathname);
  function enhance(root = document) {
    if (!window.htmx || exercisePage()) return;
    root.querySelectorAll('a[href], form').forEach(el => {
      if (el.closest('[hx-boost="false"]') || el.hasAttribute('hx-boost')) return;
      const url = new URL(el.tagName === 'FORM' ? el.getAttribute('action') || location.href : el.getAttribute('href'), location.href);
      if (url.origin !== location.origin || url.hash || /\/accounts\/|\/study\/|\/match\/|\/export\/|\/admin\//.test(url.pathname)) return;
      const confirmation = el.getAttribute('onsubmit')?.match(/confirm\('([^']+)'\)/);
      if (confirmation) {
        el.setAttribute('hx-confirm', confirmation[1]);
        el.removeAttribute('onsubmit');
      }
      el.setAttribute('hx-boost', 'true');
      el.setAttribute('hx-target', '#main');
      el.setAttribute('hx-select', '#main');
      el.setAttribute('hx-swap', 'outerHTML swap:180ms settle:160ms show:none');
      el.setAttribute('hx-push-url', 'true');
      el.setAttribute('hx-sync', '#main:drop');
      if (el.tagName === 'FORM' && el.querySelector('button')) el.setAttribute('hx-disabled-elt', 'find button');
      htmx.process(el);
    });
  }
  const positions = new Map();
  let scroll = 0, keepScroll = false, searchFocus = false, selection = 0;
  document.addEventListener('htmx:beforeRequest', event => {
    const el = event.detail.elt;
    scroll = window.scrollY;
    positions.set(location.pathname + location.search, scroll);
    searchFocus = document.activeElement?.id === 'deck-search';
    selection = searchFocus ? document.activeElement.selectionStart : 0;
    keepScroll = el.tagName === 'FORM' || (el.tagName === 'A' && new URL(el.href).pathname === location.pathname);
    document.getElementById('navigation-error').hidden = true;
    document.getElementById('page-progress').hidden = false;
    document.getElementById('main')?.setAttribute('aria-busy', 'true');
  });
  document.addEventListener('htmx:beforeSwap', event => {
    if (event.detail.xhr.status < 200 || event.detail.xhr.status >= 400) return;
    const destination = new URL(event.detail.xhr.responseURL);
    if (destination.pathname.startsWith('/accounts/')) {
      event.detail.shouldSwap = false;
      location.assign(destination.href);
      return;
    }
    const el = event.detail.requestConfig?.elt;
    if (el?.tagName === 'FORM' && /\/delete\//.test(el.action)) el.closest('.card-row')?.classList.add('removing');
    if (destination.pathname !== location.pathname) {
      const previous = positions.get(destination.pathname + destination.search);
      keepScroll = el?.tagName === 'FORM' && previous !== undefined;
      scroll = keepScroll ? previous : 0;
    }
  });
  document.addEventListener('htmx:afterSettle', () => {
    window.scrollTo({top:keepScroll ? scroll : 0, behavior:'instant'});
    const main = document.getElementById('main');
    main?.removeAttribute('aria-busy');
    if (!keepScroll) main?.focus({preventScroll:true});
    const error = main?.querySelector('.field-invalid input, .field-invalid textarea, .field-invalid select');
    error?.focus();
    if (searchFocus) {
      const input = document.getElementById('deck-search');
      input?.focus({preventScroll:true});
      input?.setSelectionRange(selection, selection);
    }
    enhance();
  });
  document.addEventListener('htmx:afterRequest', () => {
    document.getElementById('page-progress').hidden = true;
    document.getElementById('main')?.removeAttribute('aria-busy');
  });
  for (const type of ['htmx:responseError','htmx:sendError','htmx:timeout']) document.addEventListener(type, () => {
    document.getElementById('navigation-error').hidden = false;
  });
  document.addEventListener('htmx:historyRestore', () => enhance());
  enhance();
})();
