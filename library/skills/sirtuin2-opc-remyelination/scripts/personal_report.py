#!/usr/bin/env python3
"""Nucleus-to-total SIRT2 ratio. The mouse dose is not a human dose."""

from __future__ import annotations

import argparse
import csv
from decimal import Decimal, InvalidOperation
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import BOUNDARY, COMPOUND_ALIASES, nucleus_ratio

TITLE = "# 少突胶质前体细胞里的核内去乙酰化酶"
NUCLEUS_KEYS = ("sirt2_nucleus", "核内SIRT2", "核内")
TOTAL_KEYS = ("sirt2_total", "SIRT2总量", "总量")


def read_rows(path):
    if path is None:
        return []
    with path.open(encoding="utf-8-sig", newline="") as handle:
        sample = handle.read(4096)
        handle.seek(0)
        if not sample.strip():
            return []
        dialect = csv.Sniffer().sniff(sample, delimiters=",\t")
        return list(csv.DictReader(handle, dialect=dialect))


def load_kv(path):
    rows = read_rows(path)
    out = {}
    if not rows:
        return out
    fields = {name.strip().lower(): name for name in rows[0].keys() if name}
    name_key = fields.get("name") or fields.get("item") or fields.get("项目")
    value_key = fields.get("value") or fields.get("结果")
    if name_key and value_key:
        for row in rows:
            key = (row.get(name_key) or "").strip()
            if key:
                out[key] = (row.get(value_key) or "").strip()
        return out
    if len(rows) == 1:
        return {key.strip(): (value or "").strip() for key, value in rows[0].items() if key}
    return out


def load_meds(path):
    if path is None:
        return []
    names = []
    for line in path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            names.append(text)
    return names


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
    return lines


def match_compound(name):
    folded = name.lower().replace(" ", "").replace("－", "-")
    for alias, display in COMPOUND_ALIASES:
        if alias.lower().replace(" ", "") in folded:
            return display
    return None


def medication_lines(meds):
    lines = ["## 你正在使用的药", ""]
    if not meds:
        lines.append("没有提供现用药。不能据此停。")
        return lines
    for name in meds:
        if match_compound(name):
            lines.append(f"- {name}：这个名字出现在名单里。不能据此停。")
        else:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def first_present(kv, keys):
    for key in keys:
        if key in kv and kv[key] != "":
            return key, kv[key]
    return None, None


def as_decimal(text):
    if text is None:
        return None
    raw = str(text).strip().replace("＋", "+").replace("－", "-")
    if raw == "":
        return None
    try:
        return Decimal(raw)
    except InvalidOperation:
        return None


def show_num(value: Decimal) -> str:
    return format(value, ".4f")


def method_lines(kv):
    lines = ["## 方法算出的名单", ""]
    nucleus_key, nucleus_raw = first_present(kv, NUCLEUS_KEYS)
    total_key, total_raw = first_present(kv, TOTAL_KEYS)
    nucleus = as_decimal(nucleus_raw)
    total = as_decimal(total_raw)
    if nucleus_key is None or total_key is None:
        missing = []
        if nucleus_key is None:
            missing.append("sirt2_nucleus")
        if total_key is None:
            missing.append("sirt2_total")
        lines.append("- 核内比总量：缺 " + "、".join(missing) + "。")
        intro = "核内量和总量没有到齐，所以没有算比例。"
    elif nucleus is None or total is None:
        lines.append("- 核内比总量：给出的数读不了，这次没有算比例。")
        intro = "核内量或总量读不了，所以没有算比例。"
    else:
        ratio = nucleus_ratio(nucleus, total)
        if ratio is None:
            lines.append("- 核内比总量：总量是 0，不算比例。")
            intro = "总量是 0，所以没有算比例。"
        else:
            shown = show_num(ratio)
            lines.append(f"- 核内比总量：{shown}。这是你的核内量除以总量。")
            intro = f"核内比总量是 {shown}。"
    lines.append("- β-NMN：实验里用的前体名字。")
    return intro, lines


def cannot_lines():
    return [
        "## 这次算不了",
        "",
        "- 人用剂量。方法写了小鼠腹腔给药，没有人用剂量列。",
        "- 和青年样本的比较。缺你自己的青年参照列，不用队列里的比例去填。",
    ]


def render(age, meds, labs, measurements):
    kv = load_kv(measurements)
    intro, listed = method_lines(kv)
    if age is not None:
        intro = f"年龄记下了，不进入比例。{intro}"
    lines = [TITLE, "", intro, ""]
    lines.extend(listed)
    lines.extend(["", *cannot_lines(), "", *medication_lines(load_meds(meds)), "", *lab_lines(labs)])
    lines.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def _with_paper_card(text):
    if "## 论文卡片" in text:
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


def report(out, meds, labs, measurements, age=None):
    out.mkdir(parents=True, exist_ok=True)
    path = out / "report.md"
    path.write_text(_with_paper_card(render(age, meds, labs, measurements)), encoding="utf-8")
    return path


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
