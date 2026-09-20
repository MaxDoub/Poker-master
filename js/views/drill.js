import { el, clear, section, go, pct, emptyState, mount } from '../ui.js';
import {
  listRanges, availablePositions, availableStacks, availableScenarios,
  POSITION_LABEL, SCENARIOS, ACTION_META, answerLabel, expectedLabel,
} from '../ranges.js';
import { getSetting, setSetting } from '../db.js';
import { allAttempts, recordAttempt } from '../stats.js';
import { createSession, actionPalette } from '../drill.js';
import { buildGrid, buildLegend } from '../grid.js';
import { cardSVG } from '../card-art.js';
import { buildTable, actionLine } from '../table.js';
import { explain } from '../explain.js';

const HAND_COUNTS = [10, 25, 50, Infinity];
const TIMERS = [0, 15, 8, 4];

const DEFAULT_CONFIG = {
  positions: [], stacks: [], scenarios: [], handCount: 25, revision: false, timer: 0,
};

/* ------------------------------------------------------------------ config */

export async function renderDrill(root, params) {
  const ranges = await listRanges();
  if (!ranges.length) {
    mount(root, section('Drill préflop', emptyState(
      "Il faut au moins une range pour s'entraîner.", 'Importer mes ranges', '#/import')));
    return;
  }

  const saved = await getSetting('drillConfig', null);
  const config = { ...DEFAULT_CONFIG, ...(saved || {}) };
  if (params.get('revision')) config.revision = true;
  if (params.get('timer')) config.timer = Number(params.get('timer'));

  const positions = availablePositions(ranges);
  const stacks = availableStacks(ranges);
  const scenarios = availableScenarios(ranges);

  config.positions = config.positions.filter((p) => positions.includes(p));
  config.stacks = config.stacks.filter((s) => stacks.includes(s));
  config.scenarios = config.scenarios.filter((s) => scenarios.includes(s));

  const summaryLine = el('p.hint');
  const startBtn = el('button.btn.btn--primary.btn--xl', { onclick: start }, "C'est parti");

  function selected() {
    return ranges.filter((r) =>
      (!config.positions.length || config.positions.includes(r.position))
      && (!config.stacks.length || config.stacks.includes(r.stackBB))
      && (!config.scenarios.length || config.scenarios.includes(r.scenario)));
  }

  function refresh() {
    const list = selected();
    const hands = list.reduce((n, r) => n + Object.keys(r.hands).length, 0);
    summaryLine.textContent = list.length
      ? `${list.length} range${list.length > 1 ? 's' : ''} retenue${list.length > 1 ? 's' : ''} · ${hands} mains de référence`
      : 'Aucune range ne correspond à ces filtres.';
    startBtn.disabled = !list.length;
  }

  function chips(title, values, current, label, onToggle) {
    const row = el('div.chips');
    const render = () => {
      clear(row);
      row.append(el('button.chip' + (current().length ? '' : '.is-on'),
        { type: 'button', onclick: () => { onToggle(null); render(); refresh(); } }, 'Tout'));
      for (const v of values) {
        const on = current().includes(v);
        row.append(el('button.chip' + (on ? '.is-on' : ''),
          { type: 'button', onclick: () => { onToggle(v); render(); refresh(); } }, label(v)));
      }
    };
    render();
    return section(title, row);
  }

  const toggle = (key) => (value) => {
    if (value === null) { config[key] = []; return; }
    const list = config[key];
    const i = list.indexOf(value);
    if (i >= 0) list.splice(i, 1); else list.push(value);
  };

  const pickRow = (values, current, label, apply) => el('div.chips', null, values.map((v) => {
    const btn = el('button.chip' + (current === v ? '.is-on' : ''), {
      type: 'button',
      onclick: () => {
        apply(v);
        btn.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.remove('is-on'));
        btn.classList.add('is-on');
      },
    }, label(v));
    return btn;
  }));

  mount(root,
    el('h1.page-title', null, 'Drill préflop'),
    chips('Position', positions, () => config.positions,
      (p) => `${p} · ${POSITION_LABEL[p] || ''}`.replace(/ · $/, ''), toggle('positions')),
    chips('Stack effectif', stacks, () => config.stacks, (s) => `${s} BB`, toggle('stacks')),
    scenarios.length > 1
      ? chips('Scénario', scenarios, () => config.scenarios, (s) => SCENARIOS[s] || s, toggle('scenarios'))
      : null,
    section('Longueur', pickRow(HAND_COUNTS, config.handCount,
      (n) => (n === Infinity ? 'Illimité' : `${n} mains`), (n) => { config.handCount = n; })),
    section('Chrono',
      pickRow(TIMERS, config.timer,
        (t) => (t === 0 ? 'Sans' : `${t} s`), (t) => { config.timer = t; }),
      el('p.hint', null,
        'Décider vite est une compétence à part. Au-delà du temps imparti, la main compte comme une erreur.')),
    section('Mode révision',
      el('label.switch', null,
        el('input', {
          type: 'checkbox', checked: config.revision,
          onchange: (e) => { config.revision = e.target.checked; },
        }),
        el('span', null, 'Prioriser les situations où je me trompe le plus')),
      el('p.hint', null, 'Environ 7 mains sur 10 sont tirées parmi tes erreurs récentes.')),
    summaryLine,
    startBtn,
  );
  refresh();

  async function start() {
    await setSetting('drillConfig', config);
    const attempts = config.revision ? await allAttempts() : [];
    const session = createSession(selected(), { ...config }, attempts);
    renderSession(root, session, ranges);
  }
}

/* ------------------------------------------------------------------ session */

