#!/usr/bin/env python3
"""Personal readout of printed rare-variant ANM effects."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import BOUNDARY, EFFECTS, MASK_LABEL, TABLE_BETA


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


def mask_kind(text):
    token = text.strip().lower().replace(" ", "").replace("_", "").replace("-", "")
    if token in {"", "carrier", "携带", "yes", "是", "有"}:
        return ""
    if token in {"hcptv", "ptv", "truncating", "lof", "截短", "高置信截短", "高置信蛋白截短"}:
        return "hc-ptv"
    if token in {"dmg", "damaging", "损伤", "有害"}:
        return "damaging"
    if token in {"missense", "错义", "cadd"}:
        return "missense"
    return "other"


def sex_kind(text):
    token = text.strip().lower()
    if token in {"f", "female", "woman", "女", "女性"}:
        return "female"
    if token in {"m", "male", "man", "男", "男性"}:
        return "male"
    return ""


def _pairs(values):
    sex = ""
    pairs = []
    pending_gene = ""
    for name, value in values.items():
        key = name.strip()
        folded = key.lower()
        if folded in {"sex", "性别"}:
            sex = sex_kind(value)
            continue
        if folded in {"gene", "基因"}:
            pending_gene = value.strip().upper()
            continue
        if folded in {"mask", "掩码"} and pending_gene:
            pairs.append((pending_gene, value))
            pending_gene = ""
            continue
        symbol = key.upper()
        if symbol in EFFECTS or any(gene == symbol for gene, _mask in TABLE_BETA):
            pairs.append((symbol, value))
    if pending_gene:
        pairs.append((pending_gene, ""))
    return pairs, sex


def _table_line(symbol, asked):
    asked_mask = mask_kind(asked) or "hc-ptv"
    row = TABLE_BETA.get((symbol, asked_mask))
    if row is None:
        return (
            f"{symbol}。Supplementary Table 2 没有读到这个掩码的 Beta 列，不算年数。"
        )
    beta, se, exome = row
    direction = "早" if beta.startswith("-") else "晚"
    years = beta[1:] if beta.startswith("-") else beta
    scope = "这一行过正文使用的全外显子阈值。" if exome else "这一行在同一张表里，但不是正文宣布为全外显子显著的那一行。"
    return (
        f"{symbol}。{scope}{MASK_LABEL[asked_mask]}在 34 岁截尾的 BOLT Beta 列是"
        f"绝经年龄{direction} {years} 年，标准误 {se}。"
        "表里没有现成的区间列，这里不另算区间。没有截距，不是预测绝经年龄。"
    )


def _effect_line(symbol, asked, sex):
    if any(gene == symbol for gene, _mask in TABLE_BETA):
        return _table_line(symbol, asked)
    effect = EFFECTS.get(symbol)
    if effect is None:
        return f"{symbol}。正文没有写出这个基因的年数，技能也没有读入它在 Supplementary Table 2 的 Beta 行，不算年数。"
    asked_mask = mask_kind(asked)
    if asked_mask and asked_mask != effect["mask"]:
        return (
            f"{symbol}。正文写出年数的掩码是{MASK_LABEL[effect['mask']]}，不是这次给的掩码。"
            "这个掩码在 Supplementary Table 2 里有 Beta 列，但这一行没有读入技能，不算年数。"
        )
    sentence = (
        f"{symbol}。{effect['scope']}{MASK_LABEL[effect['mask']]}携带者的自然绝经年龄"
        f"{effect['direction']} {effect['years']} 年（区间 {effect['ci']} 年）。"
        "这是女性携带者相对对照的差，不是加了截距的预测绝经年龄。"
    )
    if effect.get("menarche"):
        sentence += effect["menarche"]
    if symbol == "SAMHD1" and effect["mask"] == "damaging" and asked_mask in {"", "damaging"}:
        if sex == "female":
            sentence += "女性全癌比值比 1.61（区间 1.31 到 1.96）。"
        elif sex == "male":
            sentence += "男性全癌比值比 2.12（区间 1.72 到 2.62）。绝经年数仍是女性携带者的结果。"
        else:
            sentence += "缺性别，不选男性或女性的全癌比值比。"
    return sentence


def build(values, age):
    del age
    pairs, sex = _pairs(values)
    lines = []
    for symbol, asked in pairs:
        lines.append(f"{len(lines) + 1}. {_effect_line(symbol, asked, sex)}")
    if lines:
        intro = "这次只对照正文写出的携带者年数。没有截距，所以不算预测的绝经年龄。"
    else:
        intro = "这次没有点到正文写出年数的基因。没有截距，所以不算预测的绝经年龄。"
    missing = [
        "不能算后代新生突变条数。缺的是先前常见变异研究里每个变异的效应列，以及截距。本文给出的是队列回归，不是这份个人加总。",
    ]
    return lines, missing, ("# 卵巢衰老与癌症突变", intro)


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
