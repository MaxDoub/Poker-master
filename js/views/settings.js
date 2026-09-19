import { el, section, toast, go, mount } from '../ui.js';
import { getSetting, setSetting } from '../db.js';
import { listRanges, clearRanges } from '../ranges.js';
import { allAttempts, clearAttempts } from '../stats.js';
import { download } from './ranges.js';
import { applyTheme } from '../theme.js';

export async function renderSettings(root) {
  const [ranges, attempts, theme] = await Promise.all([
    listRanges(), allAttempts(), getSetting('theme', 'dark'),
  ]);

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

    section('À propos',
      el('p.hint', null,
        "Poker Master — PWA locale, sans compte ni serveur. "
        + 'Pour l\'installer : Safari → Partager → « Sur l\'écran d\'accueil ».')),
  );
}
