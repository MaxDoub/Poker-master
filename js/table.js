// Table 6-max en SVG : compacte, avec le stack effectif au centre du feutre
// et le siège du joueur nettement plus gros que les autres.

import { POSITION_LABEL, AGGRESSOR } from './ranges.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Ordre de parole préflop à 6 joueurs. */
export const ACTION_ORDER = ['LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

const CX = 160;
const CY = 62;
const RX = 114;
const RY = 36;
const SEAT_RX = RX + 18;
const SEAT_RY = RY + 19;

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
  if (content !== null) t.textContent = content;
  return t;
}

/** Les sièges adverses, répartis sur l'arc supérieur de gauche à droite. */
function seatPoint(index, count) {
  const spread = 152;
  const start = 270 - spread / 2;
  const angle = count === 1 ? 270 : start + (index * spread) / (count - 1);
  const rad = (angle * Math.PI) / 180;
  return { x: CX + SEAT_RX * Math.cos(rad), y: CY + SEAT_RY * Math.sin(rad) };
}

function opponentSeat({ x, y, position, state, bet }) {
  const g = node('g', { class: `seat seat--${state}` });
  g.appendChild(node('rect', {
    x: x - 23, y: y - 10, width: 46, height: 20, rx: 10, class: 'seat__chip',
  }));
  g.appendChild(text(position, {
    x, y: y + 4, 'font-size': 11, 'font-weight': 700, class: 'seat__label',
  }));
  // La mise de l'ouvreur, posée devant son siège : c'est elle qui fixe les cotes.
  if (bet) {
    g.appendChild(node('rect', {
      x: x - 20, y: y + 12, width: 40, height: 15, rx: 7.5, class: 'seat__bet',
    }));
    g.appendChild(text(bet, {
      x, y: y + 22.5, 'font-size': 9, 'font-weight': 700, class: 'seat__bet-label',
    }));
  }
  return g;
}

function heroSeat({ x, y, position }) {
  const g = node('g', { class: 'seat seat--hero' });
  g.appendChild(node('rect', {
    x: x - 52, y: y - 19, width: 104, height: 38, rx: 19, class: 'seat__chip',
  }));
  g.appendChild(text(position, {
    x, y: y - 1, 'font-size': 19, 'font-weight': 800, class: 'seat__label',
  }));
  g.appendChild(text(POSITION_LABEL[position] || '', {
    x, y: y + 12, 'font-size': 9, class: 'seat__sub',
  }));
  return g;
}

function dealerButton(x, y, offset = 30) {
  const g = node('g', { class: 'dealer' });
  g.appendChild(node('circle', { cx: x + offset, cy: y - 9, r: 7.5 }));
  g.appendChild(text('D', { x: x + offset, y: y - 5.8, 'font-size': 9, 'font-weight': 700 }));
  return g;
}

/**
 * Dessine la table.
 * @param {object} options { position, stackBB }
 * @returns {SVGElement}
 */
export function buildTable({ position, stackBB, scenario = 'RFI', openSize = null }) {
  const raiser = AGGRESSOR[scenario] || null;
  const svg = node('svg', {
    viewBox: '0 0 320 148',
    class: 'poker-table',
    role: 'img',
    'aria-label': `Table 6 joueurs, tu es en ${POSITION_LABEL[position] || position} `
      + `avec ${stackBB} big blinds`
      + (raiser ? `, ${raiser} a ouvert` : ''),
  });

  const defs = node('defs');
  const felt = node('radialGradient', { id: 'felt', cx: '0.5', cy: '0.4', r: '0.75' });
  felt.appendChild(node('stop', { offset: '0', 'stop-color': '#1a6b4c' }));
  felt.appendChild(node('stop', { offset: '1', 'stop-color': '#0c3d2b' }));
  defs.appendChild(felt);
  svg.appendChild(defs);

  svg.appendChild(node('ellipse', { cx: CX, cy: CY, rx: RX + 22, ry: RY + 22, class: 'table__rail' }));
  svg.appendChild(node('ellipse', { cx: CX, cy: CY, rx: RX + 13, ry: RY + 13, fill: 'url(#felt)' }));
  svg.appendChild(node('ellipse', { cx: CX, cy: CY, rx: RX + 5, ry: RY + 5, class: 'table__line' }));

  // Le stack effectif, au centre et en gros : c'est lui qui décide de l'action.
  svg.appendChild(text('STACK EFFECTIF', {
    x: CX, y: CY - 16, 'font-size': 7.5, 'letter-spacing': 1.6, class: 'table__stack-label',
  }));
  const stack = text(null, { x: CX, y: CY + 16, class: 'table__stack' });
  const value = node('tspan', { 'font-size': 34, 'font-weight': 800 });
  value.textContent = String(stackBB);
  const unit = node('tspan', { 'font-size': 15, 'font-weight': 700, dx: 4 });
  unit.textContent = 'BB';
  stack.append(value, unit);
  svg.appendChild(stack);

  const heroIndex = ACTION_ORDER.indexOf(position);
  const others = ACTION_ORDER.filter((p) => p !== position);

  others.forEach((pos, i) => {
    const { x, y } = seatPoint(i, others.length);
    const before = ACTION_ORDER.indexOf(pos) < heroIndex;
    // L'ouvreur reste actif même s'il a parlé avant toi : c'est lui qu'il faut voir.
    const state = pos === raiser ? 'raiser' : (before ? 'folded' : 'waiting');
    svg.appendChild(opponentSeat({
      x, y, position: pos, state,
      bet: pos === raiser && openSize ? `${String(openSize).replace('.', ',')} BB` : null,
    }));
    if (pos === 'BTN') svg.appendChild(dealerButton(x, y, 30));
  });

  const heroY = CY + SEAT_RY;
  svg.appendChild(heroSeat({ x: CX, y: heroY, position }));
  if (position === 'BTN') svg.appendChild(dealerButton(CX, heroY, 62));

  return svg;
}

/** Légende textuelle de l'action en cours. */
export function actionLine(position, scenario = 'RFI', openSize = null) {
  const index = ACTION_ORDER.indexOf(position);
  const raiser = AGGRESSOR[scenario] || null;

  if (raiser) {
    const size = openSize ? ` à ${String(openSize).replace('.', ',')} BB` : '';
    const others = ACTION_ORDER.slice(0, index).filter((p) => p !== raiser);
    const folds = others.length ? `, ${others.join(', ')} fold` : '';
    return `${raiser} ouvre${size}${folds}. À toi.`;
  }

  if (index <= 0) return "Personne n'a parlé. Tu ouvres l'action.";
  const before = ACTION_ORDER.slice(0, index);
  return `${before.join(', ')} ${before.length > 1 ? 'ont' : 'a'} fold. À toi.`;
}
