// Justification d'une réponse, construite uniquement à partir de faits observables :
// ce que TES ranges disent, et où la main se situe dedans.
// Aucune théorie n'est ajoutée : rien ici ne sort de tes données.

import { RANKS, allHands, comboCount } from './cards.js';
import {
  openPercent, POSITION_LABEL, ACTION_META, expectedLabel, SCENARIO_SHORT, facingRaise,
} from './ranges.js';
import { ACTION_ORDER } from './table.js';

const rankIndex = (r) => RANKS.indexOf(r);

const isPlayed = (entry) => Boolean(entry) && entry.actions.some((a) => a !== 'fold');

const pretty = (hand) => hand.replace(/T/g, '10');

/**
 * Famille d'une main : les mains qui partagent sa carte haute et sa forme.
 * AJo appartient à la famille A-x dépareillée, T9s à la famille 10-x assortie,
 * une paire à la famille des paires. C'est dans cette famille que se lit la limite
 * d'une range : à partir de quel kicker on arrête de jouer.
 */
function family(hand) {
  if (hand.length === 2) {
    return {
      label: 'des paires',
      members: RANKS.map((r) => r + r),
    };
  }
  const high = hand[0];
  const suited = hand.endsWith('s');
  const members = RANKS
    .filter((r) => rankIndex(r) > rankIndex(high))
    .map((r) => high + r + (suited ? 's' : 'o'));
  return {
    label: `${pretty(high)}-x ${suited ? 'assortie' : 'dépareillée'}`,
    members,
  };
}

/**
 * Où s'arrête la famille : la main la plus faible encore jouée, et la première foldée.
 *
 * La limite n'est annoncée comme nette que si la famille est bien monotone — jouée
 * jusqu'à un certain kicker, foldée ensuite. Si une main plus faible est jouée après
 * une main foldée, c'est l'irrégularité elle-même qu'il faut montrer : annoncer une
 * limite dans ce cas donnerait un repère faux.
 */
function boundary(range, hand) {
  const { label, members } = family(hand);
  if (members.length < 3) return null;

  const flags = members.map((m) => ({ hand: m, played: isPlayed(range.hands[m]) }));
  const firstFoldedIndex = flags.findIndex((f) => !f.played);
  // Rien de foldé, ou rien de joué : pas de limite à montrer.
  if (firstFoldedIndex <= 0) return null;

  const playedAfter = flags.slice(firstFoldedIndex + 1).filter((f) => f.played).map((f) => f.hand);
  if (!playedAfter.length) {
    return {
      kind: 'clean',
      label,
      lastPlayed: flags[firstFoldedIndex - 1].hand,
      firstFolded: flags[firstFoldedIndex].hand,
    };
  }
  return { kind: 'irregular', label, firstFolded: flags[firstFoldedIndex].hand, playedAfter };
}

/** Part des combos jouées directement à tapis. */
function shovePercent(range) {
  let shoved = 0;
  let total = 0;
  for (const hand of allHands()) {
    const n = comboCount(hand);
    total += n;
    const entry = range.hands[hand];
    if (entry && entry.actions.includes('allin')) shoved += n;
  }
  return total ? (shoved / total) * 100 : 0;
}

const fmt = (v, d = 0) => v.toLocaleString('fr-FR', {
  minimumFractionDigits: d, maximumFractionDigits: d,
});

/**
 * Construit la justification.
 * @param {object} p { range, hand, entry, result, answer, allRanges }
 * @returns {string[]} deux à quatre phrases
 */
