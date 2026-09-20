import { el, section, toast, go, mount } from '../ui.js';
import { getSetting, setSetting } from '../db.js';
import { listRanges, clearRanges } from '../ranges.js';
import { allAttempts, clearAttempts } from '../stats.js';
import { download } from './ranges.js';
import { applyTheme } from '../theme.js';

/**
 * Version réellement active : le nom du cache est créé par le service worker qui
 * s'est installé, il ne peut donc pas décrire autre chose que le code servi.
 *
 * Ne pas lire sw.js pour ça : ce fichier n'est pas mis en cache, la requête part
 * sur le réseau et renvoie la version du serveur — pas celle qui tourne.
 */
async function loadedVersion() {
  try {
    const keys = await caches.keys();
    const match = keys.map((k) => k.match(/^poker-master-v(\d+)$/)).find(Boolean);
    return match ? `v${match[1]}` : null;
  } catch {
    return null;
  }
}

/** Version publiée sur le serveur, lue hors cache. */
async function publishedVersion() {
  try {
    const res = await fetch(`sw.js?check=${Date.now()}`, { cache: 'no-store' });
    const m = (await res.text()).match(/poker-master-v(\d+)/);
    return m ? `v${m[1]}` : null;
  } catch {
    return null;
  }
}

/** Purge le service worker et ses caches, puis recharge depuis le réseau. */
async function forceUpdate() {
  const regs = await navigator.serviceWorker?.getRegistrations?.() ?? [];
  await Promise.all(regs.map((r) => r.unregister()));
  const keys = await caches?.keys?.() ?? [];
  await Promise.all(keys.map((k) => caches.delete(k)));
  location.replace(`${location.pathname}?fresh=${Date.now()}`);
}

export async function renderSettings(root) {
  const [ranges, attempts, theme, loaded, published] = await Promise.all([
    listRanges(), allAttempts(), getSetting('theme', 'dark'),
    loadedVersion(), publishedVersion(),
  ]);
  const outdated = loaded && published && loaded !== published;

  mount(root,
    el('h1.page-title', null, 'Réglages'),

    section('Thème',
      el('div.chips', null, [['dark', 'Sombre'], ['light', 'Clair'], ['auto', 'Auto']].map(([v, label]) => {
        const btn = el('button.chip' + (theme === v ? '.is-on' : ''), {
          type: 'button',
          onclick: async () => {
            await setSetting('theme', v);
            applyTheme(v);
            btn.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.remove('is-on'));
            btn.classList.add('is-on');
          },
        }, label);
        return btn;
      }))),

    section('Mes données',
      el('p.hint', null,
        `${ranges.length} ranges · ${attempts.length} mains dans l'historique. `
        + "Tout est stocké dans le navigateur de ce téléphone, rien n'est envoyé ailleurs."),
      el('div.stack', null,
        el('button.btn.btn--ghost', {
          onclick: () => download('poker-master-ranges.json', JSON.stringify({ ranges }, null, 1)),
        }, 'Exporter mes ranges (JSON)'),
        el('button.btn.btn--ghost', {
          onclick: () => download('poker-master-historique.json', JSON.stringify(attempts, null, 1)),
        }, 'Exporter mon historique (JSON)'))),

    section('Remise à zéro',
      el('div.stack', null,
        el('button.btn.btn--ghost.is-danger', {
          onclick: async () => {
            if (!confirm('Effacer tout mon historique de mains ?')) return;
            await clearAttempts();
            toast('Historique effacé');
            go('#/settings');
          },
        }, "Effacer l'historique"),
        el('button.btn.btn--ghost.is-danger', {
          onclick: async () => {
            if (!confirm('Supprimer toutes mes ranges ?')) return;
            await clearRanges();
            toast('Ranges supprimées');
            go('#/settings');
          },
        }, 'Supprimer toutes les ranges'))),

    section('Version',
      el('p.hint', null,
        'Chargée dans ce navigateur : ', el('strong', null, loaded || 'inconnue'),
        published ? ' · publiée sur le serveur : ' : '',
        published ? el('strong', null, published) : null),
      outdated
        ? el('div.card.card--warn', null,
          el('p', null,
            `Une version plus récente existe (${published}). Tant que tu n'as pas mis à jour, `
            + "les corrections récentes n'apparaissent pas."),
          el('button.btn.btn--primary', { onclick: forceUpdate }, 'Mettre à jour maintenant'))
        : el('div', null,
          el('p.hint', null,
            "Une app installée garde son cache : si une correction ne semble pas arrivée, "
            + 'utilise le bouton ci-dessous.'),
          el('button.btn.btn--ghost', { onclick: forceUpdate }, 'Forcer la mise à jour'))),

    section('À propos',
      el('p.hint', null,
        "Poker Master — PWA locale, sans compte ni serveur. "
        + 'Pour l\'installer : Safari → Partager → « Sur l\'écran d\'accueil ».')),
  );
}
