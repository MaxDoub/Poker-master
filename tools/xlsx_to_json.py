#!/usr/bin/env python3
"""Convertit range_poker.xlsx en JSON importable dans Poker Master.

Aucune dependance : un .xlsx est un zip de XML, lu ici avec la stdlib.

    python3 tools/xlsx_to_json.py range_poker.xlsx -o data/mes-ranges.json

Colonnes attendues (l'ordre n'a pas d'importance, les accents et la casse non plus) :
    pocket card | suited | stack | place | decision
Une colonne "scenario" est prise en compte si elle existe, sinon tout est du RFI.
Les lignes sans decision (ex. la BB tant que la range n'est pas definie) sont ignorees.
"""
import argparse
import json
import re
import sys
import unicodedata
import zipfile
from pathlib import Path
from xml.etree import ElementTree

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

RANKS = list("AKQJT98765432")
RANK_INDEX = {r: i for i, r in enumerate(RANKS)}
RANK_ALIASES = {"10": "T", "V": "J", "D": "Q", "R": "K", "AS": "A"}

ACTIONS = {
    "fold": "fold", "f": "fold", "passe": "fold", "couche": "fold",
    "limp": "limp", "l": "limp", "suivre": "limp", "complete": "limp",
    "call": "call", "c": "call", "paye": "call",
    "raise": "raise", "r": "raise", "relance": "raise", "open": "raise", "bet": "raise",
    "allin": "allin", "all in": "allin", "all-in": "allin", "ai": "allin",
    "shove": "allin", "push": "allin", "tapis": "allin",
}

POSITIONS = {
    "BU": "BTN", "BTN": "BTN", "BOUTON": "BTN", "BUTTON": "BTN",
    "SB": "SB", "PB": "SB",
    "BB": "BB", "GB": "BB",
    "CO": "CO", "CUTOFF": "CO",
    "HJ": "HJ", "HIJACK": "HJ",
    "LJ": "LJ", "LOJACK": "LJ", "UTG": "LJ",
}

COLUMNS = {
    "hand": ["pocket card", "pocketcard", "pocket cards", "main", "hand", "cartes", "carte"],
    "suited": ["suited", "suit", "assorti", "type"],
    "stack": ["stack", "stackbb", "stack bb", "bb", "profondeur", "depth"],
    "position": ["place", "position", "pos", "siege", "seat"],
    "decision": ["decision", "action", "reponse", "play"],
    "scenario": ["scenario", "situation", "spot", "contexte"],
}

SUITED_YES = {"suited", "s", "assorti", "assortie", "oui", "yes", "true", "1"}


def slug(value):
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", text).strip().lower()


def read_sheet(path):
    """Renvoie les lignes de la premiere feuille sous forme de listes de chaines."""
    with zipfile.ZipFile(path) as zf:
        shared = []
        if "xl/sharedStrings.xml" in zf.namelist():
            root = ElementTree.fromstring(zf.read("xl/sharedStrings.xml"))
            for si in root.findall(f"{NS}si"):
                shared.append("".join(t.text or "" for t in si.iter(f"{NS}t")))

        sheets = sorted(n for n in zf.namelist() if re.fullmatch(r"xl/worksheets/sheet\d+\.xml", n))
        if not sheets:
            raise SystemExit("Aucune feuille trouvee dans ce .xlsx.")
        root = ElementTree.fromstring(zf.read(sheets[0]))

    rows = []
    for row_el in root.iter(f"{NS}row"):
        cells = []
        for c in row_el.findall(f"{NS}c"):
            ref = c.get("r") or ""
            col = 0
            for ch in re.sub(r"\d", "", ref):
                col = col * 26 + (ord(ch) - 64)
            col = max(col - 1, 0)

            if c.get("t") == "inlineStr":
                value = "".join(t.text or "" for t in c.iter(f"{NS}t"))
            else:
                v = c.find(f"{NS}v")
                raw = v.text if v is not None else ""
                value = shared[int(raw)] if c.get("t") == "s" and raw else (raw or "")

            while len(cells) <= col:
                cells.append("")
            cells[col] = value
        rows.append(cells)
    return rows


def map_columns(header):
    cells = [slug(c) for c in header]
    mapping = {}
    for role, keys in COLUMNS.items():
        idx = next((i for i, c in enumerate(cells) if c in keys), None)
        if idx is None:
            idx = next((i for i, c in enumerate(cells) if c and any(k in c for k in keys)), None)
        if idx is not None:
            mapping[role] = idx
    return mapping