export function explain({ range, hand, entry, result, allRanges = [] }) {
  const out = [];
  const label = pretty(hand);
  const position = range.position;
  const open = openPercent(range);

  if (!entry || !entry.actions.length) {
    return [`${label} n'est pas renseignée pour ce spot : la main n'est pas comptée.`];
  }

  // 1. Ce que dit la range, et si elle hésite.
  if (entry.actions.length > 1) {
    out.push(`Ta range joue ${label} en ${expectedLabel(entry.actions).toLowerCase()} `
      + 'sans fréquence fixée : les deux réponses comptent justes.');
  } else {
    const action = entry.actions[0];
    const spot = facingRaise(range.scenario)
      ? `${position} ${SCENARIO_SHORT[range.scenario] || range.scenario}`
      : `${position} (${POSITION_LABEL[position] || position})`;
    const verb = facingRaise(range.scenario) ? 'continue avec' : 'ouvre';
    out.push(action === 'fold'
      ? `${label} est hors de ta range en ${spot}, qui ne joue que ${fmt(open, 1)} % des combinaisons.`
      : `Ta range ${verb} ${fmt(open, 1)} % des combinaisons en ${spot}, `
        + `et ${label} en fait partie, en ${ACTION_META[action].label.toLowerCase()}.`);
  }

  // 2. Où se situe la limite dans la famille de la main : c'est le repère mémorisable.
  const edge = boundary(range, hand);
  if (edge && edge.kind === 'clean') {
    out.push(`Dans la famille ${edge.label}, ta limite est nette : `
      + `${pretty(edge.lastPlayed)} se joue, ${pretty(edge.firstFolded)} se folde.`);
  } else if (edge) {
    const weaker = edge.playedAfter.slice(0, 3).map(pretty).join(', ');
    out.push(`Dans la famille ${edge.label}, ta limite n'est pas régulière : `
      + `${pretty(edge.firstFolded)} se folde alors que ${weaker}, plus faible${edge.playedAfter.length > 1 ? 's' : ''}, `
      + 'se joue' + (edge.playedAfter.length > 1 ? 'nt' : '') + '.');
  }

  // 3. Un point de comparaison pris ailleurs dans tes propres ranges.
  const comparison = compare(range, hand, allRanges, open);
  if (comparison) out.push(comparison);

  // 4. En profondeur courte, la logique push/fold domine tout le reste.
  if (range.stackBB <= 15) {
    const shove = shovePercent(range);
    if (shove > 1) {
      out.push(`À ${range.stackBB} BB, ${fmt(shove, 1)} % de tes combinaisons partent directement à tapis : `
        + 'à cette profondeur ta range est surtout un push ou fold.');
    }
  }

  return out;
}

/** Compare le même spot à une autre position, sinon à une autre profondeur. */
function compare(range, hand, allRanges, open) {
  const peers = allRanges.filter((r) => r.scenario === range.scenario);
  const sameStack = peers.filter((r) => r.stackBB === range.stackBB && r.position !== range.position);
  const heroIndex = ACTION_ORDER.indexOf(range.position);

  // Une position plus tardive au même stack : l'écart de largeur saute aux yeux.
  const later = sameStack
    .filter((r) => ACTION_ORDER.indexOf(r.position) > heroIndex && r.position !== 'BB')
    .sort((a, b) => ACTION_ORDER.indexOf(a.position) - ACTION_ORDER.indexOf(b.position))
    .pop();

  if (later) {
    const entry = later.hands[hand];
    const here = range.hands[hand];
    const differs = entry && here
      && entry.actions.join() !== here.actions.join();
    const verb = facingRaise(range.scenario) ? 'tu continues avec' : 'tu ouvres';
    const base = `En ${later.position} au même stack ${verb} ${fmt(openPercent(later), 1)} %`;
    return differs
      ? `${base}, et ${pretty(hand)} y devient ${expectedLabel(entry.actions).toLowerCase()}.`
      : `${base}${facingRaise(range.scenario) ? '.' : " : plus tu parles tard, plus ta range s'élargit."}`;
  }

  // Sinon, la même position à une autre profondeur.
  const other = peers
    .filter((r) => r.position === range.position && r.stackBB !== range.stackBB)
    .sort((a, b) => Math.abs(a.stackBB - range.stackBB) - Math.abs(b.stackBB - range.stackBB))[0];
  if (!other) return null;

  const entry = other.hands[hand];
  if (!entry) return null;
  const here = range.hands[hand];
  return entry.actions.join() !== here.actions.join()
    ? `À ${other.stackBB} BB depuis la même position, ${pretty(hand)} devient ${expectedLabel(entry.actions).toLowerCase()}.`
    : `À ${other.stackBB} BB depuis la même position, ta réponse serait la même : `
      + `${fmt(openPercent(other), 1)} % de combinaisons jouées.`;
}
