// Import de ranges : JSON, CSV/TSV, et XLSX lu directement dans le navigateur.

import { makeHand, normalizeRank } from './cards.js';
import { parseDecision, handEntry, rangeId, ACTIONS } from './ranges.js';

/* ------------------------------------------------------------------ colonnes */

const COLUMN_ROLES = [
  { role: 'hand',     keys: ['pocket card', 'pocketcard', 'pocket cards', 'main', 'hand', 'cartes', 'carte'] },
  { role: 'suited',   keys: ['suited', 'suit', 'assorti', 'type', 'sh'] },
  { role: 'stack',    keys: ['stack', 'stackbb', 'stack bb', 'bb', 'profondeur', 'depth'] },
  { role: 'position', keys: ['place', 'position', 'pos', 'siege', 'seat'] },
  { role: 'decision', keys: ['decision', 'action', 'reponse', 'play'] },
  { role: 'scenario', keys: ['scenario', 'situation', 'spot', 'contexte'] },
];

function slug(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Associe chaque rôle à un index de colonne d'après la ligne d'en-tête. */
function mapColumns(header) {
  const cells = header.map(slug);
  const map = {};
  for (const { role, keys } of COLUMN_ROLES) {
    let idx = cells.findIndex((c) => keys.includes(c));
    if (idx < 0) idx = cells.findIndex((c) => c && keys.some((k) => c.includes(k)));
    if (idx >= 0) map[role] = idx;
  }
  return map;
}

const SUITED_YES = ['suited', 's', 'assorti', 'assortie', 'oui', 'yes', 'true', '1', 'same'];
const SUITED_NO = ['offsuit', 'o', 'off', 'depareille', 'depareillee', 'non', 'no', 'false', '0'];

function readSuited(raw, isPair) {
  if (isPair) return false;
  const v = slug(raw);
  if (SUITED_YES.includes(v)) return true;
  if (SUITED_NO.includes(v)) return false;
  return false;
}

/** "A-K", "AKs", "A K", "AhKh" -> { r1, r2, suitedHint }. */
function readHandCell(raw) {
  const v = String(raw ?? '').trim().toUpperCase();
  if (!v) return null;
  const parts = v.split(/[-\s/_]+/).filter(Boolean);
  if (parts.length >= 2) {
    return { r1: normalizeRank(parts[0]), r2: normalizeRank(parts[1]), suitedHint: null };
  }
  const compact = v.replace(/10/g, 'T');
  if (compact.length >= 2) {
    const r1 = normalizeRank(compact[0]);
    const r2 = normalizeRank(compact[1]);
    const tail = compact.slice(2);
    const suitedHint = tail === 'S' ? true : tail === 'O' ? false : null;
    return { r1, r2, suitedHint };
  }
  return null;
}

function readStack(raw) {
  const n = parseFloat(String(raw ?? '').replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n) : null;
}

function readPosition(raw) {
  const v = String(raw ?? '').trim().toUpperCase().replace(/\./g, '');
  const aliases = {
    BU: 'BTN', BTN: 'BTN', BOUTON: 'BTN', BUTTON: 'BTN',
    SB: 'SB', PB: 'SB', 'PETITE BLINDE': 'SB',
    BB: 'BB', GB: 'BB', 'GROSSE BLINDE': 'BB',
    CO: 'CO', CUTOFF: 'CO',
    HJ: 'HJ', HIJACK: 'HJ',
    LJ: 'LJ', LOJACK: 'LJ', UTG: 'LJ',
  };
  return aliases[v] || (v || null);
}

/* -------------------------------------------------------------- lignes -> ranges */

/**
 * Transforme des lignes brutes (première ligne = en-tête) en ranges.
 * Renvoie { ranges, stats: { rows, used, skipped, unknownDecision, badHand } }.
 */
export function rowsToRanges(rows) {
  const clean = rows.filter((r) => r.some((c) => String(c ?? '').trim() !== ''));
  if (clean.length < 2) throw new Error('Fichier vide ou sans ligne de données.');

  const map = mapColumns(clean[0]);
  const missing = ['hand', 'stack', 'position', 'decision'].filter((r) => map[r] === undefined);
  if (missing.length) {
    throw new Error(
      `Colonnes introuvables : ${missing.join(', ')}. En-tête lue : ${clean[0].join(' | ')}`,
    );
  }

  const byId = new Map();
  const stats = { rows: clean.length - 1, used: 0, skipped: 0, unknownDecision: 0, badHand: 0 };

  for (let i = 1; i < clean.length; i++) {
    const row = clean[i];
    const parsedHand = readHandCell(row[map.hand]);
    const stackBB = readStack(row[map.stack]);
    const position = readPosition(row[map.position]);
    if (!parsedHand || !parsedHand.r1 || !parsedHand.r2 || stackBB === null || !position) {
      stats.badHand++;
      stats.skipped++;
      continue;
    }

    const isPair = parsedHand.r1 === parsedHand.r2;
    const suited = parsedHand.suitedHint !== null
      ? parsedHand.suitedHint && !isPair
      : readSuited(map.suited !== undefined ? row[map.suited] : '', isPair);
    const hand = makeHand(parsedHand.r1, parsedHand.r2, suited);
    if (!hand) { stats.badHand++; stats.skipped++; continue; }

    const actions = parseDecision(row[map.decision]);
    if (!actions.length) {
      // Décision vide = spot pas encore défini (ex : BB). On ignore sans bruit.
      if (String(row[map.decision] ?? '').trim()) stats.unknownDecision++;
      stats.skipped++;
      continue;
    }

    const scenario = (map.scenario !== undefined && String(row[map.scenario] ?? '').trim())
      ? String(row[map.scenario]).trim().toUpperCase().replace(/\s+/g, '_')
      : 'RFI';

    const id = rangeId(position, stackBB, scenario);
    if (!byId.has(id)) byId.set(id, { id, position, stackBB, scenario, hands: {}, updatedAt: Date.now() });
    byId.get(id).hands[hand] = handEntry(actions);
    stats.used++;
  }

  if (!byId.size) throw new Error('Aucune ligne exploitable trouvée dans ce fichier.');
  return { ranges: [...byId.values()], stats };
}

/* ------------------------------------------------------------------ JSON */

/** Accepte un objet range, un tableau de ranges, ou { ranges: [...] }. */
export function parseRangeJSON(text) {
  const data = JSON.parse(text);
  const list = Array.isArray(data) ? data : Array.isArray(data.ranges) ? data.ranges : [data];
  const ranges = list.map((r) => {
    const position = readPosition(r.position);
    const stackBB = readStack(r.stackBB ?? r.stack);
    const scenario = (r.scenario || 'RFI').toUpperCase().replace(/\s+/g, '_');
    if (!position || stackBB === null) throw new Error('Range sans position ou sans stack.');
    const hands = {};
    for (const [rawHand, value] of Object.entries(r.hands || {})) {
      const p = readHandCell(rawHand);
      if (!p || !p.r1 || !p.r2) continue;
      const isPair = p.r1 === p.r2;
      const suited = p.suitedHint !== null ? p.suitedHint && !isPair : false;
      const hand = makeHand(p.r1, p.r2, suited);
      if (!hand) continue;

      let actions = [];
      let freq = {};
      if (typeof value === 'string') {
        actions = parseDecision(value);
      } else if (value && typeof value === 'object') {
        if (Array.isArray(value.actions)) {
          actions = value.actions.filter((a) => ACTIONS.includes(a));
          freq = value.freq || {};
        } else {
          // Format du doc : { action, freq, altAction, altFreq }
          const main = parseDecision(value.action);
          const alt = parseDecision(value.altAction);
          actions = [...main, ...alt.filter((a) => !main.includes(a))];
          if (value.freq !== undefined && main[0]) freq[main[0]] = Number(value.freq);
          if (value.altFreq !== undefined && alt[0]) freq[alt[0]] = Number(value.altFreq);
        }
      }
      const entry = handEntry(actions, Object.keys(freq).length ? freq : null);
      if (entry) hands[hand] = entry;
    }
    return { id: rangeId(position, stackBB, scenario), position, stackBB, scenario, hands, updatedAt: Date.now() };
  });
  const used = ranges.reduce((n, r) => n + Object.keys(r.hands).length, 0);
  return { ranges, stats: { rows: used, used, skipped: 0, unknownDecision: 0, badHand: 0 } };
}

/* ------------------------------------------------------------------ CSV */

/** Découpe un CSV/TSV en lignes de cellules (gère les guillemets et le séparateur auto). */
export function parseDelimited(text) {
  const body = text.replace(/^﻿/, '');
  const firstLine = body.slice(0, body.indexOf('\n') === -1 ? body.length : body.indexOf('\n'));
  const counts = { ',': 0, ';': 0, '\t': 0 };
  let inQ = false;
  for (const ch of firstLine) {
    if (ch === '"') inQ = !inQ;
    else if (!inQ && counts[ch] !== undefined) counts[ch]++;
  }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const delim = ranked[0][1] > 0 ? ranked[0][0] : ',';

  const rows = [];
  let row = [];
  let cell = '';
  inQ = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inQ) {
      if (ch === '"') {
        if (body[i + 1] === '"') { cell += '"'; i++; } else inQ = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') { inQ = true; continue; }
    if (ch === delim) { row.push(cell); cell = ''; continue; }
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    if (ch === '\r') continue;
    cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

/* ------------------------------------------------------------------ XLSX */

const XLSX_UNSUPPORTED = "Ce navigateur ne sait pas décompresser un .xlsx. Exporte ton Excel en CSV, "
  + 'ou convertis-le avec tools/xlsx_to_json.py.';

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === 'undefined') throw new Error(XLSX_UNSUPPORTED);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Extrait les fichiers d'un zip (xlsx) en mémoire. */
async function unzip(buffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 66000; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Fichier .xlsx illisible (archive corrompue ?).');

  const count = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true);
  const files = {};
  const decoder = new TextDecoder();

  for (let n = 0; n < count; n++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) break;
    const method = view.getUint16(ptr + 10, true);
    const compSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localOffset = view.getUint32(ptr + 42, true);
    const name = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));

    const lNameLen = view.getUint16(localOffset + 26, true);
    const lExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + lNameLen + lExtraLen;
    const raw = bytes.subarray(dataStart, dataStart + compSize);

    if (name.endsWith('.xml') || name.endsWith('.rels')) {
      files[name] = method === 0 ? raw : await inflateRaw(raw);
    }
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

