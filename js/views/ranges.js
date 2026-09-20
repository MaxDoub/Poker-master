import { el, clear, section, go, pct, toast, emptyState, mount } from '../ui.js';
import {
  listRanges, getRange, saveRange, deleteRange, openPercent, filledCount,
  SCENARIOS, SCENARIO_SHORT, ACTIONS, ACTION_META, handEntry,
} from '../ranges.js';
import { buildGrid, buildLegend } from '../grid.js';

export async function renderRanges(root, params) {
  const id = params.get('id');
  if (id) return renderOne(root, id);

  const ranges = await listRanges();
  if (!ranges.length) {
    mount(root,el('h1.page-title', null, 'Mes ranges'),
      section(null, emptyState('Aucune range chargée.', 'Importer', '#/import')));
    return;
  }

  mount(root,
    el('h1.page-title', null, 'Mes ranges'),
    el('p.hint', null, `${ranges.length} ranges · touche une ligne pour voir la grille.`),
    el('ul.list.list--linked', null, ranges.map((r) => el('li', null,
      el('button.list__row', { onclick: () => go(`#/ranges?id=${encodeURIComponent(r.id)}`) },
        el('span.list__main', null,
          el('strong', null, `${r.position} · ${r.stackBB} BB`),
          el('span.list__sub', null,
            `${SCENARIO_SHORT[r.scenario] || r.scenario} · ${filledCount(r)} mains renseignées`)),
        el('span.list__side', null, `${pct(openPercent(r), 1)} jouées`))))),
    el('div.stack', null,
      el('button.btn.btn--ghost', { onclick: () => go('#/lookup') }, 'Que faire ? — consulter une main'),
      el('button.btn.btn--ghost', { onclick: () => go('#/audit') }, 'Auditer mes ranges'),
      el('button.btn.btn--ghost', { onclick: () => go('#/import') }, 'Importer / mettre à jour')),
  );
}

async function renderOne(root, id) {
  const range = await getRange(id);
  if (!range) {
    mount(root,section(null, emptyState('Range introuvable.', 'Retour', '#/ranges')));
    return;
  }

  const gridBox = el('div');
  const editor = el('div.editor.is-hidden');
  let editing = null;

  function drawGrid() {
    mount(clear(gridBox),
      buildGrid(range, { onCell: openEditor }),
      buildLegend(range));
  }

  function openEditor(hand, entry) {
    editing = hand;
    mount(clear(editor),
      el('div.editor__head', null,
        el('strong', null, hand),
        el('button.btn.btn--link', { onclick: closeEditor }, 'Fermer')),
      el('div.chips', null, ACTIONS.map((a) => {
        const on = entry ? entry.actions.includes(a) : false;
        return el('button.chip' + (on ? '.is-on' : ''), {
          type: 'button',
          style: { '--chip-color': ACTION_META[a].color },
          onclick: () => toggleAction(hand, a),
        }, ACTION_META[a].label);
      })),
      el('p.hint', null, 'Plusieurs actions sélectionnées = décision mixte (les deux comptent justes).'),
      el('button.btn.btn--link.is-danger', { onclick: () => clearHand(hand) }, 'Vider cette case'),
    );
    editor.classList.remove('is-hidden');
  }

  function closeEditor() {
    editing = null;
    editor.classList.add('is-hidden');
  }

  async function toggleAction(hand, action) {
    const current = range.hands[hand] ? range.hands[hand].actions.slice() : [];
    const i = current.indexOf(action);
    if (i >= 0) current.splice(i, 1); else current.push(action);
    const entry = handEntry(current);
    if (entry) range.hands[hand] = entry; else delete range.hands[hand];
    range.updatedAt = Date.now();
    await saveRange(range);
    drawGrid();
    openEditor(hand, range.hands[hand] || null);
  }

  async function clearHand(hand) {
    delete range.hands[hand];
    range.updatedAt = Date.now();
    await saveRange(range);
    drawGrid();
    closeEditor();
    toast(`${hand} vidée`);
  }

  drawGrid();

  mount(root,
    el('button.btn.btn--link', { onclick: () => go('#/ranges') }, '‹ Toutes les ranges'),
    el('h1.page-title', null, `${range.position} · ${range.stackBB} BB`),
    el('p.hint', null,
      `${SCENARIOS[range.scenario] || range.scenario} · ${filledCount(range)} mains renseignées · `
      + `${pct(openPercent(range), 1)} des combos jouées`),
    gridBox,
    editor,
    section('Gérer',
      el('div.stack', null,
        el('button.btn.btn--ghost', { onclick: exportRange }, 'Exporter cette range (JSON)'),
        el('button.btn.btn--ghost.is-danger', { onclick: removeRange }, 'Supprimer cette range'))),
  );

  function exportRange() {
    const payload = {
      position: range.position, stackBB: range.stackBB, scenario: range.scenario,
      hands: Object.fromEntries(Object.entries(range.hands)
        .map(([h, e]) => [h, { actions: e.actions, freq: e.freq }])),
    };
    download(`${range.position}-${range.stackBB}bb-${range.scenario}.json`, JSON.stringify(payload, null, 2));
  }

  async function removeRange() {
    if (!confirm(`Supprimer la range ${range.position} ${range.stackBB} BB ?`)) return;
    await deleteRange(range.id);
    toast('Range supprimée');
    go('#/ranges');
  }
}

export function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = el('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
