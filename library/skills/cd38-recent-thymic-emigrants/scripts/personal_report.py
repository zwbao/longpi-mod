#!/usr/bin/env python3
from __future__ import annotations

from paper_card import lines as paper_card_lines


import argparse
import sys
from pathlib import Path

from presets import BOUNDARY

def load_medications(path):
    if path is None:
        return []
    names = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            names.append(text)
    return names


def parse_labs(path):
    text = Path(path).read_text(encoding="utf-8")
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return []
    rows = []
    header = lines[0].replace(" ", "")
    start = 1 if "项目" in header else 0
    if any("," in line for line in lines):
        for line in lines[start:]:
            parts = [part.strip() for part in line.split(",")]
            if len(parts) >= 2 and parts[0] != "项目":
                unit = parts[2] if len(parts) > 2 else ""
                rows.append((parts[0], parts[1], unit))
        return rows
    return [("体检原文", " ".join(lines), "")]


def lab_lines(rows):
    lines = []
    for name, value, unit in rows:
        unit_text = f" {unit}" if unit else ""
        lines.append(f"- {name} {value}{unit_text}")
    return lines


def match_medication(name, aliases):
    folded = name.lower().replace(" ", "")
    ordered = sorted(aliases, key=lambda item: len(item[0]), reverse=True)
    for alias, display in ordered:
        if alias.lower().replace(" ", "") in folded:
            return display
    return None


def medication_lines(medications, aliases, listed):
    names = {name for name, _detail in listed}
    lines = []
    for name in medications:
        display = match_medication(name, aliases)
        if display is None or display not in names:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
        else:
            lines.append(f"- {name}：对应名单上的 {display}。名次不是继续或停用的理由。")
    return lines


def render(title, intro, items, medications, lab_rows, aliases):
    lines = [f"# {title}", "", intro, "", "## 方法算出的名单"]
    if not items:
        lines.append("名单是空的。")
    else:
        for name, detail in items:
            lines.append(f"- {name}：{detail}")
    med_lines = medication_lines(medications, aliases, items)
    lines.extend(["", "## 你正在使用的药"])
    if med_lines:
        lines.extend(med_lines)
    else:
        lines.append("没有提供现用药。")
    lines.extend(["", "## 体检"])
    if lab_rows:
        lines.append("下面照录体检。体检不增删方法算出的名单。")
        lines.extend(lab_lines(lab_rows))
    else:
        lines.append("没有提供体检。体检不增删方法算出的名单。")
    lines.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"

from presets import (
    AGE_BINS,
    COHORT_N,
    GATE_LABEL,
    GATE_PRIORITY,
    GATES,
    GROUP_SIZE_HIGH,
    GROUP_SIZE_LOW,
    MATURE_LABEL,
    OLD_ABOVE,
)


def age_group(age):
    if age is None:
        return None
    for label, low, high in AGE_BINS:
        if high is None:
            if age > OLD_ABOVE:
                return label
        elif low <= age <= high:
            return label
    return None


def assign(lineage, cxcr3, cd38, cd25):
    gates = GATES[lineage]
    values = {"CxCR3": cxcr3, "CD38": cd38, "CD25": cd25}
    for key in GATE_PRIORITY:
        if values[key] > gates[key]:
            return GATE_LABEL[key]
    return MATURE_LABEL


def read_markers(path):
    if path is None:
        return []
    rows = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if not text or text.startswith("#") or text.lower().startswith("lineage"):
            continue
        lineage, cxcr3, cd38, cd25 = [part.strip() for part in text.split(",")]
        lineage = lineage.upper()
        if lineage not in GATES:
            raise ValueError("lineage must be CD4 or CD8")
        rows.append((lineage, float(cxcr3), float(cd38), float(cd25)))
    return rows


STATE_NAME = {
    "CD38++": "近期胸腺迁出细胞",
    "CXCR3 hi": "趋化因子受体高表达",
    "CD25+": "白细胞介素受体较高",
    "剩余成熟初始细胞": "其余成熟初始细胞",
}
AGE_NAME = {
    "A": "二十五到三十四岁",
    "B": "三十五到四十四岁",
    "C": "四十五到五十四岁",
    "D": "五十五到六十四岁",
    "E": "六十五岁及以上",
}


def report(args):
    grouped = {}
    for lineage, cxcr3, cd38, cd25 in read_markers(args.markers):
        label = assign(lineage, cxcr3, cd38, cd25)
        gates = GATES[lineage]
        if label == "CXCR3 hi":
            note = f"{lineage} 的 CxCR3 是 {cxcr3:g}，高于该谱系阈值 {gates['CxCR3']:g}。"
        elif label == "CD38++":
            note = f"{lineage} 的 CD38 是 {cd38:g}，高于该谱系阈值 {gates['CD38']:g}。"
        elif label == "CD25+":
            note = f"{lineage} 的 CD25 是 {cd25:g}，高于该谱系阈值 {gates['CD25']:g}。"
        else:
            note = f"{lineage} 的三道门都没有高于阈值。"
        grouped.setdefault(label, []).append(note)
    items = [(STATE_NAME[label], "".join(notes)) for label, notes in grouped.items()]
    group = age_group(args.age)
    if group is not None:
        items.append((AGE_NAME[group], f"你的年龄是 {args.age:g}，落在这一组。"))
    if grouped and group is not None:
        intro = "这次按门控给标志物分档，并把年龄放进论文写出的年龄组。"
    elif grouped and args.age is not None:
        intro = "这次按门控给标志物分了档。给出的年龄不在论文写出的年龄组里。"
    elif grouped:
        intro = "这次按门控给标志物分了档。"
    elif group is not None:
        intro = "这次把年龄放进论文写出的年龄组。没有标志物可分档。"
    elif args.age is not None:
        intro = "给出的年龄不在论文写出的年龄组里，这次没有分档。"
    else:
        intro = "没有提供标志物或年龄，这次没有分档。"
    meds = load_medications(args.medications)
    labs = parse_labs(args.labs) if args.labs else []
    text = render("初始细胞分档", intro, items, meds, labs, [])
    args.out.mkdir(parents=True, exist_ok=True)
    destination = args.out / "report.md"
    destination.write_text(_with_paper_card(text), encoding="utf-8")
    return destination


def add_args(parser):
    parser.add_argument("--markers", type=Path, default=None)
    parser.add_argument("--age", type=float, default=None)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--medications", type=Path, default=None)
    parser.add_argument("--labs", type=Path, default=None)
    parser.add_argument("--out", type=Path, required=True)
    add_args(parser)
    args = parser.parse_args()
    path = report(args)
    print(path)
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
