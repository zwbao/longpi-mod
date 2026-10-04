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

from presets import predict_age, sites_for


def parse_sites(path):
    observed = {}
    if path is None:
        return observed
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if not text or text.startswith("#") or text.startswith("site"):
            continue
        site, raw = text.split()[:2]
        observed[site] = float(raw)
    return observed


def medication_lines(names, used):
    wanted = set(used)
    lines = ["## 你正在使用的药", ""]
    if not names:
        lines.append("没有提供现用药。")
        return lines
    for name in names:
        if name in wanted:
            lines.append(f"- {name}：这个名字出现在方法名单里。不能据此停。")
        else:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def render(age, meds, labs, measurements):
    del age
    observed = parse_sites(measurements)
    used = sites_for(observed) if observed else []
    predicted = predict_age(observed) if used else None
    if not observed:
        lead = "没有位点甲基化，所以没有周龄。"
    elif predicted is None:
        lead = "能用的位点不够，所以没有周龄。"
    else:
        weeks, used = predicted
        lead = f"用你给的位点算出了周龄，是 {weeks} 周。"
    lines = ["# 单细胞甲基化周龄", "", lead, "", "## 方法算出的名单", ""]
    if used:
        for site in used:
            lines.append(f"- {site}：{observed[site]:g}")
    else:
        lines.append("名单是空的。")
    if predicted is not None:
        weeks, _used = predicted
        lines.append(f"- 周龄：{weeks} 周")
    lines.extend(["", *medication_lines(load_lines(meds), used), "", *lab_lines(labs), "", f"边界: {BOUNDARY}"])
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
