#!/usr/bin/env python3
"""Genere un modele vide pour les ranges de defense en grosse blinde.

L'ordre des mains reprend exactement celui de range_poker.xlsx (paire, puis
assorties decroissantes, puis depareillees), pour permettre le copier-coller
d'une colonne entiere entre les deux fichiers.

La colonne decision est volontairement VIDE : ces ranges sont les tiennes, le
script ne fait que preparer les lignes. Les lignes non remplies sont ignorees a
l'import, tu peux donc completer par blocs et reimporter autant de fois que tu
veux.

    python3 tools/make_bb_template.py
"""
import csv
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data" / "modele-defense-bb.csv"

RANKS = list("AKQJT98765432")
LABEL = {"T": "10"}
STACKS = [10, 15, 20, 50, 100]

# Trois blocs suffisent : la position de l'ouvreur change surtout la largeur de
# sa range, et la regrouper en trois familles evite de produire cinq fichiers.
SCENARIOS = [
    ("vs open BTN", "ouverture du bouton — sa range est la plus large"),
    ("vs open CO", "ouverture du cutoff ou du hijack"),
    ("vs open early", "ouverture du lojack — sa range est la plus serree"),
]


def label(rank):
    return LABEL.get(rank, rank)


def hands_in_file_order():
    """Paire, puis assorties decroissantes, puis depareillees — comme ton Excel."""
    for i, high in enumerate(RANKS):
        yield f"{label(high)}-{label(high)}", "Pairé"
        for low in RANKS[i + 1:]:
            yield f"{label(high)}-{label(low)}", "suited"
        for low in RANKS[i + 1:]:
            yield f"{label(high)}-{label(low)}", "non suited"


def main():
    OUT.parent.mkdir(exist_ok=True)
    rows = 0
    with OUT.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f, delimiter=";")
        writer.writerow(["pocket card", "suited", "stack", "place", "décision", "scenario"])
        for stack in STACKS:
            for scenario, _ in SCENARIOS:
                for hand, suited in hands_in_file_order():
                    writer.writerow([hand, suited, stack, "BB", "", scenario])
                    rows += 1

    print(f"{OUT.relative_to(OUT.parent.parent)} — {rows} lignes à remplir")
    print(f"  {len(STACKS)} profondeurs x {len(SCENARIOS)} scénarios x 169 mains")
    print("\nScénarios :")
    for name, note in SCENARIOS:
        print(f"  {name:<16} {note}")
    print("\nDécisions acceptées : fold, call, raise, all-in, ou un mixte (call/raise).")
    print("Les lignes laissées vides sont ignorées : tu peux remplir par blocs.")


if __name__ == "__main__":
    main()
