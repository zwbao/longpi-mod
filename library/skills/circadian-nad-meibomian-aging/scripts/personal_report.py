#!/usr/bin/env python3
"""Personal readout. Cohort counts stay in presets and claims."""

from __future__ import annotations

import argparse
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import ALIASES, BOUNDARY, TITLE, assess


def load_lines(path):
    if path is None:
        return []
    rows = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            rows.append(text)
    return rows


def parse_measurements(path):
    values = {}
    bad = []
    for line in load_lines(path):
        parts = [p.strip() for p in line.replace("，", ",").split(",")]
        if len(parts) < 2:
            parts = line.split()
        if len(parts) < 2:
            bad.append(line)
            continue
        values[parts[0]] = parts[1]
    return values, bad


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
            continue
        unit = parts[2] if len(parts) > 2 else ""
        found.append((parts[0], parts[1], unit))
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
        lines.append(f"- {name} {value}{unit_bit}")
    return lines


def norm(text):
    return text.lower().replace(" ", "").replace("-", "").replace("_", "")


def match_item(name, items):
    folded = norm(name)
    for item_name, _detail in items:
        token = norm(item_name)
        if len(token) >= 4 and token in folded:
            return item_name
    for alias, display in ALIASES:
        if norm(alias) and norm(alias) in folded:
            return display
    return None


def medication_lines(path, items):
    names = load_lines(path)
    lines = ["## 你正在使用的药", ""]
    if not names:
        lines.append("没有提供现用药。不能据此停。")
        return lines
    listed = {name for name, _detail in items}
    for name in names:
        display = match_item(name, items)
        if display is None or display not in listed:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
        else:
            lines.append(f"- {name}：这个名字出现在方法名单里。不能据此停。")
    return lines


def render(age, meds, labs, measurements):
    values, bad = parse_measurements(measurements)
    computed, missing, items = assess(age, values, bad)
    lines = [f"# {TITLE}", "", *paper_card_lines(), "", "## 能算的", ""]
    if computed:
        lines.extend(computed)
    else:
        lines.append("这次没有可算的结果。")
    lines.extend(["", "## 不能算的", ""])
    lines.extend(missing or ["没有单独列出的缺列。"])
    lines.extend(["", "## 方法算出的名单", ""])
    if not items:
        lines.append("名单是空的。")
    else:
        for name, detail in items:
            lines.append(f"- {name}：{detail}")
    lines.extend(["", *medication_lines(meds, items), "", *lab_lines(labs), "", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def report(out, age, medications, labs, measurements=None):
    out.mkdir(parents=True, exist_ok=True)
    path = out / "report.md"
    path.write_text(render(age, medications, labs, measurements), encoding="utf-8")
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


if __name__ == "__main__":
    main()
