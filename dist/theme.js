(() => {
  const storageKey = 'csa.theme.v1';
  const root = document.documentElement;
  let theme = 'light';
  try { if (localStorage.getItem(storageKey) === 'dark') theme = 'dark'; }
  catch { /* The toggle still works for this page when storage is unavailable. */ }

  function apply(next) {
    theme = next === 'dark' ? 'dark' : 'light';
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#141820' : '#faf9f9');
    document.querySelector('#theme-toggle')?.setAttribute('aria-checked', String(theme === 'dark'));
  }

  apply(theme);
  document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.querySelector('#theme-toggle');
    apply(theme);
    toggle.addEventListener('click', () => {
      apply(theme === 'dark' ? 'light' : 'dark');
      try { localStorage.setItem(storageKey, theme); }
      catch { document.querySelector('#theme-status').textContent = 'Appearance changed for this session. Browser storage is unavailable.'; }
    });
  });
  window.addEventListener('storage', event => {
    if (event.key === storageKey || event.key === null) apply(event.newValue);
  });
})();
