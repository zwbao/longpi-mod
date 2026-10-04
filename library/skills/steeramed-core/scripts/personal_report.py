#!/usr/bin/env python3
"""Score one person's methylation against a frozen SteeraMed reference bundle.

The reference cohort, STRING modules, and STITCH compounds are downloaded
and prepared by prepare_reference.py. This report ranks alignment hypotheses.
It does not say which medicine to start or stop.
"""

from __future__ import annotations

from paper_card import lines as paper_card_lines


import argparse
import json
import sys
from pathlib import Path

import numpy as np

from download import cache_dir, download
from evidence_chain import BOUNDARY, build_evidence_chain
from labs import lab_lines, parse_labs
from names import medication_match, normalize_sex
from prepare_reference import prepare
from reference_data import URLS, load_promoter_map
from run_pipeline import read_matrix
from sa_score import compute_sa_score


def _probe_map_for_columns(columns: list[str], cache: Path | None) -> dict[str, set[str]] | None:
    probes = [column for column in columns if column.startswith("cg")]
    if len(probes) < 10:
        return None
    root = cache or cache_dir()
    manifests = [
        (root / "raw" / "HM450.hg19.gencode.tsv.gz", URLS["promoter_manifest"]),
        (root / "raw" / "EPIC.hg19.gencode.tsv.gz", URLS["epic_manifest"]),
        (root / "raw" / "EPICv2.hg19.gencode.tsv.gz", URLS["epicv2_manifest"]),
    ]
    merged: dict[str, set[str]] = {}
    for path, url in manifests:
        if not path.exists():
            download(url, path)
        merged.update(load_promoter_map(path))
        covered = sum(1 for probe in probes if probe in merged)
        if covered / len(probes) >= 0.5:
            break
    return merged


def _user_gene_beta(path: Path, layout: str, genes: list[str], probe_map: dict[str, set[str]] | None) -> np.ndarray:
    sample_ids, columns, matrix = read_matrix(path, layout)
    if len(sample_ids) != 1:
        raise ValueError("A personal report expects exactly one sample in the beta file")
    if columns and columns[0].startswith("cg") and probe_map is not None:
        beta = np.full(len(genes), np.nan, dtype=float)
        index = {gene: i for i, gene in enumerate(genes)}
        sums = np.zeros(len(genes), dtype=float)
        counts = np.zeros(len(genes), dtype=int)
        for probe, value in zip(columns, matrix[0]):
            if not np.isfinite(value):
                continue
            for gene in probe_map.get(probe, ()):
                if gene not in index:
                    continue
                sums[index[gene]] += value
                counts[index[gene]] += 1
        counted = counts > 0
        beta[counted] = sums[counted] / counts[counted]
        return beta
    column_index = {gene: i for i, gene in enumerate(columns)}
    beta = np.array(
        [matrix[0, column_index[gene]] if gene in column_index else np.nan for gene in genes],
        dtype=float,
    )
    return beta


def _delta_against_bundle(bundle: Path, user_beta: np.ndarray, age: float | None, sex: str | None) -> np.ndarray:
    meta = json.loads((bundle / "bundle.json").read_text(encoding="utf-8"))
    if meta["delta_mode"] == "aging_young_mean":
        young = np.load(bundle / "young_mean.npy")
        return user_beta - young
    if age is None or not sex:
        raise ValueError("Matched presets require --age and --sex so controls can be matched")
    from delta import match_controls

    controls = np.load(bundle / "control_beta.npy")
    ages = np.load(bundle / "control_ages.npy")
    sexes = np.load(bundle / "control_sexes.npy")
    matched, rule = match_controls(age, sex, ages, sexes)
    if len(matched) == 0:
        raise ValueError(f"No age/sex matched controls in the reference cohort (rule={rule})")
    return user_beta - np.nanmean(controls[matched], axis=0)


def _load_medications(path: Path | None) -> list[str]:
    if path is None:
        return []
    names = []
    for line in path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            names.append(text)
    return names


def _medication_hits(ranking: list[dict], medications: list[str]) -> list[str]:
    lines = []
    for name in medications:
        row = next(
            (
                item
                for item in ranking
                if medication_match(name, item["compound_name"], item["compound_id"], item.get("aliases") or [])
            ),
            None,
        )
        if row is None:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停药。")
        else:
            lines.append(
                f"- {name}：对应名单上的 {row['compound_name']}，排在第 {row['rank']} 位。"
                "这只说明它的靶点和本次甲基化模块有重叠，不能据此继续或停药。"
            )
    return lines


def _reference_sentence(bundle_meta: dict) -> str:
    if bundle_meta.get("delta_mode") == "aging_young_mean":
        return "对照是公开队列里 50 岁以下成年人的平均血液甲基化。你的结果是和这组年轻人的差距。"
    return "对照是公开队列里与你性别相同、年龄接近的人。你的结果是和这些人的差距。"


