#!/usr/bin/env python3
"""Personal readout. Published cutoffs live in presets.py."""

from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import BOUNDARY, FDR_CARTILAGE, FDR_CELL, NAMED, PROTEIN_FDR, PROTEIN_FOLD, PSI_MIN

TITLE = "软骨纤维化解旋酶"
NAMED_KEY = {name.casefold(): name for name in NAMED}


def load_pairs(path: Path | None) -> list[tuple[str, str]]:
    if path is None:
        return []
    text = path.read_text(encoding="utf-8-sig", errors="replace").strip()
    if not text:
        return []
    rows = list(csv.DictReader(text.splitlines()))
    if not rows:
        return []
    fields = {name.strip().lower(): name for name in rows[0] if name}
    name_key = fields.get("name") or fields.get("项目") or fields.get("基因") or fields.get("gene")
    value_key = fields.get("value") or fields.get("结果") or fields.get("值")
    if name_key is None or value_key is None:
        raise ValueError("measurements file needs name,value columns")
    found = []
    for row in rows:
        name = (row.get(name_key) or "").strip()
        value = (row.get(value_key) or "").strip()
        if name:
            found.append((name, value))
    return found


def load_lines(path: Path | None) -> list[str]:
    if path is None:
        return []
    return [line.strip() for line in path.read_text(encoding="utf-8", errors="replace").splitlines() if line.strip() and not line.strip().startswith("#")]


def load_labs(path: Path | None) -> list[tuple[str, str, str]]:
    if path is None:
        return []
    text = path.read_text(encoding="utf-8-sig", errors="replace").strip()
    if not text:
        return []
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


def as_float(text: str):
    raw = str(text).strip().replace(",", "")
    match = re.match(r"^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?", raw)
    if not match:
        return None
    return float(match.group(0))


def psi_fraction(value: float) -> float:
    if abs(value) > 1:
        return value / 100.0
    return value


def split_measure(name: str):
    for suffix, kind in (
        ("_delta_psi", "psi"),
        ("_protein_fdr", "protein_fdr"),
        ("_ratio", "ratio"),
        ("_fdr", "fdr"),
    ):
        if name.casefold().endswith(suffix):
            return name[: -len(suffix)].strip(), kind
    return None, None


def collect(pairs):
    psi, fdr, ratio, protein_fdr = {}, {}, {}, {}
    plain = []
    for name, value in pairs:
        stem, kind = split_measure(name)
        number = as_float(value)
        if kind == "psi":
            psi[stem] = None if number is None else psi_fraction(number)
        elif kind == "fdr":
            fdr[stem] = number
        elif kind == "ratio":
            ratio[stem] = number
        elif kind == "protein_fdr":
            protein_fdr[stem] = number
        else:
            hit = NAMED_KEY.get(name.casefold())
            if hit:
                plain.append(hit)
    return psi, fdr, ratio, protein_fdr, plain


def calls(psi, fdr, ratio, protein_fdr):
    passed = []
    notes = []
    stems = sorted(set(psi) | set(fdr), key=str.casefold)
    for stem in stems:
        if psi.get(stem) is None or fdr.get(stem) is None:
            if psi.get(stem) is None:
                notes.append(f"{stem} 缺 delta PSI 列。")
            if fdr.get(stem) is None:
                notes.append(f"{stem} 缺 FDR 列。")
            continue
        rules = []
        if psi[stem] > PSI_MIN and fdr[stem] < FDR_CARTILAGE:
            rules.append("软骨规则")
        if psi[stem] > PSI_MIN and fdr[stem] < FDR_CELL:
            rules.append("细胞规则")
        if rules:
            passed.append(f"{stem}（{'、'.join(rules)}）")
    protein_stems = sorted(set(ratio) | set(protein_fdr), key=str.casefold)
    for stem in protein_stems:
        if ratio.get(stem) is None or protein_fdr.get(stem) is None:
            if ratio.get(stem) is None:
                notes.append(f"{stem} 缺蛋白质比值列。")
            if protein_fdr.get(stem) is None:
                notes.append(f"{stem} 缺蛋白质 FDR 列。")
            continue
        fold = ratio[stem]
        if protein_fdr[stem] < PROTEIN_FDR and (fold >= PROTEIN_FOLD or fold <= 1 / PROTEIN_FOLD):
            passed.append(f"{stem}（蛋白质规则）")
    return passed, notes


def render(pairs, medications, labs, age) -> str:
    psi, fdr, ratio, protein_fdr, plain = collect(pairs)
    passed, notes = calls(psi, fdr, ratio, protein_fdr)
    able = ["## 能算的", ""]
    if age is not None:
        able.append(f"记录的年龄是 {age} 岁。这次计算不用年龄。")
    if passed:
        able.append("通过正文规则的基因写入名单。delta PSI 大于 1 时按百分数换算。")
    else:
        able.append("这次没有基因同时具备可通过规则的数值。")
    if plain:
        able.append("下列基因是正文点过名的，这次只有名字或表达，没有按倍数纳入名单：" + "、".join(plain) + "。")
    unable = ["## 不能算的", ""]
    if not psi and not fdr:
        unable.append("剪接判断缺 delta PSI 列和 FDR 列。")
    if not ratio and not protein_fdr:
        unable.append("蛋白质判断缺比值列和蛋白质 FDR 列。")
    unable.extend(notes)
    unable.append("图上另外三个候选基因缺符号列，正文没有把名字写出来，所以不编进名单。")
    unable.append("DDX5 和胶原的相关系数缺表列，图上的数字不拿来点积。")
    unable.append("代码仓库是作图代码，不算这次的规则。")
    listed = ["## 方法算出的名单", ""]
    if passed:
        for name in passed:
            listed.append(f"- {name}")
    else:
        listed.append("名单是空的。")
    rows = [
        f"# {TITLE}",
        "",
        *paper_card_lines(),
        "",
        *able,
        "",
        *unable,
        "",
        *listed,
        "",
        *medication_lines(medications, passed),
        "",
        *lab_section(labs),
        "",
        f"边界: {BOUNDARY}",
    ]
    return "\n".join(rows) + "\n"


def medication_lines(medications, names) -> list[str]:
    lines = ["## 你正在使用的药", ""]
    if not medications:
        lines.append("没有提供现用药。不能据此停。")
        return lines
    known = {name.casefold() for name in names}
    for name in medications:
        if name.casefold() in known:
            lines.append(f"- {name}：这个名字出现在名单里。不能据此停。")
        else:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def lab_section(labs) -> list[str]:
    lines = ["## 体检", ""]
    if not labs:
        lines.append("没有提供体检。体检不增删方法算出的名单。")
        return lines
    lines.append("下面照录体检数值。体检不增删方法算出的名单。")
    for item, value, unit in labs:
        suffix = f" {unit}" if unit else ""
        lines.append(f"- {item} {value}{suffix}")
    return lines


def method_section(text: str) -> str:
    start = text.index("## 方法算出的名单\n")
    end = text.index("\n## 你正在使用的药")
    return text[start:end]


def write_report(out_dir: Path, measurements: Path | None, medications: Path | None, labs: Path | None, age=None) -> Path:
    text = render(load_pairs(measurements), load_lines(medications), load_labs(labs), age)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "report.md"
    path.write_text(text, encoding="utf-8")
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="DDX5 cartilage fibrosis readout")
    parser.add_argument("--measurements", type=Path)
    parser.add_argument("--medications", type=Path)
    parser.add_argument("--labs", type=Path)
    parser.add_argument("--age", type=float)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    path = write_report(args.out, args.measurements, args.medications, args.labs, args.age)
    sys.stdout.write(str(path) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
