import { el, section, stat, pct, emptyState, mount } from '../ui.js';
import { allAttempts, summarize } from '../stats.js';
import { POSITION_LABEL, SCENARIOS, ACTION_META } from '../ranges.js';

export async function renderStats(root) {
  const attempts = await allAttempts();
  if (!attempts.length) {
    mount(root,el('h1.page-title', null, 'Progression'),
      section(null, emptyState("Pas encore de main jouée.", 'Lancer un drill', '#/drill')));
    return;
  }
  const s = summarize(attempts);

  mount(root,
    el('h1.page-title', null, 'Progression'),
    section(null, el('div.stats-row', null,
      stat(s.total, 'mains jouées'),
      stat(pct(s.rate), 'réussite'),
      stat(s.byResult.wrong, 'erreurs', 'bad'))),
    section('14 derniers jours', sparkline(s.days)),
    section('Par position', table(s.byPosition, (k) => `${k} · ${POSITION_LABEL[k] || ''}`.replace(/ · $/, ''))),
    section('Par stack', table(s.byStack, (k) => `${k} BB`)),
    s.byScenario.length > 1
      ? section('Par scénario', table(s.byScenario, (k) => SCENARIOS[k] || k))
      : null,
    section('Répartition',
      el('div.stats-row', null,
        stat(s.byResult.correct, 'justes', 'good'),
        stat(s.byResult.mix, 'dans le mix', 'mix'),
        stat(s.byResult.wrong, 'erreurs', 'bad'))),
    s.leaks.length ? section('Top fuites', leakList(s.leaks)) : null,
  );
}

function table(rows, label) {
  return el('table.table', null,
    el('thead', null, el('tr', null,
      el('th', null, ''), el('th', null, 'Mains'), el('th', null, 'Réussite'))),
    el('tbody', null, rows.map((r) => el('tr', null,
      el('td', null, label(r.key)),
      el('td.num', null, r.n),
      el('td.num', null, bar(r.rate))))));
}

function bar(value) {
  const tone = value === null ? '' : value >= 85 ? ' is-good' : value >= 65 ? ' is-mid' : ' is-bad';
  return el('span.rate' + tone, null,
    el('span.rate__track', null, el('span.rate__fill', { style: { width: `${value || 0}%` } })),
    el('span.rate__value', null, pct(value)));
}

function leakList(leaks) {
  return el('ul.list', null, leaks.map((l) => el('li.list__row', null,
    el('span.list__main', null,
      el('strong', null, l.hand),
      ` · ${l.position} ${l.stackBB} BB`,
      el('span.list__sub', null,
        `ta dernière réponse : ${ACTION_META[l.last.answer].label}`
        + (l.last.expected.length
          ? ` · range : ${l.last.expected.map((a) => ACTION_META[a].label).join('/')}`
          : ''))),
    el('span.list__side.is-bad', null, `${l.errors}/${l.n}`))));
}

/** Courbe de réussite jour par jour, en SVG. */
function sparkline(days) {
  const w = 320;
  const h = 90;
  const pad = 6;
  const points = days.map((d, i) => ({
    x: pad + (i / (days.length - 1)) * (w - pad * 2),
    y: d.rate === null ? null : h - pad - (d.rate / 100) * (h - pad * 2),
    d,
  }));

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('class', 'spark');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Taux de réussite des 14 derniers jours');

  const add = (tag, attrs) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    svg.appendChild(node);
    return node;
  };

  for (const v of [0, 50, 100]) {
    add('line', {
      x1: pad, x2: w - pad,
      y1: h - pad - (v / 100) * (h - pad * 2), y2: h - pad - (v / 100) * (h - pad * 2),
      class: 'spark__grid',
    });
  }

  const drawn = points.filter((p) => p.y !== null);
  if (drawn.length > 1) {
    add('polyline', { points: drawn.map((p) => `${p.x},${p.y}`).join(' '), class: 'spark__line' });
  }
  for (const p of drawn) {
    add('circle', { cx: p.x, cy: p.y, r: 3, class: 'spark__dot' });
  }

  const played = days.filter((d) => d.n > 0).length;
  return el('div', null, svg, el('p.hint', null,
    played ? `${played} jour${played > 1 ? 's' : ''} d'entraînement sur les 14 derniers.` : 'Aucune session récente.'));
}
