// Table 6-max dessinée en SVG : rend la notion de position tangible.
// Les joueurs déjà passés sont à gauche du héros, ceux qui restent à parler à droite.

import { POSITION_LABEL } from './ranges.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Ordre de parole préflop à 6 joueurs. */
export const ACTION_ORDER = ['LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

function node(tag, attrs = {}) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}

function text(content, attrs) {
  const t = node('text', {
    'text-anchor': 'middle',
    'font-family': "-apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif",
    ...attrs,
  });
  t.textContent = content;
  return t;
}

const CX = 160;
const CY = 92;
const RX = 112;
const RY = 52;
// Les sièges s'assoient sur l'anneau du rail, pas au milieu du feutre.
const SEAT_RX = RX + 20;
const SEAT_RY = RY + 19;

/** Les 5 sièges adverses répartis sur l'arc supérieur, de gauche à droite. */
function seatPoint(index, count) {
  const spread = 150;
  const start = 270 - spread / 2;
  const angle = count === 1 ? 270 : start + (index * spread) / (count - 1);
  const rad = (angle * Math.PI) / 180;
  return { x: CX + SEAT_RX * Math.cos(rad), y: CY + SEAT_RY * Math.sin(rad) };
}

function seatGroup({ x, y, position, stackBB, state, isHero }) {
  const g = node('g', { class: `seat seat--${state}${isHero ? ' seat--hero' : ''}` });
  const w = isHero ? 74 : 60;
  const h = isHero ? 30 : 26;

  g.appendChild(node('rect', {
    x: x - w / 2, y: y - h / 2, width: w, height: h, rx: h / 2, class: 'seat__chip',
  }));
  g.appendChild(text(position, {
    x, y: y - 1, 'font-size': isHero ? 14 : 12, 'font-weight': 700, class: 'seat__label',
  }));
  g.appendChild(text(state === 'folded' ? 'fold' : `${stackBB} BB`, {
    x, y: y + 10, 'font-size': 8, class: 'seat__sub',
  }));
  return g;
}

/**
 * Dessine la table.
 * @param {object} options { position, stackBB, scenario }
 * @returns {SVGElement}
 */
export function buildTable({ position, stackBB }) {
  const svg = node('svg', {
    viewBox: '0 0 320 202',
    class: 'poker-table',
    role: 'img',
    'aria-label': `Table 6 joueurs, tu es en ${POSITION_LABEL[position] || position} avec ${stackBB} big blinds`,
  });

  const defs = node('defs');
  const felt = node('radialGradient', { id: 'felt', cx: '0.5', cy: '0.38', r: '0.75' });
  felt.appendChild(node('stop', { offset: '0', 'stop-color': '#1a6b4c' }));
  felt.appendChild(node('stop', { offset: '1', 'stop-color': '#0c3d2b' }));
  defs.appendChild(felt);
  svg.appendChild(defs);

  // Rail puis feutre.
  svg.appendChild(node('ellipse', { cx: CX, cy: CY, rx: RX + 26, ry: RY + 26, class: 'table__rail' }));
  svg.appendChild(node('ellipse', { cx: CX, cy: CY, rx: RX + 16, ry: RY + 16, fill: 'url(#felt)' }));
  svg.appendChild(node('ellipse', {
    cx: CX, cy: CY, rx: RX + 6, ry: RY + 6, class: 'table__line',
  }));

  const heroIndex = ACTION_ORDER.indexOf(position);
  const others = ACTION_ORDER.filter((p) => p !== position);
  // Reste dans l'ordre de parole : avant le héros à gauche, après lui à droite.
  const ordered = [
    ...ACTION_ORDER.slice(0, heroIndex),
    ...ACTION_ORDER.slice(heroIndex + 1),
  ].filter((p) => others.includes(p));

  ordered.forEach((pos, i) => {
    const { x, y } = seatPoint(i, ordered.length);
    const acted = ACTION_ORDER.indexOf(pos) < heroIndex;
    svg.appendChild(seatGroup({
      x, y, position: pos, stackBB, state: acted ? 'folded' : 'waiting',
    }));
    if (pos === 'BTN') svg.appendChild(dealerButton(x, y));
  });

  const heroY = CY + SEAT_RY;
  svg.appendChild(seatGroup({
    x: CX, y: heroY, position, stackBB, state: 'hero', isHero: true,
  }));
  if (position === 'BTN') svg.appendChild(dealerButton(CX, heroY));

  svg.appendChild(text('TOI', {
    x: CX, y: heroY + 27, 'font-size': 8, 'letter-spacing': 2, class: 'seat__you',
  }));

  return svg;
}

function dealerButton(x, y) {
  const g = node('g', { class: 'dealer' });
  g.appendChild(node('circle', { cx: x + 36, cy: y + 10, r: 8 }));
  g.appendChild(text('D', { x: x + 36, y: y + 13.5, 'font-size': 9, 'font-weight': 700 }));
  return g;
}

/** Légende textuelle de l'action en cours, sous la table. */
export function actionLine(position) {
  const index = ACTION_ORDER.indexOf(position);
  if (index <= 0) return 'Personne n\'a encore parlé. Tu ouvres l\'action.';
  const before = ACTION_ORDER.slice(0, index);
  return `${before.join(', ')} ${before.length > 1 ? 'ont' : 'a'} fold. À toi de parler.`;
}
