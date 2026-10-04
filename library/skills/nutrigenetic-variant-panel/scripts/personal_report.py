#!/usr/bin/env python3
"""Diet-related variants from one person's consumer genotype file.

Reads ALDH2 rs671, MTHFR rs1801133 and LCT rs4988235, and APOE rs429358 +
rs7412 only when --apoe is given (blood-lipid reading only). Each reading is a
lookup of the genotype against the cited paper; nothing is scored or summed.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import skillkit
from paper_card import lines as paper_card_lines

from genotype_file import GenotypeFile, GenotypeFileError, called_alleles, read_genotype_file
from presets import APOE, BOUNDARY, NOT_INCLUDED, VARIANTS

TITLE = "饮食相关的基因位点"


def read_site(genotypes: GenotypeFile, rsid: str, reference: str, effect: str) -> Tuple[Optional[int], str]:
    """(copies of the effect base or None, what was read)."""
    genotype = genotypes.genotype(rsid)
    if genotype is None:
        return None, "文件里没有" if rsid.lower() not in genotypes.no_calls else "没测出（--）"
    alleles = called_alleles(genotype)
    if not set(alleles) <= {reference, effect}:
        return None, f"读到 {genotype}，不是这个位点正链上的 {reference}/{effect}，可能是链方向或文件格式不同，没有用"
    return alleles.count(effect), genotype


def apoe_genotype(genotypes: GenotypeFile) -> Tuple[Optional[str], str]:
    counts = []
    shown = []
    for rsid, (reference, effect) in APOE["sites"].items():
        copies, read = read_site(genotypes, rsid, reference, effect)
        shown.append(f"{rsid} {read}")
        counts.append(copies)
    if any(item is None for item in counts):
        return None, "；".join(shown)
    genotype = APOE["genotypes"].get((counts[0], counts[1]))
    return genotype, "；".join(shown)


def collect(genotype: Optional[Path]) -> Tuple[Optional[GenotypeFile], List[skillkit.Problem]]:
    if genotype is None:
        return None, [skillkit.Problem("genotype", "基因型文件", "missing", "缺少基因检测的原始数据文件。")]
    try:
        parsed = read_genotype_file(genotype)
    except GenotypeFileError as error:
        return None, [skillkit.Problem("genotype", "基因型文件", "parse", error.message_zh)]
    wanted = [item["rsid"] for item in VARIANTS.values()] + list(APOE["sites"])
    present = [rsid for rsid in wanted if rsid in parsed.calls or rsid in parsed.no_calls or rsid in parsed.odd]
    if not present:
        return None, [skillkit.Problem(
            "genotype", "基因型文件", "coverage",
            f"文件里读到 {parsed.rows} 行基因型，但这里看的 {len(wanted)} 个位点一个也没有。"
            "请确认交的是基因检测公司的完整「原始数据」下载。",
        )]
    return parsed, []


def render(genotypes: GenotypeFile, include_apoe: bool) -> Tuple[str, Dict[str, object]]:
    results: Dict[str, object] = {}
    lines = [f"# {TITLE}", ""]
    lines.append(f"读了 {genotypes.rows} 行原始数据。下面每一项只看一个位点，按论文说它意味着什么、可以考虑做什么。")
    for key, variant in VARIANTS.items():
        copies, read = read_site(genotypes, variant["rsid"], variant["reference"], variant["effect"])
        results[f"{key}_{variant['rsid']}_copies"] = copies
        lines += ["", f"## {variant['title_zh']}", ""]
        if copies is None:
            lines.append(f"- 这个位点{read}，没有结果。")
            continue
        lines.append(f"- 你的基因型：{read}（{variant['effect_name']} 有 {copies} 份）。")
        lines.append(f"- {variant['reading'][copies]}")
        action = variant["action"][copies]
        if action:
            lines.append(f"- {action}")
        if variant.get("caveat") and copies:
            lines.append(f"- {variant['caveat']}")
        lines.append(f"- 依据：{variant['cite']}，doi:{variant['doi']}。")
    lines += ["", "## 血脂：APOE", ""]
    if not include_apoe:
        results["apoe_genotype"] = None
        lines.append(
            "这份报告默认不看 APOE。APOE 和血脂有关，也和其他疾病的风险有关。"
            "只想看血脂这一部分的话，可以告诉助手再看；其他部分要先和医生或遗传咨询师聊。"
        )
    else:
        genotype, read = apoe_genotype(genotypes)
        results["apoe_genotype"] = genotype
        if genotype is None:
            lines.append(f"- 读到：{read}。")
            lines.append("- 这个组合读不出 APOE 型，或者是很少见的组合，建议以临床检测为准。")
        else:
            lines.append(f"- 读到：{read}；按这两个位点是 {genotype}。")
            if genotype == "ε2/ε4":
                lines.append("- 两个位点都是一份变异时，也可能是很少见的 ε1/ε3，芯片分不开。")
            order = " < ".join(APOE["lipid_order"])
            lines.append(
                f"- 按 {APOE['cite']} 的荟萃分析，低密度脂蛋白胆固醇大致按 {order} 的顺序升高。"
                "这是人群平均的方向，你自己的血脂要看化验。"
            )
            lines.append(f"- {APOE['action']}")
            lines.append(f"- {APOE['not_interpreted']}")
            lines.append(f"- 依据：{APOE['cite']}，doi:{APOE['doi']}。")
    lines += ["", "## 没有放进来的位点", "", NOT_INCLUDED, "", f"边界: {BOUNDARY}"]
    return "\n".join(lines) + "\n", results


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


def write_report(out_dir: Path, genotype: Optional[Path], include_apoe: bool = False) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    stale = out_dir / "problems.json"
    if stale.exists():
        stale.unlink()
    manifest = skillkit.load_manifest(__file__)
    parsed, problems = collect(genotype)
    if problems:
        path = skillkit.write_problems(out_dir, problems, TITLE, BOUNDARY)
        path.write_text(_with_paper_card(path.read_text(encoding="utf-8")), encoding="utf-8")
        skillkit.write_result(out_dir, manifest, {spec["key"]: None for spec in manifest["outputs"]})
        return path
    text, results = render(parsed, include_apoe)
    path = out_dir / "report.md"
    path.write_text(_with_paper_card(text), encoding="utf-8")
    skillkit.write_result(out_dir, manifest, results)
    return path


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Diet-related variants from a consumer genotype file")
    parser.add_argument("--genotype", type=Path, help="23andMe-style raw data file (.txt, .zip, .gz)")
    parser.add_argument("--apoe", action="store_true", help="also read APOE, blood-lipid reading only")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    path = write_report(args.out, args.genotype, args.apoe)
    sys.stdout.write(str(path) + "\n")
    if (args.out / "problems.json").exists():
        return skillkit.EXIT_INPUT_PROBLEM
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
