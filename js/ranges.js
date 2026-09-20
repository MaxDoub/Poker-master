// Modèle de range : une entrée par (position, stack BB, scénario).

import { db } from './db.js';
import { allHands, comboCount } from './cards.js';

export const POSITIONS = ['LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

export const POSITION_LABEL = {
  LJ: 'Lojack', HJ: 'Hijack', CO: 'Cutoff', BTN: 'Bouton', SB: 'Petite blinde', BB: 'Grosse blinde',
};

export const SCENARIOS = {
  RFI: "Ouverture (personne n'est entré)",
  VS_OPEN: 'Face à une ouverture',
  VS_OPEN_BTN: 'Face à une ouverture du bouton',
  VS_OPEN_CO: 'Face à une ouverture du cutoff',
  VS_OPEN_EARLY: 'Face à une ouverture précoce',
  VS_3BET: 'Face à un 3bet',
  VS_SHOVE: 'Face à un all-in',
};

export const SCENARIO_SHORT = {
  RFI: 'Ouverture',
  VS_OPEN: 'vs open',
  VS_OPEN_BTN: 'vs BTN',
  VS_OPEN_CO: 'vs CO',
  VS_OPEN_EARLY: 'vs early',
  VS_3BET: 'vs 3bet',
  VS_SHOVE: 'vs all-in',
};

/**
 * Qui a ouvert, pour chaque scénario où quelqu'un est entré avant toi.
 * Absent pour RFI : personne n'a parlé.
 */
export const AGGRESSOR = {
  VS_OPEN: 'CO',
  VS_OPEN_BTN: 'BTN',
  VS_OPEN_CO: 'CO',
  VS_OPEN_EARLY: 'LJ',
  VS_3BET: 'BTN',
  VS_SHOVE: 'BTN',
};

/** Vrai si le scénario place le joueur face à une mise déjà engagée. */
export function facingRaise(scenario) {
  return Boolean(AGGRESSOR[scenario]);
}

export const ACTIONS = ['fold', 'limp', 'call', 'raise', 'allin'];

export const ACTION_META = {
  fold:  { label: 'Fold',   short: 'F',  color: '#5b6b66' },
  limp:  { label: 'Limp',   short: 'L',  color: '#3b82c4' },
  call:  { label: 'Call',   short: 'C',  color: '#2fa36b' },
  raise: { label: 'Raise',  short: 'R',  color: '#d99a24' },
  allin: { label: 'All-in', short: 'AI', color: '#d4453c' },
};

/** Libellé d'une réponse du joueur ; `null` = temps écoulé en mode chrono. */
export function answerLabel(action) {
  return action === null ? 'Temps écoulé' : (ACTION_META[action]?.label ?? action);
}

/** Libellé d'une liste d'actions attendues. */
export function expectedLabel(actions) {
  return actions && actions.length ? actions.map((a) => ACTION_META[a].label).join(' ou ') : '—';
}

const ACTION_ALIASES = {
  fold: 'fold', f: 'fold', passe: 'fold', pass: 'fold', couche: 'fold',
  limp: 'limp', l: 'limp', suivre: 'limp', complete: 'limp',
  call: 'call', c: 'call', paye: 'call',
  raise: 'raise', r: 'raise', relance: 'raise', open: 'raise', bet: 'raise', 'raise non all-in': 'raise',
  allin: 'allin', 'all in': 'allin', 'all-in': 'allin', ai: 'allin', shove: 'allin', push: 'allin', tapis: 'allin',
};

/** Clé de range. */
export function rangeId(position, stackBB, scenario = 'RFI') {
  return `${position}|${stackBB}|${scenario}`;
}

/** Normalise une décision brute ("limp/raise", "All-In", "R") vers une liste d'actions. */
export function parseDecision(raw) {
  if (raw == null) return [];
  const text = String(raw).trim().toLowerCase();
  if (!text) return [];
  const parts = text.split(/[\/|,+]| ou /).map((p) => p.trim()).filter(Boolean);
  const out = [];
  for (const part of parts) {
    const key = part.replace(/[._]/g, ' ').replace(/\s+/g, ' ').trim();
    const action = ACTION_ALIASES[key] || ACTION_ALIASES[key.replace(/[\s-]/g, '')];
    if (action && !out.includes(action)) out.push(action);
  }
  return out;
}

/** Entrée de main normalisée : { actions: [...], freq: { action: part } }. */
export function handEntry(actions, freq) {
  const list = actions.filter((a) => ACTIONS.includes(a));
  if (!list.length) return null;
  const f = {};
  if (freq && Object.keys(freq).length) {
    for (const a of list) f[a] = freq[a] ?? 0;
  } else {
    for (const a of list) f[a] = 1 / list.length;
  }
  return { actions: list, freq: f };
}

/**
 * Compare la réponse du joueur à la range.
 * - 'correct' : action unique attendue, et c'est celle-ci
 * - 'mix'     : la range prévoit plusieurs actions et celle du joueur en fait partie
 * - 'wrong'   : hors range
 * - 'unknown' : pas de donnée pour cette main
 */
export function evaluate(entry, answer) {
  if (!entry || !entry.actions.length) return 'unknown';
  if (!entry.actions.includes(answer)) return 'wrong';
  return entry.actions.length > 1 ? 'mix' : 'correct';
}

/** Part des combos jouées (non-fold) dans une range, en %. */
export function openPercent(range) {
  let played = 0;
  let total = 0;
  for (const hand of allHands()) {
    const combos = comboCount(hand);
    total += combos;
    const entry = range.hands[hand];
    if (entry && entry.actions.some((a) => a !== 'fold')) played += combos;
  }
  return total ? (played / total) * 100 : 0;
}

/** Nombre de mains renseignées. */
export function filledCount(range) {
  return Object.keys(range.hands || {}).length;
}

export async function listRanges() {
  const rows = await db.all('ranges');
  return rows.sort((a, b) => {
    const p = POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position);
    if (p) return p;
    if (a.stackBB !== b.stackBB) return a.stackBB - b.stackBB;
    return a.scenario.localeCompare(b.scenario);
  });
}

export function getRange(id) {
  return db.get('ranges', id);
}

export function saveRange(range) {
  return db.put('ranges', range);
}

export function saveRanges(ranges) {
  return db.putMany('ranges', ranges);
}

export function deleteRange(id) {
  return db.del('ranges', id);
}

export function clearRanges() {
  return db.clear('ranges');
}

/** Stacks disponibles dans les ranges chargées, triés. */
export function availableStacks(ranges) {
  return [...new Set(ranges.map((r) => r.stackBB))].sort((a, b) => a - b);
}

/** Positions disponibles, dans l'ordre de table. */
export function availablePositions(ranges) {
  const set = new Set(ranges.map((r) => r.position));
  const known = POSITIONS.filter((p) => set.has(p));
  const extra = [...set].filter((p) => !POSITIONS.includes(p)).sort();
  return [...known, ...extra];
}

export function availableScenarios(ranges) {
  return [...new Set(ranges.map((r) => r.scenario))];
}
