#!/usr/bin/env python3
"""Download the manuscript reference data and freeze a personal-scoring bundle.

The bundle is the product's reference world: GEO promoter betas, STRING
modules, and STITCH/ATC compounds, with the cohort's top 100 modules and
top 200 features already chosen. A later personal report only scores one
new sample inside that frozen feature space.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

from delta import compute_aging_deltas, compute_matched_deltas
from download import cache_dir, download
from presets import resolve_preset
from reference_data import (
    GEO,
    URLS,
    aggregate_promoter_beta,
    geo_matrix_url,
    iter_string_edges,
    load_chemical_catalog,
    load_promoter_map,
    load_stitch_targets,
    load_string_symbols,
)
from sa_score import compute_sa_matrix
from selection import build_pairs, filter_compounds, select_features, select_modules


def _open_edges(path: Path, min_score: int):
    from collections import defaultdict

    neighbors: dict[str, set[str]] = defaultdict(set)
    for left, right in iter_string_edges(path, min_score):
        if left == right:
            continue
        neighbors[left].add(right)
        neighbors[right].add(left)
    return neighbors


def build_modules(links: Path, symbols: dict[str, str], universe: set[str], min_score: int, min_size: int, max_size: int) -> list[dict]:
    neighbors = _open_edges(links, min_score)
    modules = []
    for protein, neigh in neighbors.items():
        hub = symbols.get(protein)
        if not hub:
            continue
        overlap = sorted({symbols[item] for item in neigh if item in symbols} & universe | ({hub} & universe))
        if min_size <= len(overlap) <= max_size:
            modules.append({"hub": hub, "genes": overlap})
    modules.sort(key=lambda item: item["hub"])
    return modules


def prepare(preset_name: str, cache: Path | None = None, rebuild: bool = False) -> Path:
    preset = resolve_preset(preset_name)
    root = cache or cache_dir()
    out = root / "prepared" / preset["preset"]
    if not rebuild and (out / "bundle.json").exists() and (out / "features.json").exists():
        print(f"BUNDLE {out}")
        return out
    raw = root / "raw"
    raw.mkdir(parents=True, exist_ok=True)
    manifest = download(URLS["promoter_manifest"], raw / "HM450.hg19.gencode.tsv.gz")
    string_info = download(URLS["string_info"], raw / "9606.protein.info.v12.0.txt.gz")
    string_links = download(URLS["string_links"], raw / "9606.protein.links.v12.0.txt.gz")
    stitch_links = download(URLS["stitch_links"], raw / "9606.protein_chemical.links.v5.0.tsv.gz")
    stitch_sources = download(URLS["stitch_sources"], raw / "chemical.sources.v5.0.tsv.gz")
    gse = GEO[preset["preset"]]
    matrix = download(geo_matrix_url(gse), raw / f"{gse}_series_matrix.txt.gz")

    print("loading promoter map", flush=True)
    probe_map = load_promoter_map(manifest)
    print(f"promoter probes: {len(probe_map)}", flush=True)
    samples, genes, beta = aggregate_promoter_beta(matrix, probe_map, preset["preset"])
    symbols = load_string_symbols(string_info)
    print("loading ATC chemical names", flush=True)
    catalog = load_chemical_catalog(stitch_sources)
    print(f"ATC chemicals: {len(catalog)}", flush=True)
    compounds = load_stitch_targets(
        stitch_links,
        symbols,
        set(catalog),
        preset["stitch_score_cutoff"],
        catalog,
    )
    compounds = filter_compounds(compounds, preset["chem_min_targets"], preset["chem_max_targets"])
    print(f"compounds after target window: {len(compounds)}", flush=True)

    kept = [sample for sample in samples if sample["group"] != "exclude"]
    kept_index = [index for index, sample in enumerate(samples) if sample["group"] != "exclude"]
    beta = beta[kept_index]
    sample_ids = [sample["sample_id"] for sample in kept]
    ages = np.array([sample["age"] for sample in kept], dtype=float)
    sexes = np.array([sample["sex"] for sample in kept])
    groups = np.array([sample["group"] for sample in kept])

    if preset["delta_mode"] == "aging_young_mean":
        deltas = compute_aging_deltas(
            sample_ids,
            beta,
            ages,
            young_max_exclusive=preset["young_max_exclusive"],
            old_min_exclusive=preset["old_min_exclusive"],
        )
        young = np.isfinite(ages) & (ages < preset["young_max_exclusive"])
        if not np.any(young):
            raise ValueError("Aging reference has no samples younger than 50")
        reference_mean = np.nanmean(beta[young], axis=0)
    else:
        deltas = compute_matched_deltas(
            sample_ids,
            beta,
            ages,
            sexes,
            groups,
            k=preset["match_k"],
            caliper=preset["match_caliper"],
            min_controls=preset["match_min_controls"],
            fallback="paper",
        )
        reference_mean = None

    finite_genes = np.isfinite(deltas.deltas).all(axis=0) if len(deltas.deltas) else np.isfinite(beta).any(axis=0)
    gene_names = [gene for gene, keep in zip(genes, finite_genes) if keep]
    cohort_delta = deltas.deltas[:, finite_genes]
    gene_to_idx = {gene: index for index, gene in enumerate(gene_names)}
    mean_delta = np.nanmean(cohort_delta, axis=0)
    modules = build_modules(
        string_links,
        symbols,
        set(gene_names),
        preset["ppi_score_cutoff"],
        preset["ppi_min_size"],
        preset["ppi_max_size"],
    )
    print(f"PPI modules in size window: {len(modules)}", flush=True)
    selected = select_modules(mean_delta, modules, gene_to_idx, top_n=preset["top_n_modules"])
    pairs = build_pairs(
        selected,
        compounds,
        gene_to_idx,
        min_intersection=preset["min_intersection"],
        min_non_target=preset["min_non_target"],
    )
    if not pairs:
        raise ValueError("No compound-module pairs survived the overlap thresholds")
    sa = compute_sa_matrix(np.nan_to_num(cohort_delta, nan=0.0), pairs)
    feature_idx, _ = select_features(sa, top_n=preset["top_n_features"])
    features = []
    for index in feature_idx:
        pair = pairs[int(index)]
        features.append(
            {
                "module_hub": pair["module_hub"],
                "hallmark": pair.get("hallmark"),
                "compound_id": pair["compound_id"],
                "compound_name": pair["compound_name"],
                "aliases": pair.get("aliases") or [],
                "target_genes": pair["target_genes"],
                "non_target_genes": [gene_names[item] for item in pair["non_target_idx"]],
                "n_targets": pair["n_targets"],
                "is_positive": pair["is_positive"],
                "is_known_drug": pair["is_known_drug"],
            }
        )

    out.mkdir(parents=True, exist_ok=True)
    np.save(out / "genes.npy", np.array(gene_names))
    if reference_mean is not None:
        np.save(out / "young_mean.npy", reference_mean[finite_genes].astype(np.float32))
    else:
        control_mask = groups == "control"
        np.save(out / "control_beta.npy", beta[np.flatnonzero(control_mask)][:, finite_genes])
        np.save(out / "control_ages.npy", ages[control_mask])
        np.save(out / "control_sexes.npy", sexes[control_mask])
    (out / "modules.json").write_text(
        json.dumps(
            [
                {
                    "hub": module["hub"],
                    "genes": module["genes"],
                    "mean_delta": module["mean_delta"],
                    "p_value": module["p_value"],
                    "n_genes": module["n_genes"],
                }
                for module in selected
            ]
        ),
        encoding="utf-8",
    )
    (out / "features.json").write_text(json.dumps(features), encoding="utf-8")
    meta = {
        "preset": preset["preset"],
        "geo": gse,
        "n_samples_used_for_deltas": len(deltas.sample_ids),
        "n_genes": len(gene_names),
        "n_modules": len(selected),
        "n_compounds": len(compounds),
        "n_features": len(features),
        "delta_mode": preset["delta_mode"],
        "delta_notes": deltas.notes,
        "compound_pool": "STITCH v5 score>=200 and ATC source, then the preset target-count window",
    }
    (out / "bundle.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(json.dumps(meta, indent=2))
    print(f"BUNDLE {out}")
    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preset", required=True)
    parser.add_argument("--cache", type=Path, default=None)
    parser.add_argument("--rebuild", action="store_true")
    args = parser.parse_args(argv)
    try:
        prepare(args.preset, args.cache, rebuild=args.rebuild)
    except (OSError, ValueError, KeyError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