function renderSession(root, session, allRanges) {
  clear(root);
  const board = el('div.board');
  root.append(board);
  let countdown = null;

  nextHand();

  function stopTimer() {
    if (countdown) { clearInterval(countdown); countdown = null; }
  }

  function nextHand() {
    stopTimer();
    if (session.done) return finish();
    const spot = session.next();
    clear(board);

    const total = session.total === Infinity ? '∞' : session.total;
    const timerBar = el('div.timer__bar');

    mount(board,
      el('div.board__head', null,
        el('span.board__count', null, `Main ${session.index + 1} / ${total}`),
        el('button.btn.btn--link', { onclick: finish }, 'Terminer')),
      el('div.progress', null, el('div.progress__bar', {
        style: { width: session.total === Infinity ? '0%' : `${(session.index / session.total) * 100}%` },
      })),
      session.config.timer ? el('div.timer', null, timerBar) : null,
      el('div.felt', null,
        buildTable({ position: spot.range.position, stackBB: spot.range.stackBB }),
        el('p.felt__action', null, actionLine(spot.range.position)),
        el('div.hole-cards', null, spot.cards.map((c) => cardSVG(c)))),
      buildActions(spot),
    );

    if (session.config.timer) startTimer(timerBar);
    window.scrollTo(0, 0);
  }

  function startTimer(bar) {
    const ms = session.config.timer * 1000;
    const started = performance.now();
    bar.style.width = '100%';
    countdown = setInterval(() => {
      const left = Math.max(0, 1 - (performance.now() - started) / ms);
      bar.style.width = `${left * 100}%`;
      bar.classList.toggle('is-urgent', left < 0.3);
      if (left === 0) {
        stopTimer();
        submit(null, null);
      }
    }, 50);
  }

  function buildActions(spot) {
    const palette = actionPalette(session.ranges);
    return el('div', null,
      el('div.actions', null, palette.map((a) => el(
        'button.btn.btn--action', {
          type: 'button',
          style: { '--action-color': ACTION_META[a].color },
          onclick: () => submit(a, null),
        }, ACTION_META[a].label))),
      spot.entry ? null : el('p.hint', null, 'Main non renseignée — elle ne comptera pas.'));
  }

  async function submit(action, sizing) {
    stopTimer();
    const row = session.answer(action, sizing);
    await recordAttempt(row);
    renderFeedback(row);
  }

  function renderFeedback(row) {
    const spot = session.current;
    const verdict = {
      correct: { label: 'Correct', tone: 'good' },
      mix: { label: 'Dans le mix', tone: 'good' },
      wrong: { label: row.answer === null ? 'Temps écoulé' : 'Erreur', tone: 'bad' },
      unknown: { label: 'Non renseignée', tone: 'muted' },
    }[row.result];

    const reasons = explain({
      range: spot.range, hand: spot.hand, entry: spot.entry, result: row.result, allRanges,
    });

    clear(board);
    mount(board,
      // Verdict à gauche, « Main suivante » à sa droite : tout reste atteignable
      // sans faire défiler la page.
      el('div.result', null,
        el(`div.result__verdict.result__verdict--${verdict.tone}`, null,
          el('span.result__word', null, verdict.label),
          el('span.result__detail', null,
            `${answerLabel(row.answer)} → ${expectedLabel(row.expected)}`)),
        el('button.btn.btn--primary.result__next', { onclick: nextHand }, 'Main suivante')),

      el('div.hand-recap', null,
        el('div.hole-cards.hole-cards--small', null, spot.cards.map((c) => cardSVG(c))),
        el('div.hand-recap__meta', null,
          el('span.tag.tag--strong', null, spot.range.position),
          el('span.tag', null, `${spot.range.stackBB} BB`))),

      reasons.length
        ? section('Pourquoi', el('ul.reasons', null, reasons.map((r) => el('li', null, r))))
        : null,

      section(`Range ${spot.range.position} · ${spot.range.stackBB} BB`,
        buildGrid(spot.range, { highlight: spot.hand }),
        buildLegend(spot.range)),
    );
    window.scrollTo(0, 0);
  }

  function finish() {
    stopTimer();
    renderSummary(root, session);
  }
}

/* ------------------------------------------------------------------ bilan */

function renderSummary(root, session) {
  const s = session.summary();
  clear(root);
  mount(root,
    el('h1.page-title', null, 'Session terminée'),
    el('div.stats-row', null,
      el('div.stat', null, el('div.stat__value', null, s.played), el('div.stat__label', null, 'mains')),
      el('div.stat', null, el('div.stat__value', null, pct(s.rate)), el('div.stat__label', null, 'réussite')),
      el('div.stat', null, el('div.stat__value', null, s.misses.length), el('div.stat__label', null, 'erreurs'))),
    s.skipped
      ? el('p.hint', null, `${s.skipped} main(s) non renseignée(s) dans la range, non comptée(s).`)
      : null,
    s.misses.length
      ? section('À revoir', el('ul.list', null, s.misses.map((m) => el('li.list__row', null,
        el('span.list__main', null, `${m.hand} · ${m.position} ${m.stackBB} BB`),
        el('span.list__side', null, `${answerLabel(m.answer)} → ${expectedLabel(m.expected)}`)))))
      : section(null, el('p.hint', null, 'Aucune erreur sur cette session. Solide.')),
    el('div.stack', null,
      el('button.btn.btn--primary', { onclick: () => go('#/drill') }, 'Nouveau drill'),
      el('button.btn.btn--ghost', { onclick: () => go('#/stats') }, 'Voir mes stats')),
  );
  window.scrollTo(0, 0);
}
