// « Que faire ? » — consultation directe : tu donnes la position, le stack et tes deux
// cartes, l'app répond ce que TES ranges disent, avec la justification.

import { el, clear, section, go, emptyState, mount } from '../ui.js';
import {
  listRanges, availablePositions, availableStacks, rangeId,
  POSITION_LABEL, SCENARIOS, ACTION_META, expectedLabel,
} from '../ranges.js';
import { RANKS, makeHand } from '../cards.js';
import { getSetting, setSetting } from '../db.js';
import { buildGrid, buildLegend } from '../grid.js';
import { explain } from '../explain.js';

const pretty = (r) => (r === 'T' ? '10' : r);

export async function renderLookup(root) {
  const ranges = await listRanges();
  if (!ranges.length) {
    mount(root,
      el('h1.page-title', null, 'Que faire ?'),
      section(null, emptyState('Aucune range chargée.', 'Importer mes ranges', '#/import')));
    return;
  }

  const positions = availablePositions(ranges);
  const stacks = availableStacks(ranges);
  const scenarios = [...new Set(ranges.map((r) => r.scenario))];

  const saved = await getSetting('lookup', null);
  const state = {
    position: positions.includes(saved?.position) ? saved.position : positions[0],
    stackBB: stacks.includes(saved?.stackBB) ? saved.stackBB : stacks[stacks.length - 1],
    scenario: scenarios.includes(saved?.scenario) ? saved.scenario : scenarios[0],
    rank1: saved?.rank1 || 'A',
    rank2: saved?.rank2 || 'K',
    suited: saved?.suited ?? true,
  };

  const answer = el('div.answer');
  const gridBox = el('div');
  const suitedRow = el('div.chips');

  /** Grille compacte des 13 rangs, une ligne de sélection par carte. */
  function rankPicker(key) {
    const row = el('div.rank-grid');
    const draw = () => {
      clear(row);
      for (const r of RANKS) {
        row.append(el('button.chip.chip--rank' + (state[key] === r ? '.is-on' : ''), {
          type: 'button',
          onclick: () => { state[key] = r; draw(); update(); },
        }, pretty(r)));
      }
    };
    draw();
    return { row, draw };
  }

  const card1 = rankPicker('rank1');
  const card2 = rankPicker('rank2');

  function chipRow(values, current, label, apply) {
    const row = el('div.chips');
    const draw = () => {
      clear(row);
      for (const v of values) {
        row.append(el('button.chip' + (current() === v ? '.is-on' : ''), {
          type: 'button',
          onclick: () => { apply(v); draw(); update(); },
        }, label(v)));
      }
    };
    draw();
    return row;
  }

  function drawSuited() {
    const pair = state.rank1 === state.rank2;
    clear(suitedRow);
    if (pair) {
      suitedRow.append(el('p.hint', null, 'Une paire : la question ne se pose pas.'));
      return;
    }
    for (const [value, text] of [[true, 'Assorties'], [false, 'Dépareillées']]) {
      suitedRow.append(el('button.chip' + (state.suited === value ? '.is-on' : ''), {
        type: 'button',
        onclick: () => { state.suited = value; drawSuited(); update(); },
      }, text));
    }
  }

  mount(root,
    el('h1.page-title', null, 'Que faire ?'),
    answer,
    section('Ta position', chipRow(positions, () => state.position,
      (p) => `${p} · ${POSITION_LABEL[p] || ''}`.replace(/ · $/, ''),
      (v) => { state.position = v; })),
    section('Ton stack', chipRow(stacks, () => state.stackBB,
      (s) => `${s} BB`, (v) => { state.stackBB = v; })),
    scenarios.length > 1
      ? section('Scénario', chipRow(scenarios, () => state.scenario,
        (s) => SCENARIOS[s] || s, (v) => { state.scenario = v; }))
      : null,
    section('Première carte', card1.row),
    section('Deuxième carte', card2.row),
    section('Couleurs', suitedRow),
    gridBox,
  );

  drawSuited();
  update();

  function update() {
    const pair = state.rank1 === state.rank2;
    const hand = makeHand(state.rank1, state.rank2, pair ? false : state.suited);
    const range = ranges.find((r) => r.id === rangeId(state.position, state.stackBB, state.scenario));

    setSetting('lookup', { ...state });
    drawSuited();
    clear(gridBox);

    if (!range) {
      mount(clear(answer), el('div.card.card--warn', null,
        el('h2.card__title', null, 'Pas de range'),
        el('p', null, `Tu n'as rien de renseigné pour ${state.position} à ${state.stackBB} BB.`)));
      return;
    }

    const entry = range.hands[hand];
    const actions = entry ? entry.actions : [];
    const tone = actions.length ? actions[0] : null;

    mount(clear(answer),
      el('div.answer__card', {
        style: tone ? { '--answer-color': ACTION_META[tone].color } : null,
      },
        el('div.answer__hand', null,
          `${pretty(state.rank1)}${pretty(state.rank2)}`,
          pair ? '' : (state.suited ? ' assortis' : ' dépareillés'),
          ` · ${state.position} · ${state.stackBB} BB`),
        el('div.answer__action', null, entry ? expectedLabel(actions) : 'Non renseignée'),
        entry && actions.length > 1
          ? el('div.answer__note', null, 'Décision mixte : les deux sont justes.')
          : null));

    const reasons = explain({ range, hand, entry, allRanges: ranges });
    mount(gridBox,
      reasons.length
        ? section('Pourquoi', el('ul.reasons', null, reasons.map((r) => el('li', null, r))))
        : null,
      section(`Range ${range.position} · ${range.stackBB} BB`,
        buildGrid(range, { highlight: hand, onCell: (h) => pick(h) }),
        buildLegend(range),
        el('p.hint', null, 'Touche une case pour consulter cette main.')),
      el('button.btn.btn--ghost', { onclick: () => go('#/drill') }, "M'entraîner sur ce spot"));
  }

  /** Sélection directe depuis la grille. */
  function pick(hand) {
    state.rank1 = hand[0];
    state.rank2 = hand[1];
    if (hand.length > 2) state.suited = hand.endsWith('s');
    card1.draw();
    card2.draw();
    update();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
