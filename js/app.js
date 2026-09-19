// Routeur et chargement de l'application.

import { el, clear } from './ui.js';
import { getSetting } from './db.js';
import { applyTheme } from './theme.js';
import { renderHome } from './views/home.js';
import { renderTrain } from './views/train.js';
import { renderDrill } from './views/drill.js';
import { renderOdds } from './views/odds.js';
import { renderCombos } from './views/combos.js';
import { renderAudit } from './views/audit.js';
import { renderStats } from './views/stats.js';
import { renderRanges } from './views/ranges.js';
import { renderImport } from './views/import.js';
import { renderSettings } from './views/settings.js';

const ROUTES = {
  '/home': renderHome,
  '/train': renderTrain,
  '/drill': renderDrill,
  '/odds': renderOdds,
  '/combos': renderCombos,
  '/audit': renderAudit,
  '/stats': renderStats,
  '/ranges': renderRanges,
  '/import': renderImport,
  '/settings': renderSettings,
};

const TABS = [
  { route: '/home', label: 'Accueil', icon: '♠' },
  { route: '/train', label: "S'entraîner", icon: '▶' },
  { route: '/stats', label: 'Stats', icon: '▥' },
  { route: '/ranges', label: 'Ranges', icon: '▦' },
  { route: '/settings', label: 'Réglages', icon: '⚙' },
];

// Écrans rattachés à un onglet qui n'est pas le leur.
const TAB_OF = {
  '/drill': '/train', '/odds': '/train', '/combos': '/train',
  '/audit': '/ranges', '/import': '/ranges',
};

const view = document.getElementById('view');
const nav = document.getElementById('nav');

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/home';
  const [path, query] = raw.split('?');
  return { path: path || '/home', params: new URLSearchParams(query || '') };
}

function buildNav() {
  clear(nav);
  const { path } = parseHash();
  const active = TAB_OF[path] || path;
  for (const tab of TABS) {
    nav.appendChild(el('a.nav__tab' + (tab.route === active ? '.is-active' : ''), {
      href: `#${tab.route}`,
    }, el('span.nav__icon', null, tab.icon), el('span.nav__label', null, tab.label)));
  }
}

let renderToken = 0;

async function render() {
  const { path, params } = parseHash();
  const handler = ROUTES[path] || renderHome;
  const token = ++renderToken;

  buildNav();
  clear(view);
  view.appendChild(el('div.loading', null, 'Chargement…'));

  try {
    const target = el('div.view');
    await handler(target, params);
    if (token !== renderToken) return; // une navigation plus récente a pris la main
    clear(view).appendChild(target);
  } catch (err) {
    if (token !== renderToken) return;
    console.error(err);
    clear(view).appendChild(el('div.card.card--error', null,
      el('h2.card__title', null, 'Erreur'),
      el('p', null, err.message)));
  }
}

window.addEventListener('hashchange', render);

async function boot() {
  applyTheme(await getSetting('theme', 'dark'));
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
    applyTheme(await getSetting('theme', 'dark'));
  });
  await render();

  // ?nosw désactive le cache hors ligne : indispensable pour développer sans se
  // faire servir d'anciens modules par le service worker.
  if (new URLSearchParams(location.search).has('nosw')) {
    const regs = await navigator.serviceWorker?.getRegistrations?.() ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
    const keys = await caches?.keys?.() ?? [];
    await Promise.all(keys.map((k) => caches.delete(k)));
    return;
  }

  if ('serviceWorker' in navigator) {
    // Enregistré en chemin relatif : l'app marche aussi dans un sous-dossier.
    navigator.serviceWorker
      .register(new URL('../sw.js', import.meta.url))
      .catch((err) => console.warn('Service worker non enregistré :', err.message));
  }
}

boot();
