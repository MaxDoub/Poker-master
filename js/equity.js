// Évaluateur de mains 7 cartes et calcul d'équité par Monte-Carlo.
// Tout est factuel : aucune stratégie n'est inventée ici, seulement des probabilités.

import { RANKS, SUITS } from './cards.js';

/** Valeur numérique d'un rang : 2..14. */
export const rankValue = (r) => 14 - RANKS.indexOf(r);

const CAT = {
  HIGH: 0, PAIR: 1, TWO_PAIR: 2, TRIPS: 3, STRAIGHT: 4,
  FLUSH: 5, FULL: 6, QUADS: 7, STRAIGHT_FLUSH: 8,
};

export const CATEGORY_LABEL = [
  'Hauteur', 'Paire', 'Double paire', 'Brelan', 'Quinte',
  'Couleur', 'Full', 'Carré', 'Quinte flush',
];

/** Encode catégorie + départages en un entier comparable. */
function score(category, ranks) {
  let out = category;
  for (let i = 0; i < 5; i++) out = out * 15 + (ranks[i] || 0);
  return out;
}

/** Rang le plus haut d'une quinte contenue dans le masque de rangs, 0 sinon. */
function straightHigh(mask) {
  // L'As compte aussi comme 1 pour la quinte 5-4-3-2-A.
  const m = mask & (1 << 14) ? mask | 2 : mask;
  for (let high = 14; high >= 5; high--) {
    let ok = true;
    for (let i = 0; i < 5; i++) {
      if (!(m & (1 << (high - i)))) { ok = false; break; }
    }
    if (ok) return high;
  }
  return 0;
}

/** Les 5 rangs les plus hauts d'un masque. */
function topRanks(mask, count) {
  const out = [];
  for (let r = 14; r >= 2 && out.length < count; r--) if (mask & (1 << r)) out.push(r);
  return out;
}

/**
 * Évalue la meilleure main de 5 cartes parmi 7 (ou 5, ou 6).
 * @param {number[]} cards  entiers card = rank * 4 + suit, rang 2..14
 * @returns {number} score comparable (plus grand = meilleur)
 */
export function evaluate(cards) {
  const rankCount = new Array(15).fill(0);
  const suitCount = [0, 0, 0, 0];
  const suitMask = [0, 0, 0, 0];
  let rankMask = 0;

  for (const c of cards) {
    const r = c >> 2;
    const s = c & 3;
    rankCount[r]++;
    suitCount[s]++;
    suitMask[s] |= 1 << r;
    rankMask |= 1 << r;
  }

  const flushSuit = suitCount.findIndex((n) => n >= 5);
  if (flushSuit >= 0) {
    const sf = straightHigh(suitMask[flushSuit]);
    if (sf) return score(CAT.STRAIGHT_FLUSH, [sf]);
  }

  const quads = [];
  const trips = [];
  const pairs = [];
  for (let r = 14; r >= 2; r--) {
    if (rankCount[r] === 4) quads.push(r);
    else if (rankCount[r] === 3) trips.push(r);
    else if (rankCount[r] === 2) pairs.push(r);
  }

  if (quads.length) {
    const kicker = topRanks(rankMask & ~(1 << quads[0]), 1)[0] || 0;
    return score(CAT.QUADS, [quads[0], kicker]);
  }

  if (trips.length && (pairs.length || trips.length > 1)) {
    const pairRank = pairs.length && trips.length > 1
      ? Math.max(pairs[0], trips[1])
      : (pairs[0] ?? trips[1]);
    return score(CAT.FULL, [trips[0], pairRank]);
  }

  if (flushSuit >= 0) return score(CAT.FLUSH, topRanks(suitMask[flushSuit], 5));

  const st = straightHigh(rankMask);
  if (st) return score(CAT.STRAIGHT, [st]);

  if (trips.length) {
    return score(CAT.TRIPS, [trips[0], ...topRanks(rankMask & ~(1 << trips[0]), 2)]);
  }

  if (pairs.length >= 2) {
    const [p1, p2] = pairs;
    const kicker = topRanks(rankMask & ~(1 << p1) & ~(1 << p2), 1)[0] || 0;
    return score(CAT.TWO_PAIR, [p1, p2, kicker]);
  }

  if (pairs.length === 1) {
    return score(CAT.PAIR, [pairs[0], ...topRanks(rankMask & ~(1 << pairs[0]), 3)]);
  }

  return score(CAT.HIGH, topRanks(rankMask, 5));
}

