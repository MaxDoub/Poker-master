// Drill « combos & blockers » : questions factuelles à réponse unique.
// Compter les combinaisons est ce qui rend le hand-reading possible.

import { el, clear, section, go, pct, emptyState, mount } from '../ui.js';
import { listRanges, POSITION_LABEL, ACTION_META } from '../ranges.js';
import { allHands, comboCount, dealCards, RANKS } from '../cards.js';
import { getSetting, setSetting } from '../db.js';
import { cardSVG } from '../card-art.js';

const QUESTIONS_PER_SESSION = 10;

/* ------------------------------------------------------------- générateurs */

/** Combien de combos de `target` restent quand tu tiens `cards` ? */
function blockerQuestion() {
  const [c1, c2] = dealCards();
  const held = [c1, c2];

  // On choisit une main cible qui partage au moins un rang avec la tienne.
  const rank = Math.random() < 0.5 ? c1.rank : c2.rank;
  const kinds = ['pair', 'suited', 'offsuit'];
  const kind = kinds[(Math.random() * kinds.length) | 0];

  let target;
  let total;
  if (kind === 'pair') {
    target = rank + rank;
    total = 6;
  } else {
    let other = RANKS[(Math.random() * 13) | 0];
    while (other === rank) other = RANKS[(Math.random() * 13) | 0];
    const hi = RANKS.indexOf(rank) < RANKS.indexOf(other) ? rank : other;
    const lo = hi === rank ? other : rank;
    target = hi + lo + (kind === 'suited' ? 's' : 'o');
    total = kind === 'suited' ? 4 : 12;
  }

  const remaining = countRemaining(target, held);
  return {
    kind: 'blocker',
    cards: held,
    prompt: `Tu tiens ces deux cartes. Combien de combinaisons de ${label(target)} reste-t-il dans le paquet ?`,
    answer: remaining,
    options: numericOptions(remaining, total),
    explain: `${label(target)} compte ${total} combinaisons au départ. `
      + `Tes cartes en retirent ${total - remaining}, il en reste ${remaining}.`,
  };
}

/** Combien de combinaisons au total pour une main canonique ? */
function totalQuestion() {
  const hands = allHands();
  const hand = hands[(Math.random() * hands.length) | 0];
  const n = comboCount(hand);
  return {
    kind: 'total',
    prompt: `Combien de combinaisons ${label(hand)} compte-t-elle dans un paquet complet ?`,
    answer: n,
    options: [4, 6, 12, 16],
    explain: hand.length === 2
      ? 'Une paire : 6 combinaisons (4 cartes prises 2 à 2).'
      : hand.endsWith('s')
        ? 'Une main assortie : 4 combinaisons, une par couleur.'
        : 'Une main dépareillée : 12 combinaisons (4 × 4 moins les 4 assorties).',
  };
}

/** Quelle part des combos une de tes ranges joue-t-elle ? */
function rangeSizeQuestion(ranges) {
  const range = ranges[(Math.random() * ranges.length) | 0];
  let played = 0;
  let total = 0;
  for (const hand of allHands()) {
    const n = comboCount(hand);
    total += n;
    const entry = range.hands[hand];
    if (entry && entry.actions.some((a) => a !== 'fold')) played += n;
  }
  const value = Math.round((played / total) * 100);
  return {
    kind: 'range',
    prompt: `Dans TA range, quelle part des combinaisons joues-tu en ${range.position} `
      + `(${POSITION_LABEL[range.position] || range.position}) à ${range.stackBB} BB ?`,
    answer: value,
    suffix: ' %',
    options: percentOptions(value),
    explain: `${played} combinaisons jouées sur ${total}, soit ${value} %. `
      + 'Connaître la largeur de ses propres ranges est la base du hand-reading.',
  };
}

/** Combien de combinaisons d'une action précise dans une de tes ranges ? */
function actionCountQuestion(ranges) {
  const range = ranges[(Math.random() * ranges.length) | 0];
  const actions = [...new Set(Object.values(range.hands)
    .flatMap((e) => e.actions).filter((a) => a !== 'fold'))];
  if (!actions.length) return rangeSizeQuestion(ranges);
  const action = actions[(Math.random() * actions.length) | 0];

  let combos = 0;
  for (const [hand, entry] of Object.entries(range.hands)) {
    if (entry.actions.includes(action)) combos += comboCount(hand);
  }
  return {
    kind: 'action',
    prompt: `Combien de combinaisons joues-tu en ${ACTION_META[action].label} `
      + `depuis ${range.position} à ${range.stackBB} BB ?`,
    answer: combos,
    options: numericOptions(combos, 1326),
    explain: `${combos} combinaisons sur les 1326 possibles, soit ${((combos / 1326) * 100).toFixed(1)} %.`,
  };
}

/* ------------------------------------------------------------------ outils */

function label(hand) {
  const pretty = (r) => (r === 'T' ? '10' : r);
  if (hand.length === 2) return `${pretty(hand[0])}${pretty(hand[1])}`;
  return `${pretty(hand[0])}${pretty(hand[1])}${hand.endsWith('s') ? ' assorti' : ' dépareillé'}`;
}

function countRemaining(target, held) {
  const heldKeys = held.map((c) => c.rank + c.suit);
  let n = 0;
  const combos = comboList(target);
  for (const combo of combos) {
    if (combo.every((k) => !heldKeys.includes(k))) n++;
  }
  return n;
}

