// Cartes, mains canoniques et grille 13x13.

export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

export const SUITS = ['s', 'h', 'd', 'c'];

export const SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' };
export const SUIT_COLOR = { s: 'noir', h: 'rouge', d: 'rouge', c: 'noir' };

const RANK_INDEX = Object.fromEntries(RANKS.map((r, i) => [r, i]));

// Synonymes tolerés a l'import (Excel francais, notations diverses).
const RANK_ALIASES = {
  '10': 'T', 'V': 'J', 'D': 'Q', 'R': 'K', 'AS': 'A',
  'VALET': 'J', 'DAME': 'Q', 'ROI': 'K',
};

/** Normalise un rang saisi librement ("10", "v", "R") vers A..2. Renvoie null si inconnu. */
export function normalizeRank(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().toUpperCase();
  if (!s) return null;
  if (RANK_INDEX[s] !== undefined) return s;
  if (RANK_ALIASES[s]) return RANK_ALIASES[s];
  return null;
}

/** Les 169 mains, dans l'ordre de lecture de la grille (ligne par ligne). */
export function allHands() {
  const out = [];
  for (let i = 0; i < 13; i++) {
    for (let j = 0; j < 13; j++) out.push(handAt(i, j));
  }
  return out;
}

/** Main occupant la case (ligne i, colonne j) : suited au-dessus de la diagonale. */
export function handAt(i, j) {
  if (i === j) return RANKS[i] + RANKS[i];
  if (i < j) return RANKS[i] + RANKS[j] + 's';
  return RANKS[j] + RANKS[i] + 'o';
}

/** Position d'une main dans la grille. */
export function gridIndex(hand) {
  const [a, b] = [hand[0], hand[1]];
  const ia = RANK_INDEX[a];
  const ib = RANK_INDEX[b];
  if (hand.length === 2) return { row: ia, col: ia };
  const hi = Math.min(ia, ib);
  const lo = Math.max(ia, ib);
  return hand.endsWith('s') ? { row: hi, col: lo } : { row: lo, col: hi };
}

/** Construit la clé canonique ("AKs", "AKo", "77") a partir de deux rangs + suited. */
export function makeHand(rank1, rank2, suited) {
  const a = normalizeRank(rank1);
  const b = normalizeRank(rank2);
  if (!a || !b) return null;
  if (a === b) return a + b;
  const hi = RANK_INDEX[a] < RANK_INDEX[b] ? a : b;
  const lo = RANK_INDEX[a] < RANK_INDEX[b] ? b : a;
  return hi + lo + (suited ? 's' : 'o');
}

/** Main canonique à partir de deux cartes tirées. */
export function handFromCards(c1, c2) {
  return makeHand(c1.rank, c2.rank, c1.suit === c2.suit);
}

/** Nombre de combos pour une main canonique : 6 paires, 4 suited, 12 offsuit. */
export function comboCount(hand) {
  if (hand.length === 2) return 6;
  return hand.endsWith('s') ? 4 : 12;
}

/** Libellé lisible : "A♠ K♠". */
export function cardsLabel(cards) {
  return cards.map((c) => c.rank + SUIT_SYMBOL[c.suit]).join(' ');
}

/** Tire deux cartes distinctes d'un jeu de 52. */
export function dealCards() {
  const deck = [];
  for (const rank of RANKS) for (const suit of SUITS) deck.push({ rank, suit });
  const i = (Math.random() * 52) | 0;
  let j = (Math.random() * 51) | 0;
  if (j >= i) j += 1;
  return [deck[i], deck[j]];
}

/** Tire deux cartes qui forment une main canonique imposée (pour le mode révision). */
export function dealCardsForHand(hand) {
  const pick = (n, list) => {
    const copy = list.slice();
    const out = [];
    for (let k = 0; k < n; k++) out.push(copy.splice((Math.random() * copy.length) | 0, 1)[0]);
    return out;
  };
  if (hand.length === 2) {
    const [s1, s2] = pick(2, SUITS);
    return [{ rank: hand[0], suit: s1 }, { rank: hand[0], suit: s2 }];
  }
  const [hi, lo] = [hand[0], hand[1]];
  if (hand.endsWith('s')) {
    const [s1] = pick(1, SUITS);
    return [{ rank: hi, suit: s1 }, { rank: lo, suit: s1 }];
  }
  const [s1, s2] = pick(2, SUITS);
  return [{ rank: hi, suit: s1 }, { rank: lo, suit: s2 }];
}
