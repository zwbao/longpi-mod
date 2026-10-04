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

from presets import ORGAN_LABELS, ORGANS, PROTEINS, age_gap


def parse_organs(path):
    found = {}
    if path is None:
        return found
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if not text or text.startswith("#"):
            continue
        if "," in text:
            cells = [cell.strip() for cell in text.split(",")]
            if not cells or cells[0].lower() in {"marker", "item", "name", "key", "项目"}:
                continue
            if len(cells) < 2:
                continue
            key, raw = cells[0].lower(), cells[1]
        else:
            parts = text.split()
            if len(parts) < 2:
                continue
            key, raw = parts[0].lower(), parts[1]
        if key in ORGAN_LABELS:
            found[key] = float(raw)
    return found


def medication_lines(names):
    proteins = {name for name, _organ in PROTEINS}
    lines = ["## 你正在使用的药", ""]
    if not names:
        lines.append("没有提供现用药。")
        return lines
    for name in names:
        if name in proteins:
            lines.append(f"- {name}：这个名字出现在方法名单里。不能据此停。")
        else:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def render(age, meds, labs, measurements):
    organs = parse_organs(measurements)
    gaps = {}
    if age is not None:
        for key, predicted in organs.items():
            gaps[key] = age_gap(predicted, age)
    if age is None or not organs:
        lead = "没有实足年龄或器官预测年龄，所以没有年龄差。"
    elif all(key in gaps for key in ORGANS):
        mean_gap = sum(gaps[key] for key in ORGANS) / len(ORGANS)
        lead = (
            f"用预测年龄减去实足年龄，七个器官的年龄差平均是 {mean_gap:.4f} 年。"
            "偏差校正的截距没有印在正文里。"
        )
    else:
        lead = "用预测年龄减去实足年龄，算出了已有器官的年龄差。偏差校正的截距没有印在正文里。"
    lines = ["# 影像器官年龄差", "", lead, "", "## 方法算出的名单", ""]
    if not gaps:
        lines.append("这次没有年龄差。")
    for key, predicted in organs.items():
        if key not in gaps:
            continue
        lines.append(f"- {ORGAN_LABELS[key]}：预测年龄 {predicted:g} 岁，年龄差 {gaps[key]:g} 年。")
    if age is not None and all(key in gaps for key in ORGANS):
        mean_gap = sum(gaps[key] for key in ORGANS) / len(ORGANS)
        lines.append(f"七个器官的年龄差平均是 {mean_gap:.4f} 年。灰质和白质没有并进这个平均。")
    lines.extend(["", *medication_lines(load_lines(meds)), "", *lab_lines(labs), "", f"边界: {BOUNDARY}"])
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
