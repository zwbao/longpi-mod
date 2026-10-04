#!/usr/bin/env python3
"""Match a supplied substitution to the alleles named in the paper."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import BOUNDARY, classify

TITLE = "# 胰岛素通路里的磷酸酶变体"
VARIANT_KEYS = ("variant", "氨基酸替换", "allele", "基因型")
TEXT = {
    "C150Y": "对上 DAF-18 C150Y。正文里的名字是 yh1，CRISPR 敲入是 syb499。",
    "C105Y": "对上人 PTEN C105Y。正文写它对应线虫的 C150Y。",
    "C124S": "对上人 PTEN C124S。正文把它当作磷酸酶失活对照，不是 yh1。",
    "yh2": "对上 yh2。补充表写这是 daf-16 的提前终止，不是 daf-18。",
    "yh3": "对上 yh3。补充表写这是 daf-16 的剪接供体改变，不是 daf-18。",
    "other": "这次的写法没有对上正文点名的 C150Y、C105Y、C124S、yh2 或 yh3。",
}


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
    named = ("C150Y", "C105Y", "C124S", "yh1", "yh2", "yh3", "syb499")
    for name in meds:
        folded = name.lower().replace(" ", "").replace("-", "")
        if any(token.lower().replace("-", "") in folded for token in named):
            lines.append(f"- {name}：这个名字出现在名单里。不能据此停。")
        else:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def method_lines(kv):
    lines = ["## 方法算出的名单", ""]
    raw = None
    for key in VARIANT_KEYS:
        if kv.get(key):
            raw = kv[key]
            break
    if raw is None:
        lines.append("- 氨基酸替换：缺 variant 这一列。")
        intro = "没有氨基酸替换，所以没有核对等位基因。"
    else:
        kind = classify(raw)
        lines.append(f"- 氨基酸替换：{TEXT[kind]}")
        intro = TEXT[kind]
    lines.append("- 点名的替换：C150Y（yh1、syb499）、C105Y、C124S、yh2、yh3。")
    return intro, lines


def cannot_lines():
    return [
        "## 这次算不了",
        "",
        "- 寿命和运动分数。Supplementary Dataset 2 是生存试验统计，没有把替换换成寿命的系数列。",
        "- 酶活百分比。那是重组蛋白测定，缺你自己的酶活列，也不把测定结果写成你的百分比。",
    ]


def render(age, meds, labs, measurements):
    kv = load_kv(measurements)
    intro, listed = method_lines(kv)
    if age is not None:
        intro = f"年龄记下了，不进入核对。{intro}"
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
