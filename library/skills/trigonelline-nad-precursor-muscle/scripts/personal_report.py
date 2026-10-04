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
    ALIASES,
    BUSHEHR_N,
    EC50_CONTROL_UM,
    EC50_FK866_UM,
    MOUSE_DOSE_MG_PER_KG,
    PRECURSORS,
)


def report(args):
    if args.trigonelline is None:
        intro = "没有提供血清葫芦巴碱，这次没有可记录的数值。"
        items = []
    else:
        intro = f"这次记下你提供的血清葫芦巴碱，数值是 {args.trigonelline:g}。正文没有血清分界，所以没有分档。"
        items = [("葫芦巴碱", f"数值是 {args.trigonelline:g}。没有血清分界，这个数不参与分档。")]
    meds = load_medications(args.medications)
    labs = parse_labs(args.labs) if args.labs else []
    text = render("葫芦巴碱记录", intro, items, meds, labs, ALIASES)
    args.out.mkdir(parents=True, exist_ok=True)
    destination = args.out / "report.md"
    destination.write_text(_with_paper_card(text), encoding="utf-8")
    return destination


def add_args(parser):
    parser.add_argument("--trigonelline", type=float, default=None)

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
