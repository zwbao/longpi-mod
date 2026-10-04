#!/usr/bin/env python3
"""Split the paper's NAMPT effects by whether they require hepatocyte SIRT1."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import ABSENT, BOUNDARY, PRESENT, SIRT1_DISPENSABLE, SIRT1_REQUIRED

TITLE = "# 肝细胞烟酰胺磷酸核糖转移酶的两类效应"
STATUS_KEYS = ("hepatocyte_sirt1", "肝细胞SIRT1", "sirt1")


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
        lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def status_of(kv):
    for key in STATUS_KEYS:
        if kv.get(key):
            return kv[key]
    return None


def method_lines(kv):
    lines = ["## 方法算出的名单", ""]
    for name in SIRT1_REQUIRED:
        lines.append(f"- {name}：摘要写肝细胞 SIRT1 缺失会把它反过来。")
    for name in SIRT1_DISPENSABLE:
        lines.append(f"- {name}：正文写这一项不依赖肝细胞 SIRT1。")
    status = status_of(kv)
    if status is None:
        lines.append("- 你的肝细胞 SIRT1：缺 hepatocyte_sirt1 这一列，所以不把你标成缺失或保留。")
        intro = "效应名单按正文分成两类。缺肝细胞 SIRT1 这一列，所以不把你标进去。"
    else:
        token = status.strip().lower()
        if status.strip() in ABSENT or token in ABSENT:
            lines.append("- 你的肝细胞 SIRT1：你标的是缺失。上面两类仍按正文列出，不另算分数。")
            intro = "你标了肝细胞 SIRT1 缺失。名单仍是正文的两类，不另算分数。"
        elif status.strip() in PRESENT or token in PRESENT:
            lines.append("- 你的肝细胞 SIRT1：你标的是保留。上面两类仍按正文列出，不另算分数。")
            intro = "你标了肝细胞 SIRT1 保留。名单仍是正文的两类，不另算分数。"
        else:
            lines.append(f"- 你的肝细胞 SIRT1：{status} 读不成有或无。")
            intro = "肝细胞 SIRT1 这一列读不成有或无。"
    return intro, lines


def cannot_lines():
    return [
        "## 这次算不了",
        "",
        "- 血糖、血脂和 FGF21 的预测。缺系数列。补充信息没有权重。",
    ]


def render(age, meds, labs, measurements):
    kv = load_kv(measurements)
    intro, listed = method_lines(kv)
    if age is not None:
        intro = f"年龄记下了，不进入分类。{intro}"
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