function xmlText(node) {
  return node ? node.textContent : '';
}

/** Lit la première feuille d'un .xlsx et renvoie des lignes de cellules texte. */
export async function parseXLSX(buffer) {
  const files = await unzip(buffer);
  const decoder = new TextDecoder();
  const parser = new DOMParser();

  const shared = [];
  if (files['xl/sharedStrings.xml']) {
    const doc = parser.parseFromString(decoder.decode(files['xl/sharedStrings.xml']), 'application/xml');
    for (const si of doc.getElementsByTagName('si')) {
      const ts = si.getElementsByTagName('t');
      let s = '';
      for (const t of ts) s += xmlText(t);
      shared.push(s);
    }
  }

  const sheetName = Object.keys(files)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort()[0];
  if (!sheetName) throw new Error('Aucune feuille trouvée dans le .xlsx.');

  const doc = parser.parseFromString(decoder.decode(files[sheetName]), 'application/xml');
  const rows = [];
  for (const rowEl of doc.getElementsByTagName('row')) {
    const cells = [];
    for (const c of rowEl.getElementsByTagName('c')) {
      const ref = c.getAttribute('r') || '';
      const letters = ref.replace(/\d+/g, '');
      let col = 0;
      for (const ch of letters) col = col * 26 + (ch.charCodeAt(0) - 64);
      col = Math.max(col - 1, 0);

      const type = c.getAttribute('t');
      let value = '';
      if (type === 'inlineStr') {
        const ts = c.getElementsByTagName('t');
        for (const t of ts) value += xmlText(t);
      } else {
        const v = c.getElementsByTagName('v')[0];
        const raw = xmlText(v);
        value = type === 's' ? (shared[Number(raw)] ?? '') : raw;
      }
      while (cells.length < col) cells.push('');
      cells[col] = value;
    }
    rows.push(cells);
  }
  return rows;
}

/* ------------------------------------------------------------------ entrée unique */

/** Point d'entrée : devine le format d'un fichier et renvoie { ranges, stats }. */
export async function parseFile(file) {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) {
    return rowsToRanges(await parseXLSX(await file.arrayBuffer()));
  }
  const text = await file.text();
  if (name.endsWith('.json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
    return parseRangeJSON(text);
  }
  return rowsToRanges(parseDelimited(text));
}

/** Même chose pour du texte collé à la main. */
export function parseText(text) {
  const t = text.trim();
  if (t.startsWith('{') || t.startsWith('[')) return parseRangeJSON(t);
  return rowsToRanges(parseDelimited(t));
}
