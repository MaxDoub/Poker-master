// Drill « call ou fold face à un all-in ».
// La bonne réponse est purement arithmétique : équité réelle contre la range de shove
// de l'adversaire — c'est-à-dire TA range pour cette position et ce stack.

import { el, clear, section, go, pct, emptyState, mount } from '../ui.js';
import { listRanges, POSITION_LABEL } from '../ranges.js';
import { equity, requiredEquity, potOdds, handCombos, toInt } from '../equity.js';
import { dealCards } from '../cards.js';
import { buildGrid } from '../grid.js';
import { cardSVG } from '../card-art.js';
import { getSetting, setSetting } from '../db.js';

const TRIALS = 3000;
const HANDS_PER_SESSION = 10;

/** Ranges utilisables : celles qui contiennent assez de mains en all-in. */
function shoveRanges(ranges) {
  return ranges
    .map((r) => {
      const hands = Object.entries(r.hands)
        .filter(([, e]) => e.actions.includes('allin'))
        .map(([h]) => h);
      return { range: r, shoves: hands };
    })
    .filter((x) => x.shoves.length >= 6);
}

export async function renderOdds(root) {
  const ranges = await listRanges();
  const usable = shoveRanges(ranges);

  if (!usable.length) {
    mount(root,
      el('h1.page-title', null, 'Cotes & équité'),
      section(null, emptyState(
        "Cet exercice a besoin de ranges contenant des all-in — typiquement tes profondeurs "
        + 'courtes (10 à 20 BB). Aucune trouvée dans tes données.',
        'Voir mes ranges', '#/ranges')));
    return;
  }

  const state = { played: 0, hits: 0, history: [] };
  const board = el('div.board');
  mount(root, el('h1.page-title', null, 'Cotes & équité'), board);
  nextSpot();

  function nextSpot() {
    if (state.played >= HANDS_PER_SESSION) return renderSummary();

    const pick = usable[(Math.random() * usable.length) | 0];
    const stack = pick.range.stackBB;

    // Blindes 0,5 / 1. Le vilain part all-in pour `stack`, tout le monde fold, tu es en BB.
    const pot = stack + 1.5;          // son tapis + la SB + ta BB déjà postée
    const toCall = stack - 1;         // tu as déjà 1 BB dans le pot
    const needed = requiredEquity(pot, toCall);

    const [c1, c2] = dealCards();
    const hero = [toInt(c1), toInt(c2)];

    const combos = pick.shoves
      .flatMap((h) => handCombos(h))
      .filter(([a, b]) => a !== hero[0] && a !== hero[1] && b !== hero[0] && b !== hero[1]);

    clear(board);
    mount(board,
      el('div.board__head', null,
        el('span.board__count', null, `Main ${state.played + 1} / ${HANDS_PER_SESSION}`),
        el('button.btn.btn--link', { onclick: renderSummary }, 'Terminer')),
      el('div.felt.felt--compact', null,
        el('p.felt__action', null,
          `${pick.range.position} · ${POSITION_LABEL[pick.range.position] || ''} part all-in pour ${stack} BB. `
          + 'Tout le monde fold. Tu es en grosse blinde.'),
        el('div.hole-cards', null, [c1, c2].map((c) => cardSVG(c)))),
      el('div.odds-facts', null,
        fact(`${pot.toLocaleString('fr-FR')} BB`, 'Pot si tu ne paies pas'),
        fact(`${toCall.toLocaleString('fr-FR')} BB`, 'À payer'),
        fact(pct(needed, 1), 'Équité nécessaire')),
      el('p.hint', null,
        `Cote du pot : ${potOdds(pot, toCall).toFixed(2)} contre 1. `
        + `Il te faut donc au moins ${pct(needed, 1)} d'équité pour que le call soit rentable.`),
      el('div.actions', null,
        el('button.btn.btn--action', {
          style: { '--action-color': 'var(--good)' },
          onclick: () => answer('call'),
        }, 'Call'),
        el('button.btn.btn--action', {
          style: { '--action-color': '#5b6b66' },
          onclick: () => answer('fold'),
        }, 'Fold')),
    );
    window.scrollTo(0, 0);

    function answer(choice) {
      const result = equity(hero, { combos }, [], TRIALS);
      const shouldCall = result.equity >= needed;
      const right = (choice === 'call') === shouldCall;
      state.played++;
      if (right) state.hits++;
      state.history.push({ right, choice, equity: result.equity, needed });
      renderFeedback({ pick, stack, pot, toCall, needed, hero: [c1, c2], result, choice, shouldCall, right });
    }
  }

  function renderFeedback({ pick, needed, hero, result, choice, shouldCall, right }) {
    const margin = result.equity - needed;
    clear(board);

    // Grille de la range de shove, pour visualiser contre quoi tu paies.
    const shoveOnly = {
      ...pick.range,
      hands: Object.fromEntries(Object.entries(pick.range.hands)
        .filter(([, e]) => e.actions.includes('allin'))),
    };

    mount(board,
      el(`div.verdict.verdict--${right ? 'good' : 'bad'}`, null,
        el('div.verdict__label', null, right ? 'Correct' : 'Erreur'),
        el('div.verdict__detail', null,
          `Ta réponse : ${choice === 'call' ? 'Call' : 'Fold'} · `
          + `le bon choix était ${shouldCall ? 'Call' : 'Fold'}`)),

      el('div.felt.felt--compact', null,
        el('div.hole-cards.hole-cards--small', null, hero.map((c) => cardSVG(c)))),

      section('Le calcul',
        el('div.odds-facts', null,
          fact(pct(result.equity, 1), 'Ton équité réelle'),
          fact(pct(needed, 1), 'Équité nécessaire'),
          fact((margin >= 0 ? '+' : '') + pct(margin, 1), 'Marge', margin >= 0 ? 'good' : 'bad')),
        el('div.equity-bar', null,
          el('div.equity-bar__fill', { style: { width: `${result.equity}%` } }),
          el('div.equity-bar__mark', { style: { left: `${needed}%` } })),
        el('p.hint', null,
          `Sur ${result.trials.toLocaleString('fr-FR')} simulations : `
          + `${pct(result.win, 1)} de victoires, ${pct(result.tie, 1)} de partages, ${pct(result.lose, 1)} de défaites. `
          + (margin >= 0
            ? 'Le call est rentable sur le long terme.'
            : "Le call perd de l'argent sur le long terme."))),

      section(`Sa range d'all-in — ${pick.range.position} ${pick.range.stackBB} BB`,
        buildGrid(shoveOnly),
        el('p.hint', null,
          `${Object.keys(shoveOnly.hands).length} mains. C'est ta propre range pour ce spot : `
          + "l'adversaire est supposé jouer comme toi.")),

      el('button.btn.btn--primary.btn--xl', { onclick: nextSpot }, 'Main suivante'),
    );
    window.scrollTo(0, 0);
  }

  async function renderSummary() {
    const rate = state.played ? (state.hits / state.played) * 100 : null;
    if (state.played) {
      // Compté à part : l'historique des mains préflop ne doit pas être mélangé avec ça.
      const prev = await getSetting('oddsStats', { played: 0, hits: 0 });
      await setSetting('oddsStats', {
        played: prev.played + state.played,
        hits: prev.hits + state.hits,
        lastAt: Date.now(),
      });
    }
    clear(board);
    mount(board,
      el('h2.page-title', null, 'Session terminée'),
      el('div.stats-row', null,
        el('div.stat', null, el('div.stat__value', null, state.played), el('div.stat__label', null, 'décisions')),
        el('div.stat', null, el('div.stat__value', null, pct(rate)), el('div.stat__label', null, 'justes')),
        el('div.stat', null,
          el('div.stat__value', null, state.played - state.hits),
          el('div.stat__label', null, 'erreurs'))),
      el('p.hint', null,
        'Les spots serrés (marge sous 3 points) sont les plus instructifs : '
        + "c'est là que l'intuition se trompe le plus souvent."),
      el('div.stack', null,
        el('button.btn.btn--primary', { onclick: () => go('#/odds') }, 'Rejouer'),
        el('button.btn.btn--ghost', { onclick: () => go('#/train') }, 'Autres exercices')),
    );
    window.scrollTo(0, 0);
  }
}

function fact(value, label, tone = null) {
  return el('div.stat' + (tone ? `.stat--${tone}` : ''), null,
    el('div.stat__value', null, value),
    el('div.stat__label', null, label));
}
