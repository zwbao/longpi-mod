#!/usr/bin/env python3
"""Build first-order STRING PPI modules that overlap a methylation gene universe.

A module is a protein plus its neighbors at or above the score cutoff.
Only genes present in the methylation universe are kept. Modules whose
overlap falls outside the size window are dropped.

Edge file: whitespace-separated, columns protein_a, protein_b, score.
A header row is skipped when the score does not parse. Lines starting
with '#' are skipped. An optional two-column id-to-symbol map is applied
to both endpoints before the overlap filter.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path


def load_universe(path: Path) -> list[str]:
    genes = []
    seen = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        gene = line.strip().split()[0] if line.strip() else ""
        if not gene or gene.startswith("#") or gene in seen:
            continue
        seen.add(gene)
        genes.append(gene)
    return genes


def load_id_map(path: Path | None) -> dict[str, str]:
    if path is None:
        return {}
    mapping = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        parts = line.split()
        if len(parts) < 2 or parts[0].startswith("#"):
            continue
        mapping[parts[0]] = parts[1]
    return mapping


def translate(name: str, mapping: dict[str, str]) -> str:
    return mapping.get(name, name)


def build_modules(
    edge_path: Path,
    universe: set[str],
    min_score: float,
    min_size: int,
    max_size: int,
    id_map: dict[str, str],
) -> list[dict]:
    neighbors: dict[str, set[str]] = defaultdict(set)
    with edge_path.open(encoding="utf-8") as handle:
        for line in handle:
            if not line.strip() or line.startswith("#"):
                continue
            parts = line.split()
            if len(parts) < 3:
                continue
            try:
                score = float(parts[2])
            except ValueError:
                continue
            if score < min_score:
                continue
            left = translate(parts[0], id_map)
            right = translate(parts[1], id_map)
            if left == right:
                continue
            neighbors[left].add(right)
            neighbors[right].add(left)

    modules = []
    for hub in sorted(neighbors):
        overlap = sorted((neighbors[hub] | {hub}) & universe)
        if min_size <= len(overlap) <= max_size:
            modules.append({"hub": hub, "genes": overlap})
    return modules


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--edges", required=True, type=Path)
    parser.add_argument("--genes", required=True, type=Path, help="Methylation gene symbols, one per line")
    parser.add_argument("--id-map", type=Path, default=None, help="Optional two-column id-to-symbol map")
    parser.add_argument("--min-score", type=float, default=400)
    parser.add_argument("--min-size", type=int, default=20)
    parser.add_argument("--max-size", type=int, default=800)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args(argv)

    universe = set(load_universe(args.genes))
    modules = build_modules(
        args.edges,
        universe,
        args.min_score,
        args.min_size,
        args.max_size,
        load_id_map(args.id_map),
    )
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(modules, indent=2), encoding="utf-8")
    print(f"modules={len(modules)} out={args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
