#!/usr/bin/env python3
"""Personal readout of the delirium protein list in Raptis et al. 2026.

The list is Fig. 5a proteins with Bonferroni P < 1.7e-5. Cohort odds ratios
are printed and are not multiplied by the user's protein level. LASSO
coefficients are not in the cloned repository.
"""

from __future__ import annotations

from paper_card import lines as paper_card_lines


import argparse
import csv
import sys
from pathlib import Path

from presets import (
    BOUNDARY,
    FIG5A,
    RS429358_OR,
    RS7412_OR,
    TABLE1,
)


def load_levels(path: Path | None) -> dict[str, str]:
    if path is None:
        return {}
    text = path.read_text(encoding="utf-8", errors="replace")
    rows = list(csv.DictReader(text.splitlines()))
    if not rows:
        return {}
    fields = {name.strip().lower(): name for name in rows[0] if name}
    name_key = fields.get("protein") or fields.get("marker") or fields.get("name") or fields.get("基因")
    value_key = fields.get("value") or fields.get("level") or fields.get("结果")
    if name_key is None or value_key is None:
        raise ValueError("protein file needs protein,value columns")
    found = {}
    for row in rows:
        symbol = (row.get(name_key) or "").strip()
        value = (row.get(value_key) or "").strip()
        if symbol and value:
            found[symbol.upper()] = value
    return found


def load_lines(path: Path | None) -> list[str]:
    if path is None:
        return []
    names = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            names.append(text)
    return names


def load_labs(path: Path | None) -> list[tuple[str, str, str]]:
    if path is None:
        return []
    text = path.read_text(encoding="utf-8", errors="replace").strip()
    if not text:
        return []
    first = text.splitlines()[0]
    if "项目" in first or "item" in first.casefold():
        rows = list(csv.DictReader(text.splitlines()))
        if not rows:
            return []
        fields = {name.strip(): name for name in rows[0] if name}
        item_key = fields.get("项目") or fields.get("item") or fields.get("name")
        value_key = fields.get("结果") or fields.get("value") or fields.get("result")
        unit_key = fields.get("单位") or fields.get("unit")
        parsed = []
        for row in rows:
            item = (row.get(item_key, "") if item_key else "").strip()
            value = (row.get(value_key, "") if value_key else "").strip()
            unit = (row.get(unit_key, "") if unit_key else "").strip()
            if item and value:
                parsed.append((item, value, unit))
        return parsed
    return [(line.strip(), "", "") for line in text.splitlines() if line.strip()]


def load_genotypes(path: Path | None) -> dict[str, str]:
    if path is None:
        return {}
    text = path.read_text(encoding="utf-8", errors="replace")
    rows = list(csv.DictReader(text.splitlines()))
    if not rows:
        return {}
    fields = {name.strip().lower(): name for name in rows[0] if name}
    id_key = fields.get("rsid") or fields.get("snp")
    gt_key = fields.get("genotype") or fields.get("gt")
    if id_key is None or gt_key is None:
        raise ValueError("genotype file needs rsid,genotype columns")
    found = {}
    for row in rows:
        rsid = (row.get(id_key) or "").strip().lower()
        genotype = (row.get(gt_key) or "").strip().upper().replace(" ", "")
        if rsid and genotype:
            found[rsid] = genotype
    return found


def _alleles(genotype: str) -> tuple[str, str] | None:
    if "/" in genotype:
        left, right = genotype.split("/", 1)
    elif len(genotype) == 2:
        left, right = genotype[0], genotype[1]
    else:
        return None
    if len(left) != 1 or len(right) != 1:
        return None
    return left, right


def epsilon4_count(genotypes: dict[str, str]) -> str:
    """Count APOE-ε4 haplotypes when the unphased genotypes determine it.

    The paper defines ε4 as rs429358-C together with rs7412-C.
    """
    a = _alleles(genotypes.get("rs429358", ""))
    b = _alleles(genotypes.get("rs7412", ""))
    if a is None or b is None:
        return "没有同时给出 rs429358 和 rs7412 的两等位基因型，不算 ε4 个数。"
    c429 = a.count("C")
    c7412 = b.count("C")
    if c429 == 0 or c7412 == 0:
        return "按论文的单倍型定义（rs429358-C 且 rs7412-C），ε4 个数是 0。"
    if c429 == 2 and c7412 == 2:
        return "按论文的单倍型定义，ε4 个数是 2。"
    if (c429 == 2 and c7412 == 1) or (c429 == 1 and c7412 == 2):
        return "按论文的单倍型定义，ε4 个数是 1。"
    return "两个位点都是杂合，相位不确定，不算 ε4 个数。"


