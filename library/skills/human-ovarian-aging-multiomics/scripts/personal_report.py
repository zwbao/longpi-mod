#!/usr/bin/env python3
"""Personal readout of printed ovarian age groups, cell directions, and ST6 genes."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import BOUNDARY, CELL_ALIASES, CELLS, NAMED, PATHWAYS, ST6_GENES


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
    if 23 <= age <= 29:
        return f"年龄 {age:g} 岁，落在正文的年轻组：23 到 29 岁。"
    if 49 <= age <= 54:
        return f"年龄 {age:g} 岁，落在正文的生殖年龄较大组：49 到 54 岁。"
    return "给出的年龄不在正文的两组里：23 到 29 岁，或 49 到 54 岁。"


def _skip(token):
    return token.strip().lower() in {"", "named", "yes", "y", "name", "value", "1", "是"}


def _one(token, seen):
    if _skip(token):
        return None
    low = token.strip().lower()
    if low in CELL_ALIASES:
        key = "cell:" + CELL_ALIASES[low]
        if key in seen:
            return None
        seen.add(key)
        return CELLS[CELL_ALIASES[low]]
    if low in PATHWAYS:
        key = "path:" + low
        if key in seen:
            return None
        seen.add(key)
        return PATHWAYS[low]
    symbol = token.strip().upper()
    if symbol in NAMED or symbol in ST6_GENES:
        key = "gene:" + symbol
        if key in seen:
            return None
        seen.add(key)
        parts = []
        if symbol in NAMED:
            parts.append(NAMED[symbol])
        if symbol in ST6_GENES:
            parts.append("它在 Supplementary Table 6 的 gene 列。这张表没有权重或截距。")
        return f"{symbol}。" + "".join(parts)
    if token.strip().isascii() and any(ch.isalpha() for ch in token):
        key = "miss:" + symbol
        if key in seen:
            return None
        seen.add(key)
        return (
            f"{symbol}。不在 Supplementary Table 6 的 gene 列，正文也没有单独写它的方向。"
            "Supplementary Table 4 已打开，列是 gene、p_val、avg_log2FC、pct.1、pct.2、p_val_adj、cluster。没有截距，这一行没有按阈值判定，不能说它有没有差异。"
        )
    return None


def build(values, age):
    lines = []
    seen = set()
    sentence = age_sentence(age)
    if sentence:
        lines.append(f"{len(lines) + 1}. {sentence}")
    for name, value in values.items():
        for candidate in (name, value):
            item = _one(candidate, seen)
            if item:
                lines.append(f"{len(lines) + 1}. {item}")
    if lines:
        intro = "这次放置正文的年龄组，并对照点到的细胞、通路或基因。没有个人卵巢年龄。"
    else:
        intro = "这次没有点到正文的年龄组、细胞或基因。没有个人卵巢年龄。"
    missing = [
        "不能算个人卵巢年龄，也不能把变异加成一个分数。Supplementary Table 14 有 Ruth 等的 Effect 和标准误，没有截距，本文也没有规定把哪些变异加总。",
        "Supplementary Table 4 已打开，列是 gene、p_val、avg_log2FC、pct.1、pct.2、p_val_adj、cluster，没有截距。Supplementary Table 6 只有 gene 一列。",
    ]
    return lines, missing, ("# 人卵巢单核多组学", intro)


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
