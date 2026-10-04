#!/usr/bin/env python3
"""Print a four-layer reading of one SteeraMed evidence-chain JSON file.

The report quotes stored numbers. It does not recompute SA scores.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from evidence_chain import BOUNDARY


def _fmt_p(value) -> str:
    try:
        return f"{float(value):.3g}"
    except (TypeError, ValueError):
        return "NA"


def summarize(chain: dict) -> str:
    lines = [
        f"患者: {chain.get('patient_id', 'NA')}",
        f"预设/疾病: {chain.get('disease', 'NA')}",
    ]
    if chain.get("age") is not None:
        lines.append(f"年龄: {chain['age']}")
    if chain.get("sex") is not None:
        lines.append(f"性别: {chain['sex']}")

    modules = chain.get("perturbed_modules") or []
    lines.append(f"\nLayer 1 扰动 PPI 模块: {len(modules)}")
    for module in modules[:8]:
        hub = module.get("hub_gene") or module.get("hub")
        hallmark = module.get("hallmark") or "NA"
        lines.append(
            f"  {hub}: delta={module.get('delta')}, p={_fmt_p(module.get('p_value'))}, "
            f"n_genes={module.get('n_genes')}, hallmark={hallmark}"
        )
    if len(modules) > 8:
        lines.append(f"  ... 另有 {len(modules) - 8} 个")

    compounds = chain.get("top_compounds") or []
    lines.append(f"\nLayer 2 化合物重要性排序: {len(compounds)}")
    for compound in compounds[:10]:
        flag = "阳性对照" if compound.get("is_positive") or compound.get("is_known_drug") else "候选"
        lines.append(
            f"  #{compound.get('rank')} {compound.get('compound_name')} ({flag}): "
            f"importance={compound.get('importance')}, mean_abs_sa={compound.get('mean_abs_sa')}, "
            f"n_targets={compound.get('n_targets')}"
        )

    mechanism = chain.get("mechanism_map") or {}
    lines.append(f"\nLayer 3 机制注释: {len(mechanism)}")
    for cid, item in list(mechanism.items())[:5]:
        lines.append(
            f"  {cid}: hubs={item.get('ppi_hubs')}, n_targets_in_chain={len(item.get('target_genes') or [])}, "
            f"hallmarks={item.get('hallmarks')}"
        )

    bootstrap = chain.get("bootstrap_stability") or {}
    lines.append(f"\nLayer 4 bootstrap（top-10 停留百分比）: {len(bootstrap)}")
    if not bootstrap:
        lines.append("  未计算")
    else:
        ordered = sorted(bootstrap.items(), key=lambda item: item[1], reverse=True)
        for cid, pct in ordered[:8]:
            lines.append(f"  {cid}: {pct}")

    meta = chain.get("meta") or {}
    if meta:
        lines.append("\n记录")
        for key in (
            "preset",
            "feature_space",
            "n_total_compounds",
            "n_known_drugs_in_top10",
            "n_eligible_pairs",
            "n_features",
            "delta_mode",
            "match_fallback",
        ):
            if key in meta:
                lines.append(f"  {key}: {meta[key]}")
    lines.append(f"\n边界: {BOUNDARY}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("chain_json", type=Path)
    args = parser.parse_args(argv)
    chain = json.loads(args.chain_json.read_text(encoding="utf-8"))
    print(summarize(chain))
    return 0


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    sys.exit(main())
