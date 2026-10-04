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
    start = 1 if "," in lines[0] and lines[0].split(",")[0].strip().lower() in {"name", "项目", "key", "item", "marker"} else 0
    for line in lines[start:]:
        cells = [cell.strip() for cell in line.split(",")]
        if len(cells) < 2 or not cells[0]:
            continue
        rows[cells[0]] = cells[1]
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

from presets import CUTOFF, far_value, interval_bin


def build(values, age):
    del age
    lines = []
    notes = []
    needed = ("face_age_1", "face_age_2", "interval_days")
    if all(key in values for key in needed):
        face1 = float(values["face_age_1"])
        face2 = float(values["face_age_2"])
        days = float(values["interval_days"])
        if days <= 0:
            intro_text = "间隔天数不是正数，所以没有老化速率。"
            intro = ("# 面容老化速率", intro_text)
            return [], [], intro
        rate = far_value(face1, face2, days)
        line = f"1. 面容老化速率。FAR 是 {rate:.4f}。大于 1 是快于历法时间的定义，不是治疗指示。"
        found = interval_bin(days)
        if found is None:
            line += " 天数不在 10–365、366–730 或 731–1460 里，所以不套用分档的界，也不引用 Fig. 3 的风险比。"
            intro_text = f"这次的面容老化速率是 {rate:.4f}。天数不在论文分的三档里，所以没有对照分档的界。"
        else:
            name, point, low, high, _n = found
            label = {"short": "短间隔", "mid": "中间隔", "long": "长间隔"}[name]
            cutoff = CUTOFF[name]
            side = "超过" if rate > cutoff else "没有超过"
            line += (
                f" 天数落在{label}。这一档生存分析用的界是 FAR > {cutoff:g}。这次{side}这个界。"
                f"论文在这一档的队列风险比是 {point:.2f}"
                f"（95% CI {low:.2f}–{high:.2f}）。这不是按本次 FAR 换算的个人风险。"
            )
            intro_text = (
                f"这次的面容老化速率是 {rate:.4f}。天数落在{label}，{side}这一档 FAR > {cutoff:g} 的界。"
            )
        lines.append(line)
    if not lines:
        intro_text = "这次没有同时给出两次面容年龄和间隔天数，所以没有老化速率。"
    if any(name.lower().endswith((".jpg", ".png", ".jpeg")) or name.lower() == "photo" for name in values):
        intro_text += "仓库没有放出模型文件，不能从照片估计面容年龄。"
    intro = ("# 面容老化速率", intro_text)
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
