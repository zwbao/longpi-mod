#!/usr/bin/env python3
"""Run the SteeraMed Core evidence-chain pipeline on local matrices.

Group steps (module selection and the top-200 feature cut) use every case.
Patient importance is then computed inside that disease-informed feature space.
Positive controls stay in the same candidate pool; this is known-action
recovery, not blinded discovery.

Inputs
    --beta / --meta   sample-by-gene beta values plus age, sex, and group
    --deltas          precomputed case delta matrix, sample-by-gene
    --modules         JSON list of {hub, genes, hallmark?}
    --compounds       JSON list of {id, name, targets, n_targets?, is_positive?}

``--layout genes`` accepts a gene-by-sample table instead of sample-by-gene.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

import numpy as np

from delta import compute_aging_deltas, compute_matched_deltas
from evidence_chain import BOUNDARY, build_evidence_chain, individual_bootstrap
from presets import resolve_preset
from recall import operational_group_bootstrap, recall_report
from sa_score import compute_sa_matrix
from selection import build_pairs, filter_compounds, select_features, select_modules


def read_matrix(path: Path, layout: str) -> tuple[list[str], list[str], np.ndarray]:
    """Return sample ids, gene ids, and a (n_samples, n_genes) float matrix."""
    with path.open(newline="", encoding="utf-8") as handle:
        sample = handle.read(4096)
        handle.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",\t")
        except csv.Error:
            dialect = csv.excel
        rows = list(csv.reader(handle, dialect))
    if len(rows) < 2:
        raise ValueError(f"{path} has no data rows")
    header, body = rows[0], rows[1:]
    if layout == "samples":
        sample_ids = [row[0] for row in body]
        genes = header[1:]
        matrix = np.array([[_float_cell(value) for value in row[1:]] for row in body], dtype=float)
        if matrix.shape[1] != len(genes):
            raise ValueError(f"{path} row width does not match the header")
        return sample_ids, genes, matrix
    if layout == "genes":
        genes = [row[0] for row in body]
        sample_ids = header[1:]
        wide = np.array([[_float_cell(value) for value in row[1:]] for row in body], dtype=float)
        return sample_ids, genes, wide.T
    raise ValueError("layout must be 'samples' or 'genes'")


def _float_cell(value: str) -> float:
    text = value.strip()
    if text == "":
        return np.nan
    return float(text)


def read_meta(path: Path) -> dict[str, dict]:
    with path.open(newline="", encoding="utf-8") as handle:
        sample = handle.read(4096)
        handle.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",\t")
        except csv.Error:
            dialect = csv.excel
        reader = csv.DictReader(handle, dialect=dialect)
        if reader.fieldnames is None:
            raise ValueError(f"{path} is missing a header")
        fields = {name.strip().lower(): name for name in reader.fieldnames}
        required = ("sample_id", "age", "sex")
        missing = [name for name in required if name not in fields]
        if missing:
            raise ValueError(f"{path} is missing columns: {', '.join(missing)}")
        meta = {}
        for row in reader:
            sid = row[fields["sample_id"]].strip()
            group = row[fields["group"]].strip().lower() if "group" in fields else ""
            meta[sid] = {
                "age": float(row[fields["age"]]),
                "sex": row[fields["sex"]].strip(),
                "group": group,
            }
    return meta


def align_meta(sample_ids: list[str], meta: dict[str, dict]) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    missing = [sid for sid in sample_ids if sid not in meta]
    if missing:
        preview = ", ".join(missing[:5])
        raise ValueError(f"{len(missing)} samples have no metadata, including: {preview}")
    ages = np.array([meta[sid]["age"] for sid in sample_ids], dtype=float)
    sexes = np.array([meta[sid]["sex"] for sid in sample_ids])
    groups = np.array([meta[sid]["group"] for sid in sample_ids])
    return ages, sexes, groups


def drop_nonfinite_genes(
    deltas: np.ndarray,
    genes: list[str],
) -> tuple[np.ndarray, list[str], list[str]]:
    keep = np.isfinite(deltas).all(axis=0)
    dropped = [gene for gene, flag in zip(genes, keep) if not flag]
    kept = [gene for gene, flag in zip(genes, keep) if flag]
    return deltas[:, keep], kept, dropped


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def patient_attributes(sample_id: str, meta: dict[str, dict] | None) -> tuple[int | None, str | None]:
    if not meta or sample_id not in meta:
        return None, None
    row = meta[sample_id]
    age = row.get("age")
    age_out = int(age) if age is not None and float(age).is_integer() else age
    return age_out, row.get("sex")


def render_summary(result: dict) -> str:
    lines = [
        f"预设: {result['preset']}",
        f"delta 模式: {result['delta_mode']}",
        f"病例数: {result['n_patients']}",
        f"基因数（丢弃非有限值之后）: {result['n_genes']}",
        f"丢弃的非有限基因数: {result['n_genes_dropped']}",
        f"入选模块数: {result['n_modules']}",
        f"化合物池（靶点数过滤后）: {result['n_candidates']}",
        f"合格模块-化合物配对: {result['n_eligible_pairs']}",
        f"用于个人排序的特征数: {result['n_features']}",
        "特征空间: disease-informed（模块和特征用全部病例选出，不是留一患者）",
        "SA 使用 |SA| 排序。符号不是药效方向，统计量也不是 p 值。",
    ]
    lines.extend(result["delta_notes"])
    if result["unmatched_ids"]:
        lines.append(f"未匹配病例数: {len(result['unmatched_ids'])}")
    if result.get("recall"):
        lines.append("")
        lines.append("Recall-K（个人 top-K 中至少命中一个阳性对照的患者比例）")
        lines.append(
            f"阳性对照数: {result['recall']['n_positive_controls']}；"
            f"候选池: {result['recall']['n_candidates']}"
        )
        for row in result["recall"]["by_k"]:
            fold = "NA" if row["fold"] is None else f"{row['fold']:.3f}"
            lines.append(
                f"  K={row['k']}: recall={row['recall']:.4f} "
                f"({row['hits']}/{row['n_patients']}), "
                f"baseline={row['baseline']:.4f}, fold={fold}"
            )
    else:
        lines.append("未提供 is_positive 标记，因此没有计算 Recall-K。")
    group = result.get("group_bootstrap")
    if group:
        lines.append("")
        lines.append(
            "operational_group_fold（特征集已固定，只重抽患者；不是论文 Figure 2B）: "
            f"median={group['median']}, mean={group['mean']}, "
            f"fraction_above_1={group['fraction_above_1']}, n_iter={group['n_iter']}"
        )
    if result["individual_bootstrap_iters"] <= 0:
        lines.append("Layer 4 个体 bootstrap: 未计算。")
    else:
        lines.append(f"Layer 4 个体 bootstrap: {result['individual_bootstrap_iters']} 次。")
    lines.append("")
    lines.append(f"边界: {BOUNDARY}")
    return "\n".join(lines) + "\n"


def run(args: argparse.Namespace) -> dict:
    preset = resolve_preset(args.preset)
    if (args.beta is None) == (args.deltas is None):
        raise ValueError("Provide exactly one of --beta or --deltas")
    if args.beta is not None and args.meta is None:
        raise ValueError("--beta requires --meta")

    meta = read_meta(args.meta) if args.meta else None
    if args.deltas is not None:
        sample_ids, genes, deltas = read_matrix(args.deltas, args.layout)
        delta_notes = ["delta_mode=precomputed"]
        unmatched: list[str] = []
    else:
        sample_ids, genes, beta = read_matrix(args.beta, args.layout)
        ages, sexes, groups = align_meta(sample_ids, meta)
        if preset["delta_mode"] == "aging_young_mean":
            computed = compute_aging_deltas(
                sample_ids,
                beta,
                ages,
                young_max_exclusive=preset["young_max_exclusive"],
                old_min_exclusive=preset["old_min_exclusive"],
            )
        else:
            computed = compute_matched_deltas(
                sample_ids,
                beta,
                ages,
                sexes,
                groups,
                k=preset["match_k"],
                caliper=preset["match_caliper"],
                min_controls=preset["match_min_controls"],
                fallback=args.match_fallback,
            )
        sample_ids, deltas = computed.sample_ids, computed.deltas
        delta_notes = computed.notes
        unmatched = computed.unmatched_ids
        if len(sample_ids) == 0:
            raise ValueError("No patients received a delta vector")

    deltas, genes, dropped = drop_nonfinite_genes(deltas, genes)
    gene_to_idx = {gene: i for i, gene in enumerate(genes)}
    mean_gene_delta = np.nanmean(deltas, axis=0)
    modules = select_modules(
        mean_gene_delta,
        load_json(args.modules),
        gene_to_idx,
        top_n=preset["top_n_modules"],
    )
    if not modules:
        raise ValueError("No PPI module overlapped the delta matrix with at least 2 genes")

    compounds = filter_compounds(
        load_json(args.compounds),
        min_targets=preset["chem_min_targets"],
        max_targets=preset["chem_max_targets"],
    )
    pairs = build_pairs(
        modules,
        compounds,
        gene_to_idx,
        min_intersection=preset["min_intersection"],
        min_non_target=preset["min_non_target"],
    )
    if not pairs:
        raise ValueError("No compound-module pair met the minimum target and non-target counts")

    sa_all = compute_sa_matrix(
        deltas,
        pairs,
        min_intersection=preset["min_intersection"],
        min_non_target=preset["min_non_target"],
    )
    feature_idx, _mean_abs = select_features(sa_all, top_n=preset["top_n_features"])
    feature_pairs = [pairs[int(i)] for i in feature_idx]
    sa_features = sa_all[:, feature_idx]

    positive_ids = {str(compound["id"]) for compound in compounds if compound.get("is_positive")}
    rankings = []
    chains = []
    for patient_i, sample_id in enumerate(sample_ids):
        stability = {}
        if args.individual_bootstrap > 0:
            stability = individual_bootstrap(
                sa_all,
                pairs,
                patient_i,
                n_iter=args.individual_bootstrap,
                top_features=preset["top_n_features"],
                patient_top_k=preset["patient_top_k"],
                seed=args.seed + patient_i,
            )
        age, sex = patient_attributes(sample_id, meta)
        chain = build_evidence_chain(
            patient_id=sample_id,
            delta_row=deltas[patient_i],
            selected_modules=modules,
            sa_row=sa_features[patient_i],
            feature_pairs=feature_pairs,
            preset=preset["preset"],
            age=age,
            sex=sex,
            bootstrap_stability=stability,
            nominal_p=preset["nominal_module_p"],
            patient_top_k=preset["patient_top_k"],
            n_candidates=len(compounds),
            meta={
                "delta_mode": preset["delta_mode"] if args.deltas is None else "precomputed",
                "match_fallback": args.match_fallback if preset["delta_mode"] == "matched" else None,
                "n_eligible_pairs": len(pairs),
                "n_features": len(feature_pairs),
                "geo_dataset": preset["geo_dataset"],
            },
        )
        chains.append(chain)
        rankings.append([row["compound_id"] for row in chain["top_compounds"]])

    recall = None
    if positive_ids:
        recall = recall_report(
            rankings,
            positive_ids,
            n_candidates=len(compounds),
            ks=tuple(preset["recall_ks"]),
        )
    group_bootstrap = None
    if args.group_bootstrap > 0 and positive_ids:
        group_bootstrap = operational_group_bootstrap(
            sa_features,
            feature_pairs,
            [str(compound["id"]) for compound in compounds],
            positive_ids,
            n_iter=args.group_bootstrap,
            seed=args.seed,
        )

    out = args.out
    out.mkdir(parents=True, exist_ok=True)
    evidence_dir = out / "evidence"
    evidence_dir.mkdir(exist_ok=True)
    for chain in chains:
        write_json(evidence_dir / f"{chain['patient_id']}.json", chain)
    write_json(
        out / "modules_selected.json",
        [
            {
                "hub": module["hub"],
                "n_genes": module["n_genes"],
                "mean_delta": module["mean_delta"],
                "p_value": module["p_value"],
                "hallmark": module.get("hallmark"),
                "genes": module["genes"],
            }
            for module in modules
        ],
    )
    write_json(
        out / "features_selected.json",
        [
            {
                "module_hub": pair["module_hub"],
                "compound_id": pair["compound_id"],
                "compound_name": pair["compound_name"],
                "target_genes": pair["target_genes"],
                "is_positive": pair["is_positive"],
            }
            for pair in feature_pairs
        ],
    )
    if recall:
        write_json(out / "recall.json", recall)
    if group_bootstrap:
        write_json(out / "group_bootstrap.json", group_bootstrap)

    result = {
        "preset": preset["preset"],
        "delta_mode": preset["delta_mode"] if args.deltas is None else "precomputed",
        "n_patients": len(sample_ids),
        "n_genes": len(genes),
        "n_genes_dropped": len(dropped),
        "n_modules": len(modules),
        "n_candidates": len(compounds),
        "n_eligible_pairs": len(pairs),
        "n_features": len(feature_pairs),
        "delta_notes": delta_notes,
        "unmatched_ids": unmatched,
        "recall": recall,
        "group_bootstrap": group_bootstrap,
        "individual_bootstrap_iters": args.individual_bootstrap,
    }
    summary = render_summary(result)
    (out / "summary.md").write_text(summary, encoding="utf-8")
    print(summary, end="")
    print(f"SUMMARY {out / 'summary.md'}")
    return result


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preset", required=True, choices=["ra", "breast_cancer", "bc", "depression", "mdd", "aging", "age"])
    parser.add_argument("--beta", type=Path)
    parser.add_argument("--deltas", type=Path)
    parser.add_argument("--meta", type=Path)
    parser.add_argument("--modules", required=True, type=Path)
    parser.add_argument("--compounds", required=True, type=Path)
    parser.add_argument("--layout", choices=["samples", "genes"], default="samples")
    parser.add_argument("--match-fallback", choices=["paper", "repo"], default="paper")
    parser.add_argument("--individual-bootstrap", type=int, default=0)
    parser.add_argument("--group-bootstrap", type=int, default=0)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--out", required=True, type=Path)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    try:
        run(parse_args(argv))
    except (ValueError, KeyError, json.JSONDecodeError, OSError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
