#!/usr/bin/env python3
"""Personal readout of the printed human age windows and organ directions."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import BOUNDARY, COMPOUNDS, ORGAN_ALIASES, ORGAN_NAME, ORGANS


def load_measurements(path):
    if path is None:
        return {}
    rows = {}
    lines = [
        line
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]
    if not lines:
        return rows
    start = 1 if "," in lines[0] and lines[0].split(",")[0].strip().lower() in {"name", "项目", "key"} else 0
    for line in lines[start:]:
        if "," not in line:
            continue
        key, value = line.split(",", 1)
        rows[key.strip()] = value.strip()
    return rows


def load_medications(path):
    if path is None:
        return []
    names = []
    for line in path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            names.append(text)
    return names


def parse_labs(path):
    if path is None:
        return []
    lines = path.read_text(encoding="utf-8").splitlines()
    if lines and "项目" in lines[0] and "," in lines[0]:
        import csv

        found = []
        for row in csv.DictReader(lines):
            name = (row.get("项目") or row.get("name") or "").strip()
            value = (row.get("结果") or row.get("value") or "").strip()
            unit = (row.get("单位") or row.get("unit") or "").strip()
            if name:
                found.append((name, value, unit))
        return found
    return []


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
        shown = " ".join(part for part in (name, value, unit) if part)
        rows.append(f"- {shown}")
    return rows


def age_sentence(age):
    if age is None:
        return None
    if 20 <= age <= 25:
        return f"年龄 {age:g} 岁，落在正文的年轻窗：20 到 25 岁。"
    if age > 35:
        return f"年龄 {age:g} 岁，落在正文的中年窗：大于 35 岁。"
    return f"年龄 {age:g} 岁，不在正文的年轻窗（20 到 25 岁）或中年窗（大于 35 岁）里。"


def build(values, age):
    lines = []
    sentence = age_sentence(age)
    if sentence:
        lines.append(f"1. {sentence}")
    seen = []
    for name, value in values.items():
        token = name.strip()
        other = value.strip()
        for candidate in (token, other):
            organ = ORGAN_ALIASES.get(candidate) or ORGAN_ALIASES.get(candidate.lower())
            if organ and organ not in seen:
                seen.append(organ)
                lines.append(f"{len(lines) + 1}. {ORGAN_NAME[organ]}。{ORGANS[organ]}")
            compound = candidate.lower().replace(" ", "").replace("-", "")
            if compound in COMPOUNDS and compound not in seen:
                seen.append(compound)
                lines.append(f"{len(lines) + 1}. {candidate}。{COMPOUNDS[compound]}")
    if lines:
        intro = "这次只放置正文写出的年龄窗，并对照点到的器官或化合物。没有个人 NAD 分数。"
    else:
        intro = "这次没有年龄，也没有点到正文里的器官。没有个人 NAD 分数。"
    missing = [
        "不能算个人 CD38 或 NAD+ 分数。Supplementary Table 1 是小鼠各组织 RNA-seq 的基因和 count 列，没有截距。",
        "Supplementary Table 2 的中年年龄单元格和正文对不上，不用那一格给年龄窗。",
    ]
    return lines, missing, ("# 卵巢烟酰胺酶", intro)


def render(list_lines, notes, meds, labs, intro):
    body = [intro[0], "", intro[1], "", "## 方法算出的名单"]
    body.extend(list_lines or ["没有项目进入名单。"])
    body.extend(["", "## 不能算的结果", ""])
    body.extend(f"- {note}" for note in notes)
    body.extend(["", *medication_lines(meds, list_lines)])
    body.extend(["", *lab_block(labs)])
    body.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(body) + "\n"


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


def report(out, measurements=None, medications=None, labs=None, age=None):
    values = load_measurements(measurements)
    list_lines, notes, intro = build(values, age)
    text = render(list_lines, notes, load_medications(medications), parse_labs(labs), intro)
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


if __name__ == "__main__":
    sys.exit(main())
