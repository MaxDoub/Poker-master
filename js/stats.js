// Historique des mains jouées et agrégats de progression.

import { db } from './db.js';
import { rangeId } from './ranges.js';

/** Enregistre une main jouée. `result` : correct | mix | wrong. */
export function recordAttempt({ position, stackBB, scenario, hand, answer, expected, result, sizing }) {
  return db.put('attempts', {
    ts: Date.now(),
    spot: rangeId(position, stackBB, scenario),
    position,
    stackBB,
    scenario,
    hand,
    answer,
    expected,
    result,
    sizing: sizing || null,
  });
}

export function allAttempts() {
  return db.all('attempts');
}

export function clearAttempts() {
  return db.clear('attempts');
}

const isHit = (a) => a.result === 'correct' || a.result === 'mix';

function rate(list) {
  if (!list.length) return null;
  return (list.filter(isHit).length / list.length) * 100;
}

function groupBy(list, keyFn) {
  const map = new Map();
  for (const item of list) {
    const k = keyFn(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Agrégats complets pour l'écran Stats. Les mains hors range ne sont pas notées. */
export function summarize(all) {
  const attempts = all.filter((a) => a.result !== 'unknown');
  const total = attempts.length;
  const today = attempts.filter((a) => startOfDay(a.ts) === startOfDay(Date.now()));

  const byGroup = (keyFn, labelFn) => [...groupBy(attempts, keyFn)]
    .map(([key, list]) => ({ key, label: labelFn ? labelFn(key, list) : key, n: list.length, rate: rate(list) }))
    .sort((a, b) => b.n - a.n);

  // Fuites : (spot, main) avec au moins 2 tentatives et un taux d'erreur élevé.
  const leaks = [...groupBy(attempts, (a) => `${a.spot}#${a.hand}`)]
    .map(([key, list]) => {
      const [spot, hand] = key.split('#');
      const [position, stackBB, scenario] = spot.split('|');
      const errors = list.filter((a) => !isHit(a)).length;
      return {
        key, hand, position, stackBB: Number(stackBB), scenario,
        n: list.length, errors, errorRate: (errors / list.length) * 100,
        last: list[list.length - 1],
      };
    })
    .filter((l) => l.errors > 0)
    .sort((a, b) => b.errors - a.errors || b.errorRate - a.errorRate)
    .slice(0, 8);

  // Série des 14 derniers jours.
  const days = [];
  const day0 = startOfDay(Date.now());
  for (let i = 13; i >= 0; i--) {
    const d = day0 - i * 86400000;
    const list = attempts.filter((a) => startOfDay(a.ts) === d);
    days.push({ day: d, n: list.length, rate: rate(list) });
  }

  return {
    total,
    rate: rate(attempts),
    today: { n: today.length, rate: rate(today) },
    byPosition: byGroup((a) => a.position),
    byStack: byGroup((a) => a.stackBB, (k) => `${k} BB`).sort((a, b) => Number(a.key) - Number(b.key)),
    byScenario: byGroup((a) => a.scenario),
    byResult: {
      correct: attempts.filter((a) => a.result === 'correct').length,
      mix: attempts.filter((a) => a.result === 'mix').length,
      wrong: attempts.filter((a) => a.result === 'wrong').length,
    },
    leaks,
    days,
  };
}

/**
 * Poids de révision par (spot, main) : plus tu t'es trompé récemment, plus le poids monte.
 * Utilisé par le mode révision ciblée.
 */
export function leakWeights(attempts) {
  const weights = new Map();
  const now = Date.now();
  for (const a of attempts) {
    if (a.result !== 'wrong') continue;
    const ageDays = (now - a.ts) / 86400000;
    const recency = Math.max(0.2, 1 - ageDays / 30); // une erreur d'il y a 30 j pèse peu
    const key = `${a.spot}#${a.hand}`;
    weights.set(key, (weights.get(key) || 0) + recency);
  }
  return weights;
}
