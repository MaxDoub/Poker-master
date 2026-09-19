import { el, clear, section, go, toast, mount } from '../ui.js';
import { parseFile, parseText } from '../parse.js';
import { saveRanges, clearRanges, SCENARIO_SHORT } from '../ranges.js';

/** Le dépôt public ne contient pas les ranges personnelles : on vérifie avant de proposer. */
async function exists(path) {
  try {
    const res = await fetch(path, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function renderImport(root, params) {
  const preview = el('div.preview.is-hidden');
  let pending = null;
  const hasMine = await exists('data/mes-ranges.json');

  // Pas d'attribut `accept` : sur iOS il grise les fichiers non reconnus dans l'app
  // Fichiers, et taper sur un fichier grisé ne produit aucun effet visible. Le format
  // est de toute façon détecté à la lecture, et une erreur claire s'affiche sinon.
  const fileInput = el('input.file-input', {
    type: 'file',
    onchange: async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      // Un fichier iCloud pas encore rapatrié arrive ici avec une taille nulle.
      if (!file.size) {
        showError(`« ${file.name} » est vide ou pas encore téléchargé depuis iCloud. `
          + "Ouvre-le une fois dans l'app Fichiers pour forcer son téléchargement, puis réessaie.");
        e.target.value = '';
        return;
      }
      showReading(file.name);
      await run(() => parseFile(file), file.name);
      e.target.value = '';
    },
  });

  const pasteBox = el('textarea.textarea', {
    rows: 6,
    placeholder: 'Ou colle ici le contenu CSV / JSON de tes ranges…',
  });

  const bundled = section('Jeux de ranges livrés avec l\'app',
    hasMine
      ? el('div', null,
        el('p.hint.hint--label', null,
          'Tes ranges converties depuis range_poker.xlsx : 25 ranges, 5 profondeurs, 5 positions.'),
        el('button.btn.btn--primary', { onclick: () => loadBundled('data/mes-ranges.json', 'mes ranges') },
          'Charger mes ranges'))
      : el('p.hint', null,
        "Tes ranges personnelles ne sont pas publiées avec l'app. Importe range_poker.xlsx "
        + 'ci-dessus : une seule fois suffit, elles restent ensuite dans ce téléphone.'),
    el('p.hint', null,
      "Ranges d'ouverture génériques, uniquement pour tester l'app. Elles ne valent pas les tiennes."),
    el('button.btn.btn--ghost', { onclick: loadDemo }, 'Charger la range de démo'));

  function showError(message) {
    pending = null;
    preview.classList.remove('is-hidden');
    mount(clear(preview), el('div.card.card--error', null,
      el('h2.card__title', null, 'Import impossible'),
      el('p', null, message)));
    preview.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /** Retour visuel immédiat : lire un .xlsx de 5000 lignes prend un instant. */
  function showReading(name) {
    preview.classList.remove('is-hidden');
    mount(clear(preview), section('Lecture en cours',
      el('p', null, name),
      el('p.hint', null, 'Analyse du fichier…')));
    preview.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  mount(root,
    el('h1.page-title', null, 'Importer mes ranges'),
    section('Fichier',
      el('label.dropzone', null,
        fileInput,
        el('strong', null, 'Choisir un fichier'),
        el('span.hint', null, 'Excel, CSV ou JSON — rien n\'est envoyé sur Internet')),
      el('p.hint', null,
        'Colonnes attendues : pocket card · suited · stack · place · décision. '
        + 'Les lignes sans décision (ex. BB) sont ignorées.')),
    preview,
    section('Coller du texte',
      pasteBox,
      el('button.btn.btn--ghost', {
        onclick: () => run(() => parseText(pasteBox.value), 'texte collé'),
      }, 'Analyser le texte')),
    bundled,
  );

  if (params.get('demo')) loadDemo();
  if (params.get('mine') && hasMine) loadBundled('data/mes-ranges.json', 'mes ranges');

  async function run(parseFn, label) {
    try {
      const result = await parseFn();
      pending = result;
      showPreview(result, label);
    } catch (err) {
      showError(err.message);
    }
  }

  async function loadBundled(path, label) {
    try {
      const text = await (await fetch(path)).text();
      await run(() => parseText(text), label);
    } catch {
      toast('Fichier introuvable (hors ligne ?)', 'bad');
    }
  }

  function loadDemo() {
    return loadBundled('data/demo-range.json', 'range de démo');
  }

  function showPreview({ ranges, stats }, label) {
    preview.classList.remove('is-hidden');
    requestAnimationFrame(() => preview.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    const hands = ranges.reduce((n, r) => n + Object.keys(r.hands).length, 0);

    mount(clear(preview),section(`Aperçu — ${label}`,
      el('div.stats-row', null,
        el('div.stat', null, el('div.stat__value', null, ranges.length), el('div.stat__label', null, 'ranges')),
        el('div.stat', null, el('div.stat__value', null, hands), el('div.stat__label', null, 'mains')),
        el('div.stat', null, el('div.stat__value', null, stats.skipped), el('div.stat__label', null, 'lignes ignorées'))),

      el('table.table', null,
        el('thead', null, el('tr', null,
          el('th', null, 'Position'), el('th', null, 'Stack'),
          el('th', null, 'Scénario'), el('th', null, 'Mains'))),
        el('tbody', null, ranges.map((r) => el('tr', null,
          el('td', null, r.position),
          el('td.num', null, `${r.stackBB} BB`),
          el('td', null, SCENARIO_SHORT[r.scenario] || r.scenario),
          el('td.num', null, Object.keys(r.hands).length))))),

      stats.unknownDecision
        ? el('p.hint.is-warn', null,
          `${stats.unknownDecision} décision(s) non reconnue(s) — ces lignes ont été ignorées.`)
        : null,

      el('label.switch', null,
        el('input', { type: 'checkbox', id: 'replace-all' }),
        el('span', null, 'Remplacer toutes mes ranges existantes')),

      el('div.stack', null,
        el('button.btn.btn--primary.btn--xl', { onclick: commit }, 'Valider l\'import'),
        el('button.btn.btn--link', { onclick: () => { pending = null; preview.classList.add('is-hidden'); } },
          'Annuler'))));
  }

  async function commit() {
    if (!pending) return;
    const replace = document.getElementById('replace-all');
    if (replace && replace.checked) await clearRanges();
    await saveRanges(pending.ranges);
    toast(`${pending.ranges.length} ranges enregistrées`, 'good');
    pending = null;
    go('#/ranges');
  }
}
