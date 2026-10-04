#!/usr/bin/env python3
"""Personal readout for oocyte complex I stage calls."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import BOUNDARY, COMPLEXES, STAGE_ALIASES, STAGES


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
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
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


def _stage_from(text):
    folded = text.strip().lower().replace(" ", "")
    if folded in STAGE_ALIASES:
        return STAGE_ALIASES[folded]
    spaced = text.strip().lower()
    return STAGE_ALIASES.get(spaced)


def _complex_from(text):
    token = text.strip().upper().replace("COMPLEX", "").replace("复合体", "").strip()
    if token in {"1", "I", "CI"}:
        return "I"
    if token in {"2", "II", "CII"}:
        return "II"
    if token in {"3", "III", "CIII"}:
        return "III"
    if token in {"4", "IV", "CIV"}:
        return "IV"
    if token in {"5", "V", "CV"}:
        return "V"
    return None


def build(values, age):
    del age
    stage = None
    complex_id = None
    for name, value in values.items():
        key = name.strip().lower()
        if key in {"stage", "卵母细胞阶段", "阶段"}:
            stage = _stage_from(value) or stage
        elif key in {"complex", "复合体"}:
            complex_id = _complex_from(value) or complex_id
        else:
            found = _stage_from(name) or _stage_from(value)
            if found and key in {"name", "item"}:
                stage = found
    lines = []
    if stage:
        lines.append(f"{len(lines) + 1}. 阶段 {stage}。{STAGES[stage]}")
    if complex_id:
        extra = ""
        if complex_id == "I" and stage in {"I", "II"}:
            extra = "你给的阶段属于早期，图 2 写这一阶段在鱼藤酮里过夜仍存活。"
        elif complex_id == "I" and stage in {"III", "VI"}:
            extra = "你给的阶段属于较晚阶段，图 2 写这一阶段在鱼藤酮里过夜不能存活。"
        lines.append(f"{len(lines) + 1}. 复合体 {complex_id}。{COMPLEXES[complex_id]}{extra}")
    if lines:
        intro = "这次按正文的阶段和复合体写出组装与存活方向。Supplementary Table 1 是重复样本的蛋白丰度，没有截距，所以没有蛋白分数。"
    else:
        intro = "这次没有点到正文里的卵母细胞阶段或复合体。Supplementary Table 1 是重复样本的蛋白丰度，没有截距，所以没有蛋白分数。"
    missing = [
        "不能算个人蛋白丰度或活性氧分数。缺的是截距列。Supplementary Table 1 打开后的列是基因名、唯一肽段和 I 期、VI 期、肌肉的重复丰度。",
        "年龄不进入这套分期。",
    ]
    return lines, missing, ("# 卵母细胞线粒体复合体", intro)


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
