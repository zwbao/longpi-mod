#!/usr/bin/env python3
"""Place a supplied missense heteroplasmy on the published cell-fitness cuts."""

from __future__ import annotations

import argparse
import csv
import sys
from decimal import Decimal, InvalidOperation
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import (
    BOUNDARY,
    DROPOUT_PERCENT,
    ENVIRONMENTS,
    MISSENSE,
    MODEL_PERCENT,
    SILENT,
    TITLE,
    UMI_MIN,
)


def load_measurements(path):
    if path is None:
        return {}
    text = path.read_text(encoding="utf-8")
    rows = {}
    lines = [line for line in text.splitlines() if line.strip() and not line.strip().startswith("#")]
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
    lines = [line for line in text.splitlines() if line.strip()]
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
        shown = " ".join(part for part in (name, value, unit) if part)
        rows.append(f"- {shown}")
    return rows


def fmt(number):
    text = format(number, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text


def as_percent(value):
    number = Decimal(str(value).strip())
    if number < 0:
        raise ValueError("negative")
    if number <= 1:
        return number * Decimal("100")
    return number


def folded(values):
    return {key.casefold(): value for key, value in values.items()}


def build(values, age):
    data = folded(values)
    computed = []
    missing = [
        "反 S 形模型的 location、depth、pitch 没有印成一组可套用的系数，这次不重拟合。",
        "截短的癌细胞瘤相关 MT-ND4 变异在正文没有碱基坐标，不能按坐标匹配。",
    ]
    used = set()

    missense_names = ("missense_heteroplasmy", "错义异质性", "m.11696g>a", "m.11696g>a val313ile")
    for name in missense_names:
        if name in data:
            used.add(name)
            try:
                percent = as_percent(data[name])
            except (ValueError, InvalidOperation):
                missing.append(f"{MISSENSE} 的值不是异质性。")
                break
            if percent > DROPOUT_PERCENT:
                place = "超过大约百分之六十。图 4 里这样的错义谱系在第 0 天到第 5 天脱落"
            elif percent >= MODEL_PERCENT:
                place = "达到模型写的大约百分之五十六，还没有超过大约百分之六十"
            else:
                place = "低于这篇细胞实验里报道的两个切点"
            computed.append(
                f"{MISSENSE} 的异质性是百分之 {fmt(percent)}，{place}。这是 293T 分裂细胞实验里的切点。"
            )
            break

    for name in ("silent_heteroplasmy", "同义异质性", "m.11698c>t"):
        if name in data:
            used.add(name)
            computed.append(
                f"{SILENT} 给出的值是 {data[name]}。正文写同义变异在标准培养里被保留，没有清除切点。"
            )
            break

    for name in ("umi", "umis"):
        if name in data:
            used.add(name)
            try:
                umi = Decimal(str(data[name]).strip())
            except (ValueError, InvalidOperation):
                missing.append("UMI 不是数字。")
                break
            if umi >= UMI_MIN:
                computed.append(f"UMI {fmt(umi)} 达到至少 {UMI_MIN}，可以通过 SCI-LITE 的膝点过滤。")
            else:
                computed.append(f"UMI {fmt(umi)} 少于 {UMI_MIN}，不把这个细胞算进膝点之后的单细胞。")
            break

    if "environment" in data:
        used.add("environment")
        label = data["environment"].strip()
        note = ENVIRONMENTS.get(label.casefold()) or ENVIRONMENTS.get(label)
        if note:
            computed.append(f"环境 {label}。{note}")
        else:
            missing.append(f"环境 {label} 不是正文对照过的葡萄糖、半乳糖、常氧或低氧。")

    if age is not None:
        missing.append("这篇细胞实验没有把人的年龄写成切点，年龄不进入名单。")

    unknown = [key for key in data if key not in used]
    if unknown:
        missing.append("这些测量对不上错义、同义、UMI 或环境，没有另造权重：" + "、".join(unknown) + "。")
    return computed, missing


def render(computed, missing, meds, labs):
    intro = "这次把给出的错义异质性放到正文的细胞适合度切点上。同义变异不套用那两个切点。"
    body = [f"# {TITLE}", "", intro, "", "## 能算的", ""]
    body.append("能算的结果写在方法名单里。" if computed else "这次没有可归类的异质性、UMI 或环境。")
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
