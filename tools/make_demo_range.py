#!/usr/bin/env python3
"""Genere data/demo-range.json : des ranges d'ouverture plausibles pour tester l'app.

Ce ne sont PAS des ranges de reference : elles servent uniquement a voir l'app
tourner avant d'importer le vrai fichier Excel.
"""
import json
from pathlib import Path

RANKS = list("AKQJT98765432")
VALUE = {r: 14 - i for i, r in enumerate(RANKS)}

OUT = Path(__file__).resolve().parent.parent / "data" / "demo-range.json"

# Pourcentage de combos ouverts vise par position, a 100 BB.
TARGETS = {"LJ": 16, "HJ": 21, "CO": 28, "BTN": 47, "SB": 40}


def combos(hand):
    if len(hand) == 2:
        return 6
    return 4 if hand.endswith("s") else 12


def all_hands():
    out = []
    for i, a in enumerate(RANKS):
        for j, b in enumerate(RANKS):
            if i == j:
                out.append(a + a)
            elif i < j:
                out.append(a + b + "s")
            else:
                out.append(b + a + "o")
    return sorted(set(out))


def strength(hand):
    """Score heuristique : assez bon pour ordonner une range de demo."""
    a, b = VALUE[hand[0]], VALUE[hand[1]]
    if len(hand) == 2:
        return 60 + a * 4.2
    gap = abs(a - b) - 1
    score = a * 2.2 + b * 1.35 - gap * 2.1
    if hand.endswith("s"):
        score += 5.5
    if gap == 0:
        score += 3.2
    if a == 14:
        score += 3.0
    return score


def build(position, target_pct, stack):
    ranked = sorted(all_hands(), key=strength, reverse=True)
    total = sum(combos(h) for h in ranked)
    budget = total * target_pct / 100
    hands = {}
    used = 0
    for hand in ranked:
        c = combos(hand)
        if used + c <= budget:
            action = "raise"
            used += c
        elif used < budget:
            # La main a cheval sur la limite devient un mix raise/fold.
            action = "fold/raise"
            used += c
        else:
            action = "fold"
        hands[hand] = action
    return {"position": position, "stackBB": stack, "scenario": "RFI", "hands": hands}


if __name__ == "__main__":
    ranges = [build(pos, pct, 100) for pos, pct in TARGETS.items()]
    # Une profondeur courte pour tester le filtre stack : ouvertures plus serrees, all-in.
    short = build("BTN", 38, 20)
    short["hands"] = {
        h: ("allin" if d in ("raise", "fold/raise") and strength(h) > 74 else d)
        for h, d in short["hands"].items()
    }
    ranges.append(short)

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps({"ranges": ranges}, indent=1, ensure_ascii=False))
    for r in ranges:
        played = sum(combos(h) for h, d in r["hands"].items() if d != "fold")
        tot = sum(combos(h) for h in r["hands"])
        print(f'{r["position"]:>4} {r["stackBB"]:>3} BB : {played / tot * 100:5.1f} % joues')
    print(f"-> {OUT.relative_to(OUT.parent.parent)}  ({OUT.stat().st_size / 1024:.0f} Ko)")
