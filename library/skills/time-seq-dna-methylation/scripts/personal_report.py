#!/usr/bin/env python3
from __future__ import annotations

from paper_card import lines as paper_card_lines


import argparse
from pathlib import Path

from presets import BOUNDARY


def load_lines(path):
    if path is None:
        return []
    rows = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            rows.append(text)
    return rows


def parse_labs(path):
    if path is None:
        return []
    found = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if not text or text.startswith("#") or text.startswith("项目"):
            continue
        parts = [p.strip() for p in text.replace("，", ",").split(",")]
        if len(parts) < 2:
            parts = text.split()
        if len(parts) < 2:
            continue
        name, raw = parts[0], parts[1]
        unit = parts[2] if len(parts) > 2 else ""
        try:
            value = float(raw)
        except ValueError:
            continue
        found.append((name, value, unit))
    return found


def lab_lines(path):
    rows = parse_labs(path)
    lines = ["## 体检", ""]
    if not rows:
        lines.append("没有提供体检。体检不增删方法算出的名单。")
        return lines
    lines.append("下面照录体检数值。体检不增删方法算出的名单。")
    for name, value, unit in rows:
        unit_bit = f" {unit}" if unit else ""
        lines.append(f"- {name} {value:g}{unit_bit}")
    return lines

from presets import (
    HUMAN,
    LOW_COVERAGE,
    LOW_FRACTION,
    READ_MINIMUM,
    cpgs,
    methylation_gap,
    predict_methylation,
)


def parse_methylation(path):
    values = {}
    coverage = {}
    total_reads = None
    if path is None:
        return values, coverage, total_reads
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if not text or text.startswith("#") or text.startswith("cpg"):
            continue
        if text.lower().startswith("total_reads="):
            total_reads = float(text.split("=", 1)[1])
            continue
        parts = text.split()
        values[parts[0]] = float(parts[1])
        if len(parts) > 2:
            coverage[parts[0]] = float(parts[2])
    return values, coverage, total_reads


def too_many_low(coverage, needed):
    if not coverage:
        return False
    low = 0
    for site in needed:
        if site in coverage and coverage[site] < LOW_COVERAGE:
            low += 1
    return low > len(needed) * LOW_FRACTION


def medication_lines(names, needed):
    wanted = set(needed)
    lines = ["## 你正在使用的药", ""]
    if not names:
        lines.append("没有提供现用药。")
        return lines
    for name in names:
        if name in wanted:
            lines.append(f"- {name}：这个名字出现在方法名单里。不能据此停。")
        else:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def render(age, meds, labs, measurements):
    del age
    needed = cpgs(HUMAN)
    values, coverage, total_reads = parse_methylation(measurements)
    predicted = None
    if total_reads is not None and total_reads < READ_MINIMUM:
        lead = f"总读数是 {total_reads:g}，少于 {READ_MINIMUM:g}，所以没有年龄。"
    elif not values:
        lead = "没有甲基化表，所以没有年龄。"
    elif too_many_low(coverage, needed):
        lead = "低覆盖的位点太多，所以没有年龄。"
    else:
        gap = methylation_gap(values, HUMAN)
        if gap == "missing":
            lead = "缺了位点，不填补，不算年龄。"
        elif gap == "scale":
            lead = "甲基化百分比不在零到一百，不算年龄。"
        else:
            predicted = predict_methylation(values, HUMAN)
            lead = f"用你给的甲基化算出了年龄，是 {predicted:.4f} 年。"
    lines = ["# 血液甲基化年龄", "", lead, "", "## 方法算出的名单", ""]
    used = [site for site in needed if predicted is not None and site in values]
    if not used:
        lines.append("这次没有用上位点。")
    else:
        for site in used:
            lines.append(f"- {site}：{values[site]:g}")
    lines.extend(["", *medication_lines(load_lines(meds), needed), "", *lab_lines(labs), "", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def report(out, age, medications, labs, measurements=None):
    out.mkdir(parents=True, exist_ok=True)
    path = out / "report.md"
    path.write_text(_with_paper_card(render(age, medications, labs, measurements)), encoding="utf-8")
    return path

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--medications", type=Path)
    parser.add_argument("--labs", type=Path)
    parser.add_argument("--age", type=float)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--measurements", type=Path)
    args = parser.parse_args()
    report(args.out, args.age, args.medications, args.labs, args.measurements)



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
    main()
