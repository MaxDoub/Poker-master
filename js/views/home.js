import { el, section, stat, go, pct, emptyState, mount } from '../ui.js';
import { listRanges } from '../ranges.js';
import { allAttempts, summarize } from '../stats.js';
import { getSetting } from '../db.js';

export async function renderHome(root) {
  const [ranges, attempts, odds, combos] = await Promise.all([
    listRanges(), allAttempts(),
    getSetting('oddsStats', null), getSetting('comboStats', null),
  ]);
  const s = summarize(attempts);

  if (!ranges.length) {
    mount(root,
      el('div.hero', null,
        el('h1.hero__title', null, 'Poker Master'),
        el('p.hero__sub', null, "Entraînement preflop sur tes propres ranges, hors ligne, sur ton iPhone.")),
      section('Commencer',
        emptyState(
          'Importe range_poker.xlsx, un CSV ou un JSON. Une seule fois : ensuite tes ranges '
          + 'restent dans ce téléphone.',
          'Importer mes ranges', '#/import?mine=1')),
      section(null,
        el('button.btn.btn--ghost', { onclick: () => go('#/import?demo=1') }, 'Essayer avec la démo')),
    );
    return;
  }

  mount(root,
    el('div.hero', null,
      el('h1.hero__title', null, 'Poker Master'),
      el('p.hero__sub', null, `${ranges.length} ranges chargées · ${s.total} mains jouées`)),

    el('div.stack', null,
      el('button.btn.btn--primary.btn--xl', { onclick: () => go('#/drill') }, 'Lancer un drill'),
      el('button.btn.btn--ghost', { onclick: () => go('#/lookup') }, 'Que faire ? — consulter une main'),
      el('button.btn.btn--ghost', { onclick: () => go('#/train') }, 'Tous les exercices')),

    section("Aujourd'hui",
      el('div.stats-row', null,
        stat(s.today.n, 'mains'),
        stat(pct(s.today.rate), 'réussite'),
        stat(pct(s.rate), 'réussite globale'))),

    odds || combos
      ? section('Autres exercices',
        el('ul.list', null, [
          odds ? ['Cotes & équité', odds] : null,
          combos ? ['Combos & blockers', combos] : null,
        ].filter(Boolean).map(([name, st]) => el('li.list__row', null,
          el('span.list__main', null, name),
          el('span.list__side', null,
            `${st.played} · ${pct((st.hits / st.played) * 100)}`)))))
      : null,

    s.leaks.length
      ? section('Tes 3 fuites principales',
        el('ul.list', null, s.leaks.slice(0, 3).map((l) => el('li.list__row', null,
          el('span.list__main', null, `${l.hand} · ${l.position} ${l.stackBB} BB`),
          el('span.list__side.is-bad', null, `${l.errors} erreur${l.errors > 1 ? 's' : ''} / ${l.n}`)))),
        el('button.btn.btn--ghost', { onclick: () => go('#/stats') }, 'Voir toutes les stats'))
      : null,
  );
}
