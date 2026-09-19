// Audit des ranges importées : cherche les incohérences internes.
// Ne juge pas la stratégie — signale seulement ce qui se contredit dans TES propres données.

import { el, section, go, pct, emptyState, mount } from '../ui.js';
import { listRanges, openPercent, POSITION_LABEL, POSITIONS, ACTION_META } from '../ranges.js';
import { allHands, comboCount, RANKS } from '../cards.js';

const strength = (rank) => 14 - RANKS.indexOf(rank);

const isPlayed = (entry) => Boolean(entry) && entry.actions.some((a) => a !== 'fold');

/* ---------------------------------------------------------------- contrôles */

/** Une main plus forte foldée alors qu'une main dominée est jouée. */
function dominationIssues(range) {
  const found = [];
  const hands = allHands();

  for (const weak of hands) {
    if (!isPlayed(range.hands[weak])) continue;
    for (const strong of hands) {
      if (strong === weak) continue;
      if (!dominates(strong, weak)) continue;
      const entry = range.hands[strong];
      if (entry && !isPlayed(entry)) found.push({ strong, weak });
    }
  }
  return found;
}

/**
 * Domination volontairement stricte : on ne retient que les cas où aucun arbitrage
 * de jouabilité ne peut justifier l'écart.
 *
 * Comparer K8s et 98s n'aurait pas de sens ici : K8s a la meilleure carte haute, mais
 * 98s est connectée, et beaucoup de ranges légitimes jouent la seconde en foldant la
 * première. On exige donc que la carte haute soit IDENTIQUE et que seul le kicker
 * change — là, la main est meilleure sur tous les plans à la fois.
 */
function dominates(a, b) {
  const pairA = a.length === 2;
  const pairB = b.length === 2;
  if (pairA && pairB) return strength(a[0]) > strength(b[0]);
  if (pairA !== pairB) return false;

  if (a.endsWith('s') === b.endsWith('s')) {
    return a[0] === b[0] && strength(a[1]) > strength(b[1]);
  }
  // Mêmes rangs : la version assortie domine la dépareillée.
  return a[0] === b[0] && a[1] === b[1] && a.endsWith('s') && b.endsWith('o');
}

/**
 * En profondeur courte : une main jouée en raise simple alors qu'une main qu'elle
 * domine part à tapis. La structure push/fold se contredit alors elle-même.
 */
function shoveGapIssues(range) {
  const shoved = allHands().filter((h) => {
    const e = range.hands[h];
    return e && e.actions.includes('allin');
  });
  if (!shoved.length) return [];

  const found = [];
  for (const hand of allHands()) {
    const entry = range.hands[hand];
    if (!entry || entry.actions.includes('allin') || !entry.actions.includes('raise')) continue;
    const dominated = shoved.filter((w) => dominates(hand, w));
    if (dominated.length) found.push({ hand, dominated });
  }
  return found;
}

/** Part des combinaisons jouées en raise non-all-in. */
function nonShoveRaise(range) {
  let combos = 0;
  let total = 0;
  for (const hand of allHands()) {
    total += comboCount(hand);
    const entry = range.hands[hand];
    if (entry && entry.actions.includes('raise') && !entry.actions.includes('allin')) {
      combos += comboCount(hand);
    }
  }
  return total ? (combos / total) * 100 : 0;
}

/** Positions plus tardives qui ouvrent plus serré qu'une position plus précoce. */
function positionInversions(byStack) {
  const order = POSITIONS.filter((p) => p !== 'BB' && p !== 'SB');
  const found = [];
  for (const [stack, row] of byStack) {
    for (let i = 0; i < order.length - 1; i++) {
      for (let j = i + 1; j < order.length; j++) {
        const early = row[order[i]];
        const late = row[order[j]];
        if (early === undefined || late === undefined) continue;
        if (late < early - 1) {
          found.push({ stack, early: order[i], late: order[j], earlyPct: early, latePct: late });
        }
      }
    }
  }
  return found;
}