function comboList(hand) {
  const suits = ['s', 'h', 'd', 'c'];
  const out = [];
  if (hand.length === 2) {
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
      out.push([hand[0] + suits[a], hand[0] + suits[b]]);
    }
  } else if (hand.endsWith('s')) {
    for (const s of suits) out.push([hand[0] + s, hand[1] + s]);
  } else {
    for (const a of suits) for (const b of suits) if (a !== b) out.push([hand[0] + a, hand[1] + b]);
  }
  return out;
}

/** Trois leurres plausibles autour de la bonne réponse. */
function numericOptions(answer, max) {
  const set = new Set([answer]);
  const spread = Math.max(1, Math.round(Math.abs(answer) * 0.25));
  let guard = 0;
  while (set.size < 4 && guard++ < 60) {
    const delta = (1 + ((Math.random() * spread * 2) | 0)) * (Math.random() < 0.5 ? -1 : 1);
    const v = answer + delta;
    if (v >= 0 && v <= max) set.add(v);
  }
  while (set.size < 4) set.add(answer + set.size);
  return [...set].sort((a, b) => a - b);
}

function percentOptions(answer) {
  const set = new Set([answer]);
  for (const d of [-14, -7, 7, 14, -21, 21]) {
    if (set.size >= 4) break;
    const v = answer + d;
    if (v > 0 && v < 100) set.add(v);
  }
  return [...set].sort((a, b) => a - b);
}

/* ------------------------------------------------------------------- écran */

export async function renderCombos(root) {
  const ranges = await listRanges();
  if (!ranges.length) {
    mount(root,
      el('h1.page-title', null, 'Combos & blockers'),
      section(null, emptyState(
        'Certaines questions portent sur tes propres ranges.', 'Importer mes ranges', '#/import')));
    return;
  }

  const generators = [
    blockerQuestion, blockerQuestion, totalQuestion,
    () => rangeSizeQuestion(ranges), () => actionCountQuestion(ranges),
  ];

  const state = { played: 0, hits: 0 };
  const board = el('div.board');
  mount(root,
    el('h1.page-title', null, 'Combos & blockers'),
    el('p.hint', null,
      "Tout est factuel ici : aucune stratégie, juste du comptage. C'est ce comptage "
      + "qui permet ensuite d'estimer ce que l'adversaire peut avoir."),
    board);
  nextQuestion();

  function nextQuestion() {
    if (state.played >= QUESTIONS_PER_SESSION) return renderSummary();
    const q = generators[(Math.random() * generators.length) | 0]();

    clear(board);
    mount(board,
      el('div.board__head', null,
        el('span.board__count', null, `Question ${state.played + 1} / ${QUESTIONS_PER_SESSION}`),
        el('button.btn.btn--link', { onclick: renderSummary }, 'Terminer')),
      q.cards
        ? el('div.felt.felt--compact', null,
          el('div.hole-cards.hole-cards--small', null, q.cards.map((c) => cardSVG(c))))
        : null,
      el('p.question', null, q.prompt),
      el('div.options', null, q.options.map((opt) => el('button.btn.btn--option', {
        onclick: () => answer(q, opt),
      }, `${opt}${q.suffix || ''}`))),
    );
    window.scrollTo(0, 0);
  }

  function answer(q, choice) {
    const right = choice === q.answer;
    state.played++;
    if (right) state.hits++;

    clear(board);
    mount(board,
      el(`div.verdict.verdict--${right ? 'good' : 'bad'}`, null,
        el('div.verdict__label', null, right ? 'Correct' : 'Erreur'),
        el('div.verdict__detail', null,
          `Ta réponse : ${choice}${q.suffix || ''} · bonne réponse : ${q.answer}${q.suffix || ''}`)),
      q.cards
        ? el('div.felt.felt--compact', null,
          el('div.hole-cards.hole-cards--small', null, q.cards.map((c) => cardSVG(c))))
        : null,
      section('Pourquoi', el('p', null, q.explain)),
      el('button.btn.btn--primary.btn--xl', { onclick: nextQuestion }, 'Question suivante'),
    );
    window.scrollTo(0, 0);
  }

  async function renderSummary() {
    const rate = state.played ? (state.hits / state.played) * 100 : null;
    if (state.played) {
      const prev = await getSetting('comboStats', { played: 0, hits: 0 });
      await setSetting('comboStats', {
        played: prev.played + state.played, hits: prev.hits + state.hits, lastAt: Date.now(),
      });
    }
    clear(board);
    mount(board,
      el('h2.page-title', null, 'Session terminée'),
      el('div.stats-row', null,
        el('div.stat', null, el('div.stat__value', null, state.played), el('div.stat__label', null, 'questions')),
        el('div.stat', null, el('div.stat__value', null, pct(rate)), el('div.stat__label', null, 'justes')),
        el('div.stat', null,
          el('div.stat__value', null, state.played - state.hits),
          el('div.stat__label', null, 'erreurs'))),
      el('div.stack', null,
        el('button.btn.btn--primary', { onclick: () => go('#/combos') }, 'Rejouer'),
        el('button.btn.btn--ghost', { onclick: () => go('#/train') }, 'Autres exercices')),
    );
    window.scrollTo(0, 0);
  }
}