def normalize_rank(raw):
    s = str(raw or "").strip().upper()
    if s in RANK_INDEX:
        return s
    return RANK_ALIASES.get(s)


def read_hand(raw, suited_cell):
    parts = [p for p in re.split(r"[-\s/_]+", str(raw or "").strip().upper()) if p]
    if len(parts) >= 2:
        r1, r2, hint = normalize_rank(parts[0]), normalize_rank(parts[1]), None
    else:
        compact = str(raw or "").strip().upper().replace("10", "T")
        if len(compact) < 2:
            return None
        r1, r2 = normalize_rank(compact[0]), normalize_rank(compact[1])
        tail = compact[2:]
        hint = True if tail == "S" else False if tail == "O" else None
    if not r1 or not r2:
        return None
    if r1 == r2:
        return r1 + r2
    suited = hint if hint is not None else slug(suited_cell) in SUITED_YES
    hi, lo = (r1, r2) if RANK_INDEX[r1] < RANK_INDEX[r2] else (r2, r1)
    return hi + lo + ("s" if suited else "o")


def read_decision(raw):
    out = []
    for part in re.split(r"[/|,+]| ou ", slug(raw)):
        part = part.strip()
        action = ACTIONS.get(part) or ACTIONS.get(part.replace(" ", "").replace("-", ""))
        if action and action not in out:
            out.append(action)
    return out


def convert(rows):
    rows = [r for r in rows if any(str(c).strip() for c in r)]
    if len(rows) < 2:
        raise SystemExit("Fichier vide.")

    cols = map_columns(rows[0])
    missing = [r for r in ("hand", "stack", "position", "decision") if r not in cols]
    if missing:
        raise SystemExit(f"Colonnes introuvables : {', '.join(missing)}\nEn-tete lue : {rows[0]}")

    def cell(row, role):
        i = cols.get(role)
        return row[i] if i is not None and i < len(row) else ""

    ranges, skipped, unknown = {}, 0, []
    for row in rows[1:]:
        hand = read_hand(cell(row, "hand"), cell(row, "suited"))
        try:
            stack = round(float(str(cell(row, "stack")).replace(",", ".").strip()))
        except ValueError:
            stack = None
        position = POSITIONS.get(str(cell(row, "position")).strip().upper())

        if not hand or stack is None or not position:
            skipped += 1
            continue

        actions = read_decision(cell(row, "decision"))
        if not actions:
            if str(cell(row, "decision")).strip():
                unknown.append(str(cell(row, "decision")).strip())
            skipped += 1
            continue

        scenario = (str(cell(row, "scenario")).strip().upper().replace(" ", "_")) or "RFI"
        key = (position, stack, scenario)
        entry = ranges.setdefault(key, {
            "position": position, "stackBB": stack, "scenario": scenario, "hands": {},
        })
        entry["hands"][hand] = {"actions": actions, "freq": {a: 1 / len(actions) for a in actions}}

    return list(ranges.values()), skipped, unknown


def main():
    ap = argparse.ArgumentParser(description="Excel de ranges -> JSON Poker Master")
    ap.add_argument("xlsx", type=Path, help="fichier .xlsx source")
    ap.add_argument("-o", "--out", type=Path, default=Path("data/mes-ranges.json"))
    args = ap.parse_args()

    if not args.xlsx.exists():
        raise SystemExit(f"Introuvable : {args.xlsx}")

    ranges, skipped, unknown = convert(read_sheet(args.xlsx))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps({"ranges": ranges}, indent=1, ensure_ascii=False))

    print(f"{len(ranges)} ranges ecrites dans {args.out}")
    for r in sorted(ranges, key=lambda r: (r["position"], r["stackBB"])):
        played = sum(1 for h in r["hands"].values() if h["actions"] != ["fold"])
        print(f'  {r["position"]:>4} {r["stackBB"]:>4} BB {r["scenario"]:<9} '
              f'{len(r["hands"]):>3} mains ({played} non-fold)')
    if skipped:
        print(f"{skipped} lignes ignorees (decision vide, position ou main illisible)", file=sys.stderr)
    if unknown:
        print(f"Decisions non reconnues : {sorted(set(unknown))}", file=sys.stderr)


if __name__ == "__main__":
    main()
