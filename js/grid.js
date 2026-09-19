// Grille 13x13 des 169 mains.

import { handAt } from './cards.js';
import { ACTION_META } from './ranges.js';

/** Couleur d'une case : mélange des actions si la main est mixte. */
export function cellStyle(entry) {
  if (!entry || !entry.actions.length) return { background: 'var(--grid-empty)' };
  const [a, b] = entry.actions;
  if (!b) return { background: ACTION_META[a].color };
  const pa = Math.round((entry.freq[a] ?? 0.5) * 100);
  return {
    background: `linear-gradient(135deg, ${ACTION_META[a].color} 0 ${pa}%, ${ACTION_META[b].color} ${pa}% 100%)`,
  };
}

/**
 * Construit la grille.
 * @param {object} range   range courante (peut être null)
 * @param {object} options { highlight, onCell }
 */
export function buildGrid(range, options = {}) {
  const { highlight = null, onCell = null } = options;
  const grid = document.createElement('div');
  grid.className = 'grid13';
  if (onCell) grid.classList.add('grid13--editable');

  for (let i = 0; i < 13; i++) {
    for (let j = 0; j < 13; j++) {
      const hand = handAt(i, j);
      const entry = range && range.hands ? range.hands[hand] : null;
      const cell = document.createElement(onCell ? 'button' : 'div');
      cell.className = 'grid13__cell';
      if (i === j) cell.classList.add('is-pair');
      if (hand === highlight) cell.classList.add('is-highlight');
      cell.textContent = hand;
      cell.title = entry ? entry.actions.map((a) => ACTION_META[a].label).join(' / ') : 'non renseignée';
      Object.assign(cell.style, cellStyle(entry));
      if (onCell) {
        cell.type = 'button';
        cell.addEventListener('click', () => onCell(hand, entry));
      }
      grid.appendChild(cell);
    }
  }
  return grid;
}

/** Légende des couleurs, limitée aux actions présentes si `range` est fourni. */
export function buildLegend(range = null) {
  const used = new Set();
  if (range) {
    for (const entry of Object.values(range.hands || {})) entry.actions.forEach((a) => used.add(a));
  }
  const actions = used.size ? [...used] : Object.keys(ACTION_META);
  const box = document.createElement('div');
  box.className = 'legend';
  for (const a of actions) {
    const item = document.createElement('span');
    item.className = 'legend__item';
    const dot = document.createElement('i');
    dot.style.background = ACTION_META[a].color;
    item.append(dot, document.createTextNode(ACTION_META[a].label));
    box.appendChild(item);
  }
  return box;
}
