#!/usr/bin/env python3
"""List Hepassocin/AMPK liver-aging claims; do not score personal liver age."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import ABSENT, BOUNDARY, MARKER_KEYS, MOUSE_FINDINGS, PATHWAY_NODES, PRESENT

TITLE = "# 肝促泌素与肝衰老通路读出"

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


def lookup_marker(kv, aliases):
    for key in aliases:
        if kv.get(key):
            return kv[key]
    lower = {k.lower(): v for k, v in kv.items()}
    for key in aliases:
        if key.lower() in lower:
            return lower[key.lower()]
    return None


def classify(status):
    if status is None:
        return None
    token = status.strip().lower()
    if status.strip() in ABSENT or token in ABSENT:
        return "absent"
    if status.strip() in PRESENT or token in PRESENT:
        return "present"
    return "unparsed"


def method_lines(kv):
    lines = ["## 方法算出的名单", "", "### 正文里的通路节点"]
    for name in PATHWAY_NODES:
        lines.append(f"- {name}")
    lines.append("")
    lines.append("### 小鼠里正文写明的发现（不是给你的处方）")
    for name in MOUSE_FINDINGS:
        lines.append(f"- {name}")
    labels = {"hps_level": "你的 HPS 水平标记", "ampk_activation": "你的 AMPK 激活标记"}
    missing = []
    for canon, aliases in MARKER_KEYS.items():
        raw = lookup_marker(kv, aliases)
        kind = classify(raw)
        if kind is None:
            missing.append(canon)
            lines.append(f"- {labels[canon]}：缺 {canon} 这一列，所以不把你标进去。")
        elif kind == "absent":
            lines.append(f"- {labels[canon]}：你标的是缺失/偏低。上面名单仍按正文列出，不另算分数。")
        elif kind == "present":
            lines.append(f"- {labels[canon]}：你标的是存在/偏高。上面名单仍按正文列出，不另算分数。")
        else:
            lines.append(f"- {labels[canon]}：{raw} 读不成有或无。")
    intro = (
        "通路名单按正文列出。缺标记列时不把你写进有或无。"
        if missing
        else "你交了标记。名单仍是正文节点与小鼠发现，不另算分数。"
    )
    return intro, lines


def cannot_lines():
    return [
        "## 这次算不了",
        "",
        "- 个人肝龄、再生能力或 HPS 血浆浓度的数值预测。补充表没有权重列。Table S1 是患者特征。",
        "- AICAR 或外源 HPS 的人用剂量。正文是小鼠观察。",
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
