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
    AGE_OFFSET,
    HR_MORTALITY_10Y,
    HR_MORTALITY_1Y,
    HR_MORTALITY_5Y,
    MAE_YEARS,
    N_BINS,
    OUTCOMES,
    UKB_B_N,
)


def retinal_from_probs(probs):
    if len(probs) != N_BINS:
        raise ValueError("expected 77 probabilities")
    total = sum(probs)
    if abs(total - 1.0) > 1e-6:
        raise ValueError("probabilities must sum to 1")
    shifted = sum(prob * index for index, prob in enumerate(probs))
    return shifted + AGE_OFFSET


def read_probs(path):
    values = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if text:
            values.append(float(text))
    return values


def retinal_from_file(path):
    if path is None:
        return None
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if not text or text.startswith("#") or "," not in text:
            continue
        cells = [cell.strip() for cell in text.split(",")]
        if cells[0].lower() in {"marker", "item", "name", "key", "项目"}:
            continue
        if cells[0].lower() in {"retinal_age", "retinalage", "视网膜年龄"} and len(cells) >= 2:
            return float(cells[1])
    return None


def report(args):
    retinal = None
    if getattr(args, "retinal_age", None) is None:
        args.retinal_age = retinal_from_file(getattr(args, "measurements", None))
    if args.retinal_age is not None and args.age is not None:
        retinal = args.retinal_age
    elif args.probs is not None and args.age is not None:
        retinal = retinal_from_probs(read_probs(args.probs))
    if retinal is None or args.age is None:
        intro = "没有同时给出实足年龄和视网膜年龄，这次没有算出年龄差。"
        items = []
    else:
        gap = retinal - args.age
        band = "落在" if abs(gap) <= MAE_YEARS else "超出"
        intro = f"视网膜年龄减去实足年龄，差 {gap:.4g} 年。"
        items = [(
            "视网膜年龄差",
            f"差 {gap:.4g} 年。健康队列的平均绝对误差是 {MAE_YEARS:.2f} 年，绝对差{band}这条误差带。",
        )]
    meds = load_medications(args.medications)
    labs = parse_labs(args.labs) if args.labs else []
    text = render("视网膜年龄差", intro, items, meds, labs, [])
    args.out.mkdir(parents=True, exist_ok=True)
    destination = args.out / "report.md"
    destination.write_text(_with_paper_card(text), encoding="utf-8")
    return destination


def add_args(parser):
    parser.add_argument("--retinal-age", dest="retinal_age", type=float, default=None)
    parser.add_argument("--measurements", type=Path, default=None)
    parser.add_argument("--age", type=float, default=None)
    parser.add_argument("--probs", type=Path, default=None)

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
