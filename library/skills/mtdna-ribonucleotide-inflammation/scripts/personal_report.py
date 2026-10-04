#!/usr/bin/env python3
"""Match supplied gene names to the printed interferon-stimulated-gene panel."""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import BOUNDARY, ISGS, TITLE

PANEL = {name.casefold(): name for name in ISGS}
RATIO_KEYS = {"rntp_dntp", "rntp/dntp", "核糖核苷酸比"}


def load_measurements(path):
    if path is None:
        return {}
    rows = {}
    lines = [line for line in path.read_text(encoding="utf-8").splitlines() if line.strip() and not line.strip().startswith("#")]
    if not lines:
        return rows
    start = 1 if "," in lines[0] and lines[0].split(",")[0].strip().lower() in {"name", "项目", "key", "item"} else 0
    for line in lines[start:]:
        if "," not in line:
            continue
        key, value = line.split(",", 1)
        rows[key.strip()] = value.strip()
    return rows


def load_medications(path):
    if path is None:
        return []
    return [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip() and not line.strip().startswith("#")]


def parse_labs(path):
    if path is None:
        return []
    lines = [line for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    if not lines:
        return []
    if "项目" in lines[0] and "," in lines[0]:
        found = []
        for row in csv.DictReader(lines):
            name = (row.get("项目") or row.get("name") or "").strip()
            value = (row.get("结果") or row.get("value") or "").strip()
            unit = (row.get("单位") or row.get("unit") or "").strip()
            if name:
                found.append((name, value, unit))
        return found
    return [(line.strip(), "", "") for line in lines]


def medication_lines(medications, list_lines):
    lines = ["## 你正在使用的药", ""]
    if not medications:
        lines.append("没有提供现用药。")
        return lines
    blob = "\n".join(list_lines)
    for name in medications:
        if name and name in blob:
            lines.append(f"- {name}：这个名字出现在方法名单里。不能据此停。")
        else:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def lab_block(labs):
    rows = ["## 体检", ""]
    if not labs:
        rows.append("没有提供体检。体检不增删方法算出的名单。")
        return rows
    rows.append("下面照录体检数值。体检不增删方法算出的名单。")
    for name, value, unit in labs:
        rows.append("- " + " ".join(part for part in (name, value, unit) if part))
    return rows


def build(values, age):
    computed = []
    missing = [
        "z 分数缺 nanoString log2 强度的均值和标准差这两列。",
        "核糖核苷酸与脱氧核糖核苷酸的比值没有印出个人切点。",
    ]
    seen = set()
    used = set()
    for key, value in values.items():
        folded = key.casefold()
        if folded in RATIO_KEYS:
            used.add(key)
            missing.append(f"给出了比值 {value}。缺参照分布的均值、标准差，也没有个人切点，不算高低。")
            continue
        symbol = PANEL.get(folded)
        if symbol is None or symbol in seen:
            if symbol:
                used.add(key)
            continue
        seen.add(symbol)
        used.add(key)
        computed.append(f"{symbol}：测量值 {value}。这是热图上的干扰素刺激基因，没有权重。")
    if age is not None:
        missing.append("这篇没有把人的年龄写成炎症切点，年龄不进入名单。")
    unknown = [key for key in values if key not in used]
    if unknown:
        missing.append("这些名字不在正文热图的基因里，没有拿 INTERFEROME 全库来补：" + "、".join(unknown) + "。")
    return computed, missing


def render(computed, missing, meds, labs):
    intro = "这次只对照正文热图上印出的干扰素刺激基因。没有给这些基因配权重。"
    body = [f"# {TITLE}", "", intro, "", "## 能算的", ""]
    body.append("能算的结果写在方法名单里。" if computed else "这次没有对上热图上的基因。")
    body.extend(["", "## 不能算的", ""])
    body.extend(missing)
    body.extend(["", "## 方法算出的名单", ""])
    body.extend([f"{i}. {line}" for i, line in enumerate(computed, start=1)] or ["没有项目进入名单。"])
    body.extend(["", *medication_lines(meds, computed)])
    body.extend(["", *lab_block(labs)])
    body.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(body) + "\n"


def report(out, measurements=None, medications=None, labs=None, age=None):
    computed, missing = build(load_measurements(measurements), age)
    text = render(computed, missing, load_medications(medications), parse_labs(labs))
    out.mkdir(parents=True, exist_ok=True)
    destination = out / "report.md"
    destination.write_text(_with_paper_card(text), encoding="utf-8")
    return destination


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--measurements", type=Path, default=None)
    parser.add_argument("--medications", type=Path, default=None)
    parser.add_argument("--labs", type=Path, default=None)
    parser.add_argument("--age", type=float, default=None)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    print(report(args.out, args.measurements, args.medications, args.labs, args.age))
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
