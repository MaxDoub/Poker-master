// Thème clair / sombre / auto.

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);

  const dark = theme === 'dark'
    || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  // La photo de feutre n'a de sens que sur le thème sombre.
  document.body.classList.toggle('felt-bg', dark);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#08241c' : '#0e4a37');
}