/** Catégorie lisible d'un score. */
export function categoryOf(scoreValue) {
  return CATEGORY_LABEL[Math.floor(scoreValue / 759375)];
}

/* ------------------------------------------------------------------ cartes */

/** {rank:'A', suit:'s'} -> entier. */
export const toInt = (card) => (rankValue(card.rank) << 2) | SUITS.indexOf(card.suit);

/** Entier -> {rank, suit}. */
export const toCard = (n) => ({ rank: RANKS[14 - (n >> 2)], suit: SUITS[n & 3] });

/** Les 52 cartes, en entiers. */
export function fullDeck() {
  const deck = [];
  for (let r = 2; r <= 14; r++) for (let s = 0; s < 4; s++) deck.push((r << 2) | s);
  return deck;
}

/** Tous les combos (paires d'entiers) d'une main canonique type "AKs". */
export function handCombos(hand) {
  const r1 = rankValue(hand[0]);
  const r2 = rankValue(hand[1]);
  const out = [];
  if (hand.length === 2) {
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) out.push([(r1 << 2) | a, (r1 << 2) | b]);
  } else if (hand.endsWith('s')) {
    for (let s = 0; s < 4; s++) out.push([(r1 << 2) | s, (r2 << 2) | s]);
  } else {
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) if (a !== b) out.push([(r1 << 2) | a, (r2 << 2) | b]);
  }
  return out;
}

/* ------------------------------------------------------------------ équité */

function shuffleInto(deck, count) {
  // Fisher-Yates partiel : on ne mélange que ce qu'on va piocher.
  for (let i = 0; i < count; i++) {
    const j = i + ((Math.random() * (deck.length - i)) | 0);
    const t = deck[i]; deck[i] = deck[j]; deck[j] = t;
  }
}

/**
 * Équité d'une main contre un adversaire, par Monte-Carlo.
 * @param {number[]} hero      2 cartes (entiers)
 * @param {object}   opponent  { cards: [int,int] } ou { combos: [[int,int], ...] }
 * @param {number[]} board     0 a 5 cartes déja connues
 * @param {number}   trials    nombre de simulations
 * @returns {{win:number, tie:number, lose:number, equity:number, trials:number}}
 */
export function equity(hero, opponent, board = [], trials = 4000) {
  const known = new Set([...hero, ...board]);
  const fixedOpp = opponent.cards || null;
  if (fixedOpp) fixedOpp.forEach((c) => known.add(c));

  // Combos adverses encore possibles (on retire ceux qui utilisent une carte connue).
  const combos = fixedOpp
    ? null
    : opponent.combos.filter(([a, b]) => !known.has(a) && !known.has(b));
  if (!fixedOpp && !combos.length) {
    return { win: 0, tie: 0, lose: 0, equity: null, trials: 0, impossible: true };
  }

  const baseDeck = fullDeck().filter((c) => !known.has(c));
  const need = 5 - board.length;
  let win = 0;
  let tie = 0;
  let lose = 0;
  let done = 0;

  for (let t = 0; t < trials; t++) {
    let villain;
    let deck;
    if (fixedOpp) {
      villain = fixedOpp;
      deck = baseDeck.slice();
    } else {
      villain = combos[(Math.random() * combos.length) | 0];
      deck = baseDeck.filter((c) => c !== villain[0] && c !== villain[1]);
    }

    shuffleInto(deck, need);
    const run = board.concat(deck.slice(0, need));

    const h = evaluate(hero.concat(run));
    const v = evaluate(villain.concat(run));
    if (h > v) win++; else if (h === v) tie++; else lose++;
    done++;
  }

  return {
    win: (win / done) * 100,
    tie: (tie / done) * 100,
    lose: (lose / done) * 100,
    equity: ((win + tie / 2) / done) * 100,
    trials: done,
  };
}

/* ------------------------------------------------------------------ cotes */

/**
 * Équité minimale pour qu'un call soit rentable, en %.
 * Convention : `pot` est la taille du pot AVANT ton call, mise adverse incluse.
 * Tu paies `toCall` pour en gagner `pot`, donc il te faut toCall / (pot + toCall).
 */
export function requiredEquity(pot, toCall) {
  return (toCall / (pot + toCall)) * 100;
}

/** Cote du pot exprimée en "x contre 1" (même convention que ci-dessus). */
export function potOdds(pot, toCall) {
  return pot / toCall;
}