def method_block(levels: dict[str, str]) -> list[str]:
    table = {symbol: (effect, tier) for symbol, effect, _pwas, tier in TABLE1}
    direction = {"negative": "负", "positive": "正"}
    lines = []
    matched = [symbol for symbol, _odds, _p in FIG5A if symbol in levels]
    if not matched:
        return [f"图 5a 有 {len(FIG5A)} 个蛋白。这次一个都没有对上。"]
    for symbol, odds, _p_value in FIG5A:
        if symbol not in levels:
            continue
        extra = f"你的表里记为 {levels[symbol]}。队列比值比 {odds:.2f}，这是队列数字。"
        if symbol in table:
            effect, tier = table[symbol]
            extra += f"效应方向{direction[effect]}，成药分级 {tier}，不是处方。"
        lines.append(f"- {symbol}：{extra}")
    return lines


def medication_lines(medications: list[str]) -> list[str]:
    symbols = {symbol.casefold() for symbol, _odds, _p in FIG5A}
    lines = ["## 你正在使用的药", ""]
    if not medications:
        lines.append("没有提供现用药。")
        return lines
    for name in medications:
        if name.casefold() in symbols:
            lines.append(f"- {name}：这个名字出现在方法名单里。不能据此停。")
        else:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def lab_section(labs: list[tuple[str, str, str]]) -> list[str]:
    lines = ["## 体检", ""]
    if not labs:
        lines.append("没有提供体检。体检不增删方法算出的名单。")
        return lines
    lines.append("下面照录体检数值。体检不增删方法算出的名单。")
    for item, value, unit in labs:
        suffix = f" {unit}" if unit else ""
        lines.append(f"- {item} {value}{suffix}")
    return lines


def render_report(
    levels: dict[str, str],
    genotypes: dict[str, str],
    medications: list[str],
    labs: list[tuple[str, str, str]],
) -> str:
    known = {symbol for symbol, _odds, _p in FIG5A}
    extra = [symbol for symbol in levels if symbol not in known]
    cohort_or = {"rs429358": RS429358_OR, "rs7412": RS7412_OR}
    if not levels and not genotypes:
        lead = "没有提供蛋白浓度，也没有两个位点的基因型，所以没有个人数值。"
    else:
        lead = "名单是谵妄相关的血浆蛋白。你提供的浓度和基因型写在对应名字旁边。"
    if extra:
        lead += "".join(f"{name} 不在这份名单里。" for name in extra)
    lines = [
        "# 谵妄相关蛋白",
        "",
        lead,
        "",
        "## 方法算出的名单",
        "",
        *method_block(levels),
    ]
    if genotypes:
        lines.append(epsilon4_count(genotypes))
        for rsid, genotype in genotypes.items():
            odds = cohort_or.get(rsid)
            if odds is None:
                lines.append(f"- {rsid}：{genotype}")
            else:
                lines.append(f"- {rsid}：{genotype}。队列比值比 {odds:.2f}，这是队列数字。")
    lines.extend(["", *medication_lines(medications), "", *lab_section(labs), "", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def method_section(text: str) -> str:
    start = text.index("## 方法算出的名单\n")
    end = text.index("\n## 你正在使用的药")
    return text[start:end]


def write_report(
    out_dir: Path,
    proteins: Path | None,
    genotypes: Path | None,
    medications: Path | None,
    labs: Path | None,
) -> Path:
    text = render_report(load_levels(proteins), load_genotypes(genotypes), load_lines(medications), load_labs(labs))
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "report.md"
    path.write_text(_with_paper_card(text), encoding="utf-8")
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Delirium protein readout from Raptis et al. 2026")
    parser.add_argument("--proteins", type=Path)
    parser.add_argument("--genotypes", type=Path)
    parser.add_argument("--medications", type=Path)
    parser.add_argument("--labs", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    path = write_report(args.out, args.proteins, args.genotypes, args.medications, args.labs)
    sys.stdout.write(str(path) + "\n")
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
    raise SystemExit(main())