def render_report(
    chain: dict,
    bundle_meta: dict,
    medication_lines: list[str],
    lab_report: list[str],
    n_genes_observed: int,
) -> str:
    lines = [
        "# 个人甲基化对齐报告",
        "",
        _reference_sentence(bundle_meta),
        f"你的数据和参照基因对上了 {n_genes_observed} 个。",
        "下面的化合物名单是在参照人群里先圈定的功能模块上，只按你这一份甲基化重算的重叠排序。",
        "",
        "## 差异比较集中的基因模块",
    ]
    modules = chain["perturbed_modules"][:8]
    if not modules:
        lines.append("- 没有一组基因的差异集中到可以单列出来。")
    for module in modules:
        direction = "偏高" if module["delta"] >= 0 else "偏低"
        lines.append(f"- 以 {module['hub_gene']} 为中心的一组基因，甲基化{direction}（平均差 {module['delta']:+.4f}）。")
    lines.append("")
    lines.append("## 和这些模块重叠较多的化合物")
    top = chain["top_compounds"][:10]
    if not top:
        lines.append("- 没有算出化合物。")
    for compound in top:
        hubs = "、".join(item["ppi_hub"] for item in compound["matched_modules"][:3])
        lines.append(f"{compound['rank']}. {compound['compound_name']}。重叠的模块：{hubs}。")
    if medication_lines:
        lines.append("")
        lines.append("## 你正在使用的药")
        lines.extend(medication_lines)
    if lab_report:
        lines.append("")
        lines.append("## 体检里读到的项目")
        lines.extend(lab_report)
    lines.append("")
    lines.append(f"参照队列 {bundle_meta.get('geo', '')}。化合物名来自 STITCH 的别名。")
    lines.append(f"边界: {BOUNDARY}")
    return "\n".join(lines) + "\n"


def report(
    preset: str,
    beta: Path,
    out: Path,
    age: float | None,
    sex: str | None,
    medications: Path | None,
    labs: Path | None,
    layout: str,
    cache: Path | None,
    rebuild: bool = False,
) -> Path:
    sex = normalize_sex(sex)
    bundle = prepare(preset, cache, rebuild=rebuild)
    meta = json.loads((bundle / "bundle.json").read_text(encoding="utf-8"))
    genes = [str(gene) for gene in np.load(bundle / "genes.npy", allow_pickle=True)]
    _sample_ids, columns, _matrix = read_matrix(beta, layout)
    probe_map = _probe_map_for_columns(columns, cache)
    user_beta = _user_gene_beta(beta, layout, genes, probe_map)
    observed = int(np.isfinite(user_beta).sum())
    minimum = min(len(genes), max(100, len(genes) // 2))
    if observed < minimum:
        raise ValueError(
            f"Only {observed} of {len(genes)} reference genes were found in the personal beta file "
            f"(need at least {minimum}). Check that the columns are gene symbols or cg probe ids."
        )
    delta = _delta_against_bundle(bundle, user_beta, age, sex)
    features = json.loads((bundle / "features.json").read_text(encoding="utf-8"))
    gene_index = {gene: index for index, gene in enumerate(genes)}
    pairs = []
    for feature in features:
        targets = [gene for gene in feature["target_genes"] if gene in gene_index]
        nontargets = [gene for gene in feature["non_target_genes"] if gene in gene_index]
        pairs.append(
            {
                **feature,
                "target_genes": targets,
                "target_idx": [gene_index[gene] for gene in targets],
                "non_target_idx": [gene_index[gene] for gene in nontargets],
            }
        )
    sa = np.array(
        [
            compute_sa_score(delta, pair["target_idx"], pair["non_target_idx"])
            for pair in pairs
        ],
        dtype=float,
    )
    modules = json.loads((bundle / "modules.json").read_text(encoding="utf-8"))
    for module in modules:
        module["gene_indices"] = [gene_index[gene] for gene in module["genes"] if gene in gene_index]
        module["n_genes"] = len(module["gene_indices"])
    chain = build_evidence_chain(
        patient_id="personal",
        delta_row=delta,
        selected_modules=[module for module in modules if module["n_genes"] >= 2],
        sa_row=sa,
        feature_pairs=pairs,
        preset=meta["preset"],
        age=int(age) if age is not None and float(age).is_integer() else age,
        sex=sex,
        n_candidates=meta["n_compounds"],
        meta={"geo": meta["geo"], "delta_mode": meta["delta_mode"]},
    )
    lab_report = lab_lines(parse_labs(labs)) if labs else []
    text = render_report(
        chain,
        meta,
        _medication_hits(chain["top_compounds"], _load_medications(medications)),
        lab_report,
        observed,
    )
    out.mkdir(parents=True, exist_ok=True)
    (out / "report.md").write_text(_with_paper_card(text), encoding="utf-8")
    (out / "evidence.json").write_text(json.dumps(chain, indent=2, ensure_ascii=False), encoding="utf-8")
    print(text, end="")
    print(f"REPORT {out / 'report.md'}")
    return out / "report.md"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preset", default="aging")
    parser.add_argument("--beta", required=True, type=Path)
    parser.add_argument("--layout", choices=["samples", "genes"], default="samples")
    parser.add_argument("--age", type=float, default=None)
    parser.add_argument("--sex", default=None)
    parser.add_argument("--medications", type=Path, default=None)
    parser.add_argument("--labs", type=Path, default=None, help="Checkup table or text: item, value, unit")
    parser.add_argument("--cache", type=Path, default=None)
    parser.add_argument("--rebuild", action="store_true")
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        report(
            args.preset,
            args.beta,
            args.out,
            args.age,
            args.sex,
            args.medications,
            args.labs,
            args.layout,
            args.cache,
            rebuild=args.rebuild,
        )
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    return 0



def _with_paper_card(text):
    if not isinstance(text, str) or "## 论文卡片" in text:
        return text
    rows = text.splitlines()
    if not rows or not rows[0].startswith("# "):
        return text
    rest = rows[1:]
    while rest and rest[0] == "":
        rest = rest[1:]
    merged = [rows[0], "", *paper_card_lines(), "", *rest]
    out = "\n".join(merged)
    if text.endswith("\n"):
        out += "\n"
    return out

if __name__ == "__main__":
    sys.exit(main())