/** Profondeur intermédiaire plus serrée que ses deux voisines. */
function stackDips(byPosition) {
  const found = [];
  for (const [position, entries] of byPosition) {
    const sorted = entries.sort((a, b) => a.stack - b.stack);
    for (let i = 1; i < sorted.length - 1; i++) {
      const [prev, here, next] = [sorted[i - 1], sorted[i], sorted[i + 1]];
      if (here.value < prev.value - 3 && here.value < next.value - 3) {
        found.push({ position, ...here, prev: prev.value, next: next.value });
      }
    }
  }
  return found;
}

/* ------------------------------------------------------------------- écran */

export async function renderAudit(root) {
  const ranges = await listRanges();
  if (!ranges.length) {
    mount(root,
      el('h1.page-title', null, 'Audit des ranges'),
      section(null, emptyState('Aucune range à analyser.', 'Importer mes ranges', '#/import')));
    return;
  }

  const stacks = [...new Set(ranges.map((r) => r.stackBB))].sort((a, b) => a - b);
  const positions = POSITIONS.filter((p) => ranges.some((r) => r.position === p));

  const pctByKey = new Map();
  for (const r of ranges) pctByKey.set(`${r.position}|${r.stackBB}`, openPercent(r));

  const byStack = stacks.map((stack) => [stack, Object.fromEntries(
    positions.map((p) => [p, pctByKey.get(`${p}|${stack}`)]).filter(([, v]) => v !== undefined))]);
  const byPosition = positions.map((p) => [p, stacks
    .filter((s) => pctByKey.has(`${p}|${s}`))
    .map((s) => ({ stack: s, value: pctByKey.get(`${p}|${s}`) }))]);

  const inversions = positionInversions(byStack);
  const dips = stackDips(byPosition);
  const dominations = ranges
    .map((r) => ({ range: r, issues: dominationIssues(r) }))
    .filter((x) => x.issues.length);
  const shortStacks = ranges.filter((r) => r.stackBB <= 15);
  const shoveGaps = shortStacks
    .map((r) => ({ range: r, issues: shoveGapIssues(r) }))
    .filter((x) => x.issues.length);

  mount(root,
    el('h1.page-title', null, 'Audit des ranges'),
    el('p.hint', null,
      `${ranges.length} ranges analysées. Cet écran ne dit pas si ta stratégie est bonne : `
      + 'il cherche les endroits où tes ranges se contredisent entre elles.'),

    section('Largeur d\'ouverture (% des combinaisons jouées)', matrix(byStack, positions)),

    section('Cohérence entre positions',
      inversions.length
        ? el('div', null,
          el('p.hint.is-warn', null,
            `${inversions.length} inversion(s) : une position plus tardive ouvre plus serré qu'une position plus précoce.`),
          el('ul.list', null, inversions.slice(0, 6).map((i) => el('li.list__row', null,
            el('span.list__main', null, `${i.stack} BB — ${i.late} plus serré que ${i.early}`),
            el('span.list__side.is-bad', null, `${pct(i.latePct, 1)} vs ${pct(i.earlyPct, 1)}`)))))
        : el('p.hint.is-good', null,
          'Aucune inversion : plus tu es tard dans l\'ordre de parole, plus tu ouvres large. '
          + "C'est la structure attendue.")),

    section('Cohérence entre profondeurs',
      dips.length
        ? el('div', null,
          el('p.hint.is-warn', null,
            `${dips.length} creux : cette profondeur est plus serrée que celle juste au-dessus ET celle juste en dessous.`),
          el('ul.list', null, dips.map((d) => el('li.list__row', null,
            el('span.list__main', null,
              el('strong', null, `${d.position} à ${d.stack} BB`),
              el('span.list__sub', null,
                `${pct(d.prev, 1)} à la profondeur inférieure · ${pct(d.next, 1)} à la supérieure`)),
            el('span.list__side.is-bad', null, pct(d.value, 1))))),
          el('p.hint', null,
            'Un creux isolé est rarement voulu : la largeur devrait varier de façon régulière '
            + 'quand le stack change.'))
        : el('p.hint.is-good', null, 'La largeur évolue régulièrement avec la profondeur.')),

    section('Mains dominées jouées, mains dominantes foldées',
      dominations.length
        ? el('div', null,
          el('p.hint.is-warn', null,
            `${dominations.reduce((n, d) => n + d.issues.length, 0)} cas dans ${dominations.length} range(s).`),
          el('ul.list', null, dominations.slice(0, 8).map((d) => el('li.list__row', null,
            el('span.list__main', null,
              el('strong', null, `${d.range.position} · ${d.range.stackBB} BB`),
              el('span.list__sub', null, d.issues.slice(0, 3)
                .map((i) => `${i.strong} fold mais ${i.weak} joué`).join(' · ')
                + (d.issues.length > 3 ? ` · +${d.issues.length - 3}` : ''))),
            el('button.btn.btn--link', {
              onclick: () => go(`#/ranges?id=${encodeURIComponent(d.range.id)}`),
            }, 'Voir')))))
        : el('p.hint.is-good', null,
          'Aucune contradiction de ce type : tu ne joues jamais une main dominée en foldant '
          + 'la main qui la domine.')),

    shoveGaps.length
      ? section('Mains fortes qui ne partent pas à tapis',
        el('p.hint.is-warn', null,
          `${shoveGaps.reduce((n, g) => n + g.issues.length, 0)} cas en profondeur courte : `
          + 'une main est jouée en raise simple alors qu\'une main qu\'elle domine part all-in.'),
        el('ul.list', null, shoveGaps.slice(0, 8).map((g) => el('li.list__row', null,
          el('span.list__main', null,
            el('strong', null, `${g.range.position} · ${g.range.stackBB} BB`),
            el('span.list__sub', null, g.issues.slice(0, 4)
              .map((i) => `${i.hand} raise, ${i.dominated[0]} all-in`).join(' · ')
              + (g.issues.length > 4 ? ` · +${g.issues.length - 4}` : ''))),
          el('button.btn.btn--link', {
            onclick: () => go(`#/ranges?id=${encodeURIComponent(g.range.id)}`),
          }, 'Voir')))),
        el('p.hint', null,
          'À cette profondeur, un raise non all-in engage déjà presque tout le tapis. '
          + 'Si le but est de piéger, la main reste malgré tout engagée ; si ce n\'est pas le but, '
          + "c'est probablement une coquille."))
      : null,

    shortStacks.length
      ? section('Logique push/fold en profondeur courte',
        el('table.table', null,
          el('thead', null, el('tr', null,
            el('th', null, ''), el('th', null, 'Joué'), el('th', null, 'Raise non all-in'))),
          el('tbody', null, shortStacks.map((r) => {
            const nonShove = nonShoveRaise(r);
            return el('tr', null,
              el('td', null, `${r.position} ${r.stackBB} BB`),
              el('td.num', null, pct(openPercent(r), 1)),
              el('td.num' + (nonShove > 5 ? '.is-bad' : ''), null, pct(nonShove, 1)));
          }))),
        el('p.hint', null,
          'Sous 15 BB, un raise qui n\'est pas un all-in laisse peu de marge : '
          + 'plus cette colonne est proche de zéro, plus la stratégie est un push/fold assumé.'))
      : null,

    section('Couverture',
      el('ul.list', null, ranges.slice(0, 40).map((r) => {
        const filled = Object.keys(r.hands).length;
        return el('li.list__row', null,
          el('span.list__main', null, `${r.position} · ${r.stackBB} BB`),
          el('span.list__side' + (filled < 169 ? '.is-bad' : ''), null, `${filled}/169 mains`));
      }))),
  );
}

function matrix(byStack, positions) {
  return el('div.matrix-wrap', null, el('table.table.table--matrix', null,
    el('thead', null, el('tr', null,
      el('th', null, 'BB'),
      positions.map((p) => el('th.num', { title: POSITION_LABEL[p] || p }, p)))),
    el('tbody', null, byStack.map(([stack, row]) => el('tr', null,
      el('td', null, el('strong', null, stack)),
      positions.map((p) => {
        const v = row[p];
        if (v === undefined) return el('td.num', null, '—');
        return el('td.num', {
          style: { background: heat(v) },
        }, v.toFixed(0));
      }))))));
}

/** Fond coloré proportionnel à la largeur de la range. */
function heat(value) {
  const t = Math.min(1, value / 80);
  return `color-mix(in srgb, ${ACTION_META.raise.color} ${Math.round(t * 62)}%, transparent)`;
}
