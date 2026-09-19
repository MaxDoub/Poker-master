// Moteur de session d'entraînement : tirage des spots, évaluation, progression.

import { dealCards, dealCardsForHand, handFromCards, comboCount, allHands } from './cards.js';
import { evaluate } from './ranges.js';
import { leakWeights } from './stats.js';

/**
 * Crée une session.
 * @param {object[]} ranges   ranges retenues par la config
 * @param {object}   config   { handCount, revision }
 * @param {object[]} attempts historique (pour le mode révision)
 */
export function createSession(ranges, config, attempts = []) {
  const weights = config.revision ? leakWeights(attempts) : null;

  return {
    config,
    ranges,
    index: 0,
    results: [],
    current: null,
    get total() { return config.handCount; },
    get done() { return config.handCount !== Infinity && this.index >= config.handCount; },

    /** Tire le spot suivant. */
    next() {
      const spot = pickSpot(ranges, weights);
      this.current = spot;
      return spot;
    },

    /** Évalue la réponse et enregistre le résultat en mémoire de session. */
    answer(action, sizing) {
      const spot = this.current;
      const result = evaluate(spot.entry, action);
      const row = {
        position: spot.range.position,
        stackBB: spot.range.stackBB,
        scenario: spot.range.scenario,
        hand: spot.hand,
        cards: spot.cards,
        answer: action,
        sizing: sizing || null,
        expected: spot.entry ? spot.entry.actions : [],
        result,
      };
      this.results.push(row);
      this.index++;
      return row;
    },

    /** Bilan de fin de session. */
    summary() {
      const scored = this.results.filter((r) => r.result !== 'unknown');
      const hits = scored.filter((r) => r.result === 'correct' || r.result === 'mix').length;
      return {
        played: scored.length,
        skipped: this.results.length - scored.length,
        hits,
        rate: scored.length ? (hits / scored.length) * 100 : null,
        misses: scored.filter((r) => r.result === 'wrong'),
      };
    },
  };
}

/** Tire une range, puis une main dans cette range. */
function pickSpot(ranges, weights) {
  if (weights && weights.size) {
    const spot = pickWeightedSpot(ranges, weights);
    // 70 % des mains ciblent une fuite, le reste reste aléatoire pour ne pas tunneliser.
    if (spot && Math.random() < 0.7) return spot;
  }
  const range = ranges[(Math.random() * ranges.length) | 0];
  let cards = dealCards();
  let hand = handFromCards(cards[0], cards[1]);
  // Si la main n'est pas renseignée dans cette range, on retire (max 40 essais).
  for (let i = 0; i < 40 && !range.hands[hand]; i++) {
    cards = dealCards();
    hand = handFromCards(cards[0], cards[1]);
  }
  return buildSpot(range, hand, cards);
}

function pickWeightedSpot(ranges, weights) {
  const byId = new Map(ranges.map((r) => [r.id, r]));
  const candidates = [];
  let total = 0;
  for (const [key, w] of weights) {
    const [spotId, hand] = key.split('#');
    const range = byId.get(spotId);
    if (!range || !range.hands[hand]) continue;
    total += w;
    candidates.push({ range, hand, w });
  }
  if (!candidates.length) return null;
  let roll = Math.random() * total;
  for (const c of candidates) {
    roll -= c.w;
    if (roll <= 0) return buildSpot(c.range, c.hand, dealCardsForHand(c.hand));
  }
  const last = candidates[candidates.length - 1];
  return buildSpot(last.range, last.hand, dealCardsForHand(last.hand));
}

function buildSpot(range, hand, cards) {
  return { range, hand, cards, entry: range.hands[hand] || null };
}

/** Actions proposées au joueur : celles utilisées par les ranges sélectionnées, + Fold. */
export function actionPalette(ranges) {
  const used = new Set(['fold']);
  for (const range of ranges) {
    for (const entry of Object.values(range.hands || {})) entry.actions.forEach((a) => used.add(a));
  }
  return ['fold', 'limp', 'call', 'raise', 'allin'].filter((a) => used.has(a));
}

/** Couverture d'une range : part des 169 mains renseignées, en combos. */
export function coverage(range) {
  let filled = 0;
  let total = 0;
  for (const hand of allHands()) {
    total += comboCount(hand);
    if (range.hands[hand]) filled += comboCount(hand);
  }
  return total ? filled / total : 0;
}
