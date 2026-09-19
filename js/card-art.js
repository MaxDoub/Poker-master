// Cartes à jouer dessinées en SVG : index dans les coins + gros pip central.

import { SUIT_SYMBOL } from './cards.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export const SUIT_INK = { s: '#1b2320', c: '#1b2320', h: '#c8102e', d: '#c8102e' };

// Chaque enseigne est un groupe de primitives qui se recouvrent : rendues d'une
// seule couleur, elles se lisent comme une forme unique. Boîte de référence 100x100.
const SUIT_SHAPES = {
  s: [
    ['path', { d: 'M50 4 L87 54 L13 54 Z' }],
    ['circle', { cx: 31, cy: 54, r: 23 }],
    ['circle', { cx: 69, cy: 54, r: 23 }],
    ['path', { d: 'M50 56 C50 74 46 86 34 97 L66 97 C54 86 50 74 50 56 Z' }],
  ],
  h: [
    ['circle', { cx: 29, cy: 33, r: 24 }],
    ['circle', { cx: 71, cy: 33, r: 24 }],
    ['path', { d: 'M6 38 L50 96 L94 38 Z' }],
  ],
  d: [
    ['path', { d: 'M50 3 C60 26 72 42 91 50 C72 58 60 74 50 97 C40 74 28 58 9 50 C28 42 40 26 50 3 Z' }],
  ],
  c: [
    ['circle', { cx: 50, cy: 27, r: 21 }],
    ['circle', { cx: 24, cy: 60, r: 21 }],
    ['circle', { cx: 76, cy: 60, r: 21 }],
    ['path', { d: 'M50 56 C50 74 46 86 34 97 L66 97 C54 86 50 74 50 56 Z' }],
  ],
};

function node(tag, attrs = {}) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}

/** Groupe d'enseigne, mis à l'échelle et positionné. */
function suitGlyph(suit, { x, y, size, fill }) {
  const g = node('g', {
    transform: `translate(${x} ${y}) scale(${size / 100})`,
    fill,
  });
  for (const [tag, attrs] of SUIT_SHAPES[suit]) g.appendChild(node(tag, attrs));
  return g;
}

/** Index d'angle : rang au-dessus d'une petite enseigne. */
function cornerIndex(rank, suit, ink) {
  const g = node('g');
  const label = node('text', {
    x: 0, y: 0,
    'text-anchor': 'middle',
    'font-size': 26,
    'font-weight': 700,
    fill: ink,
    'font-family': "'Helvetica Neue', Helvetica, Arial, sans-serif",
  });
  label.textContent = rank === 'T' ? '10' : rank;
  if (rank === 'T') label.setAttribute('font-size', 21);
  g.appendChild(label);
  g.appendChild(suitGlyph(suit, { x: -7, y: 5, size: 14, fill: ink }));
  return g;
}

/**
 * Carte à jouer.
 * @param {{rank:string, suit:string}} card
 * @param {{className?:string}} options
 * @returns {SVGElement}
 */
export function cardSVG(card, options = {}) {
  const ink = SUIT_INK[card.suit];
  const svg = node('svg', {
    viewBox: '0 0 100 140',
    class: `playing-card ${options.className || ''}`.trim(),
    role: 'img',
    'aria-label': `${card.rank === 'T' ? '10' : card.rank} ${SUIT_SYMBOL[card.suit]}`,
  });

  const gradId = `cardface-${Math.random().toString(36).slice(2, 8)}`;
  const defs = node('defs');
  const grad = node('linearGradient', { id: gradId, x1: '0', y1: '0', x2: '0.4', y2: '1' });
  grad.appendChild(node('stop', { offset: '0', 'stop-color': '#ffffff' }));
  grad.appendChild(node('stop', { offset: '1', 'stop-color': '#eef0ec' }));
  defs.appendChild(grad);
  svg.appendChild(defs);

  svg.appendChild(node('rect', {
    x: 0.8, y: 0.8, width: 98.4, height: 138.4, rx: 9,
    fill: `url(#${gradId})`, stroke: 'rgba(0,0,0,0.35)', 'stroke-width': 1.2,
  }));
  svg.appendChild(node('rect', {
    x: 5, y: 5, width: 90, height: 130, rx: 6,
    fill: 'none', stroke: ink, 'stroke-width': 0.8, 'stroke-opacity': 0.18,
  }));

  const topLeft = cornerIndex(card.rank, card.suit, ink);
  topLeft.setAttribute('transform', 'translate(18 32)');
  svg.appendChild(topLeft);

  const bottomRight = cornerIndex(card.rank, card.suit, ink);
  bottomRight.setAttribute('transform', 'translate(82 108) rotate(180)');
  svg.appendChild(bottomRight);

  svg.appendChild(suitGlyph(card.suit, { x: 27, y: 42, size: 46, fill: ink }));
  return svg;
}

/** Dos de carte, pour les cartes non révélées. */
export function cardBackSVG(options = {}) {
  const svg = node('svg', {
    viewBox: '0 0 100 140',
    class: `playing-card playing-card--back ${options.className || ''}`.trim(),
    'aria-hidden': 'true',
  });
  svg.appendChild(node('rect', {
    x: 0.8, y: 0.8, width: 98.4, height: 138.4, rx: 9,
    fill: '#8d1f28', stroke: 'rgba(0,0,0,0.4)', 'stroke-width': 1.2,
  }));
  svg.appendChild(node('rect', {
    x: 7, y: 7, width: 86, height: 126, rx: 6,
    fill: 'none', stroke: 'rgba(255,255,255,0.45)', 'stroke-width': 1.4,
  }));
  svg.appendChild(suitGlyph('s', { x: 33, y: 50, size: 34, fill: 'rgba(255,255,255,0.28)' }));
  return svg;
}
