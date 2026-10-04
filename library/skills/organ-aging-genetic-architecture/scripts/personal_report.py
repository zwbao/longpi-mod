#!/usr/bin/env python3
from __future__ import annotations

from paper_card import lines as paper_card_lines


import argparse
import sys
from pathlib import Path

from presets import BOUNDARY

LAB_NAMES = ("谷丙转氨酶", "谷草转氨酶", "肌酐", "肾小球滤过率", "血红蛋白", "血小板")


def load_measurements(path):
    if path is None:
        return {}
    text = path.read_text(encoding="utf-8")
    rows = {}
    lines = [line for line in text.splitlines() if line.strip() and not line.strip().startswith("#")]
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
    found = []
    lines = text.splitlines()
    if lines and "项目" in lines[0] and "," in lines[0]:
        import csv
        for row in csv.DictReader(lines):
            name = (row.get("项目") or row.get("name") or "").strip()
            value = (row.get("结果") or row.get("value") or "").strip()
            unit = (row.get("单位") or row.get("unit") or "").strip()
            if name:
                found.append((name, value, unit))
        return found
    for marker in LAB_NAMES:
        if marker in text:
            found.append((marker, "", ""))
    return found


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

from presets import ALIASES, DISPLAY, MR, ORGANS, SMOKING_ORGANS


def build(values, age):
    del age
    named = []
    for name in values:
        key = ALIASES.get(name.strip()) or ALIASES.get(name.strip().lower())
        if key and key not in named:
            named.append(key)
    named.sort(key=ORGANS.index)
    lines = []
    for key in named:
        extra = MR.get(key, "摘要没有单独写这个器官的孟德尔随机化方向。")
        lines.append(f"{len(lines)+1}. {DISPLAY[key]}。{extra}")
    smoking = values.get("smoking_initiation", "").strip().lower() in {"yes", "y", "1", "是", "有"}
    if lines:
        intro_text = "这次只列出你点到的器官。Supplementary Data 3 有特征权重，没有截距，所以没有算出器官生物年龄。"
    else:
        intro_text = "这次没有点到论文里的器官。Supplementary Data 3 有特征权重，没有截距，所以没有算出器官生物年龄。"
    if smoking:
        shown = "、".join(DISPLAY[key] for key in SMOKING_ORGANS)
        intro_text += f"测量文件写了吸烟起始。论文把吸烟起始和{shown}的衰老连在一起。未点名的器官不因此写入名单。"
    intro = ("# 器官衰老遗传结构", intro_text)
    return lines, [], intro


def render(list_lines, notes, meds, labs, intro):
    del notes
    body = [intro[0], "", intro[1], "", "## 方法算出的名单"]
    body.extend(list_lines or ["没有项目进入名单。"])
    body.extend(["", *medication_lines(meds, list_lines)])
    body.extend(["", *lab_block(labs)])
    body.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(body) + "\n"


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
