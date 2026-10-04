#!/usr/bin/env python3
"""Personal readout. Published numbers live in presets.py."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import BOUNDARY, evaluate


def read_rows(path):
    if path is None:
        return []
    text = path.read_text(encoding="utf-8-sig")
    if not text.strip():
        return []
    try:
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=",\t")
    except csv.Error:
        dialect = csv.excel
    return list(csv.DictReader(text.splitlines(), dialect=dialect))


def load_meds(path):
    if path is None:
        return []
    names = []
    for line in path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            names.append(text)
    return names


def norm(text):
    return (
        (text or "")
        .strip()
        .casefold()
        .replace(" ", "")
        .replace("-", "")
        .replace("_", "")
        .replace("–", "")
        .replace("−", "")
        .replace("α", "a")
        .replace("β", "b")
    )


def medication_lines(meds, names):
    lines = ["## 你正在使用的药", ""]
    if not meds:
        lines.append("没有提供现用药。不能据此停。")
        return lines
    known = {norm(name) for name in names if norm(name)}
    for name in meds:
        token = norm(name)
        hit = False
        for alias in known:
            if len(alias) >= 3 and (alias == token or alias in token or token in alias):
                hit = True
                break
        if hit:
            lines.append(f"- {name}：这个名字出现在名单里。不能据此停。")
        else:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def lab_lines(path):
    rows = read_rows(path)
    lines = ["## 体检", ""]
    if not rows:
        lines.append("没有提供体检。体检不增删方法算出的名单。")
        return lines
    lines.append("下面照录体检数值。体检不增删方法算出的名单。")
    for row in rows:
        lowered = {(k or "").strip(): (v or "").strip() for k, v in row.items()}
        item = lowered.get("项目") or lowered.get("item") or ""
        value = lowered.get("结果") or lowered.get("value") or lowered.get("result") or ""
        unit = lowered.get("单位") or lowered.get("unit") or ""
        if item and value:
            suffix = f" {unit}" if unit else ""
            lines.append(f"- {item} {value}{suffix}")
        else:
            bits = [f"{key} {value}".strip() for key, value in lowered.items() if key and value]
            if bits:
                lines.append("- " + "，".join(bits))
    return lines


def write_report(out, text):
    out.mkdir(parents=True, exist_ok=True)
    path = out / "report.md"
    if not text.endswith("\n"):
        text += "\n"
    path.write_text(_with_paper_card(text), encoding="utf-8")
    return path


def finish(lines):
    lines.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


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


def render(rows, meds, labs, age):
    from presets import TITLE

    intro, can, cannot, items, med_names = evaluate(rows, age)
    lines = [TITLE, "", intro, "", "## 能算的", "", can, "", "## 不能算的", "", cannot, "", "## 方法算出的名单", ""]
    if items:
        lines.extend(f"- {item}" for item in items)
    else:
        lines.append("没有项目进入名单。")
    lines.extend(["", *medication_lines(meds, med_names)])
    lines.extend(["", *lab_lines(labs)])
    return finish(lines)


def report(out, meds, labs, measurements, age=None):
    text = render(read_rows(measurements), load_meds(meds), labs, age)
    return write_report(out, text)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--measurements", type=Path)
    parser.add_argument("--medications", type=Path)
    parser.add_argument("--labs", type=Path)
    parser.add_argument("--age", type=float)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    print(report(args.out, args.medications, args.labs, args.measurements, args.age))


if __name__ == "__main__":
    main()
