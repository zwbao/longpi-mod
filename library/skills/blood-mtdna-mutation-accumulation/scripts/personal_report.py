#!/usr/bin/env python3
"""Classify one substitution with the published age cut and mutation classes."""

from __future__ import annotations

import argparse
import csv
import sys
from decimal import Decimal, InvalidOperation
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import AGE_AFTER, BOUNDARY, GERMLINE, HET_REMOVE_BELOW, RVAS, TITLE

HEAVY = {"heavy", "h", "重链"}
LIGHT = {"light", "l", "轻链"}
GENES = {name.casefold(): name for name in GERMLINE + RVAS}


def load_measurements(path):
    if path is None:
        return {}
    rows = {}
    lines = [line for line in path.read_text(encoding="utf-8").splitlines() if line.strip() and not line.strip().startswith("#")]
    if not lines:
        return rows
    start = 1 if "," in lines[0] and lines[0].split(",")[0].strip().lower() in {"name", "项目", "key", "item"} else 0
    for line in lines[start:]:
        if "," not in line:
            continue
        key, value = line.split(",", 1)
        rows[key.strip()] = value.strip()
    return rows


def load_medications(path):
    if path is None:
        return []
    return [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip() and not line.strip().startswith("#")]


def parse_labs(path):
    if path is None:
        return []
    lines = [line for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    if not lines:
        return []
    if "项目" in lines[0] and "," in lines[0]:
        found = []
        for row in csv.DictReader(lines):
            name = (row.get("项目") or row.get("name") or "").strip()
            value = (row.get("结果") or row.get("value") or "").strip()
            unit = (row.get("单位") or row.get("unit") or "").strip()
            if name:
                found.append((name, value, unit))
        return found
    return [(line.strip(), "", "") for line in lines]


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
        rows.append("- " + " ".join(part for part in (name, value, unit) if part))
    return rows


def folded(values):
    return {key.casefold(): value for key, value in values.items()}


def yes(value):
    return value.strip().casefold() in {"yes", "y", "1", "true", "是", "在"}


def substitution_line(data):
    if "substitution" not in data and "替换" not in data:
        return None, "没有替换类型，不能判断是不是随年龄累积的大类。"
    raw = data.get("substitution", data.get("替换", "")).upper().replace(" ", "").replace("→", ">")
    if "in_ori" not in data and "原点" not in data:
        return None, "缺 in_ori 列，不能判断变异是不是落在被排除的复制原点。"
    if yes(data.get("in_ori", data.get("原点", ""))):
        return f"{raw} 落在复制原点。本篇把原点排除在这套突变谱之外，不标成随年龄累积。", None
    strand = data.get("strand", data.get("链", "")).strip().casefold()
    if not strand:
        return None, "缺 strand 列，不能区分重链和轻链。"
    heavy = strand in HEAVY
    light = strand in LIGHT
    if raw == "C>T" and heavy:
        return "重链 C>T。正文写这一类随年龄累积。", None
    if raw == "A>G" and heavy:
        return "重链 A>G。正文写这一类随年龄累积。", None
    if raw == "A>G" and light:
        return (
            "轻链 A>G。正文把两条链上的 A>G 放进随年龄累积的大类，又写轻链只有一部分三核苷酸上下文如此。"
            "那份上下文没有印成可检索的表，这次不按上下文再筛。",
            None,
        )
    if not heavy and not light:
        return None, "strand 不是重链或轻链，不能归类。"
    return f"{raw} 不在正文写的随年龄累积的大类里。", None


def build(values, age):
    data = folded(values)
    computed = []
    missing = [
        "Supplementary Tables 8 和 9 的优势比和置信区间这次没有下载，不算个人患病优势比。",
        "正文点名以外的克隆性造血驱动基因没有完整名单列，不把没点名的基因补进名单。",
    ]
    line, problem = substitution_line(data)
    if problem and ("substitution" in data or "替换" in data or "strand" in data or "in_ori" in data):
        missing.append(problem)
    elif line:
        computed.append(line)
    if "heteroplasmy" in data or "异质性" in data:
        raw = data.get("heteroplasmy", data.get("异质性"))
        try:
            fraction = Decimal(str(raw).strip())
            if fraction > 1 and fraction <= 100:
                fraction = fraction / Decimal("100")
            if fraction < 0 or fraction > 1:
                raise ValueError("scale")
        except (ValueError, InvalidOperation):
            missing.append("异质性不是 0 到 1 的分数。")
        else:
            if fraction < Decimal(HET_REMOVE_BELOW):
                computed.append(f"异质性 {fraction} 低于 0.05。mtSwirl 的质控会剔除这种调用，本篇写软件版本没有改。")
            else:
                computed.append(f"异质性 {fraction} 不低于 0.05，按未改的 mtSwirl 质控可以保留。")
    if age is not None:
        if age > AGE_AFTER:
            computed.append(f"年龄已过 {AGE_AFTER} 岁。正文写异质性单核苷酸在这个年龄之后明显变多。这不是变异计数。")
        else:
            computed.append(f"年龄还没有过 {AGE_AFTER} 岁。正文写异质性单核苷酸在这个年龄之后才明显变多。这不是变异计数。")
    seen = set()
    for key, value in data.items():
        symbol = GENES.get(key)
        if symbol is None or symbol in seen:
            continue
        seen.add(symbol)
        if symbol in GERMLINE:
            computed.append(f"{symbol}：测量值 {value}。正文写异质性单核苷酸负担的位点靠近这个基因。")
        else:
            computed.append(f"{symbol}：测量值 {value}。图 3d 写它的功能缺失或错义变异与较高的异质性单核苷酸负担同向。")
    smoking = data.get("smoking", data.get("吸烟", "")).strip().casefold()
    if smoking in {"yes", "y", "1", "是", "有"}:
        computed.append("测量写了吸烟。正文写吸烟者的异质性单核苷酸更多，但累积本身不依赖吸烟。替换类型不因此改写。")
    return computed, missing


def render(computed, missing, meds, labs):
    intro = "这次按 60 岁切点和随年龄累积的替换大类读测量。疾病优势比不在能算的结果里。"
    body = [f"# {TITLE}", "", intro, "", "## 能算的", ""]
    body.append("能算的结果写在方法名单里。" if computed else "这次没有可归类的替换、年龄或点名基因。")
    body.extend(["", "## 不能算的", ""])
    body.extend(missing)
    body.extend(["", "## 方法算出的名单", ""])
    body.extend([f"{i}. {line}" for i, line in enumerate(computed, start=1)] or ["没有项目进入名单。"])
    body.extend(["", *medication_lines(meds, computed)])
    body.extend(["", *lab_block(labs)])
    body.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(body) + "\n"


def report(out, measurements=None, medications=None, labs=None, age=None):
    computed, missing = build(load_measurements(measurements), age)
    text = render(computed, missing, load_medications(medications), parse_labs(labs))
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
    sys.exit(main())
