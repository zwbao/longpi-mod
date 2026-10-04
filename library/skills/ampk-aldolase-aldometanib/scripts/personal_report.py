#!/usr/bin/env python3
"""Fasting glucose difference. Published assay numbers stay in presets.py."""

from __future__ import annotations

import argparse
import csv
from decimal import Decimal, InvalidOperation
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import BOUNDARY, COMPOUND_ALIASES

TITLE = "# 醛缩酶抑制剂与空腹血糖"
BEFORE_KEYS = ("fasting_glucose_before_mM", "空腹血糖前", "空腹血糖基线")
AFTER_KEYS = ("fasting_glucose_after_mM", "空腹血糖后", "空腹血糖随访")
SERUM_KEYS = ("serum_aldometanib_nM", "血清aldometanib")


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


def medication_lines(meds):
    lines = ["## 你正在使用的药", ""]
    if not meds:
        lines.append("没有提供现用药。不能据此停。")
        return lines
    for name in meds:
        folded = name.lower().replace(" ", "").replace("-", "")
        hit = None
        for alias, display in COMPOUND_ALIASES:
            if alias.replace("-", "") in folded:
                hit = display
                break
        if hit:
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
    text = format(value, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text


def method_lines(kv):
    lines = ["## 方法算出的名单", ""]
    before_key, before_raw = first_present(kv, BEFORE_KEYS)
    after_key, after_raw = first_present(kv, AFTER_KEYS)
    before = as_decimal(before_raw)
    after = as_decimal(after_raw)
    if before_key is None or after_key is None:
        missing = []
        if before_key is None:
            missing.append("fasting_glucose_before_mM")
        if after_key is None:
            missing.append("fasting_glucose_after_mM")
        lines.append("- 空腹血糖差值：缺 " + "、".join(missing) + "。")
        intro = "两次空腹血糖没有到齐，所以没有做差。"
    elif before is None or after is None:
        lines.append("- 空腹血糖差值：给出的数读不了，这次没有做差。")
        intro = "空腹血糖里有读不了的数，所以没有做差。"
    else:
        delta = after - before
        lines.append(f"- 空腹血糖差值：{show_num(delta)}。这是你的两个数相减。")
        intro = f"空腹血糖差值是 {show_num(delta)}。"
    serum_key, serum_raw = first_present(kv, SERUM_KEYS)
    if serum_key is None:
        lines.append("- 血清 aldometanib：缺 serum_aldometanib_nM。")
    else:
        lines.append(f"- 血清 aldometanib：记下 {serum_raw}。没有拿它换算剂量。")
    lines.append("- aldometanib：实验里的化合物名字。")
    return intro, lines


def cannot_lines():
    return [
        "## 这次算不了",
        "",
        "- 寿命。补充信息里的寿命表是队列的均值和中位数，没有个人系数列。",
        "- 人用剂量。缺这一列。",
    ]


def render(age, meds, labs, measurements):
    kv = load_kv(measurements)
    intro, listed = method_lines(kv)
    if age is not None:
        intro = f"年龄记下了。{intro}"
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
