#!/usr/bin/env python3
"""Match named AP1-glia markers and the published climbing and lipid rules."""

from __future__ import annotations

import argparse
import csv
import sys
from decimal import Decimal, InvalidOperation
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import BOUNDARY, LIPID_FDR, MARKERS, TITLE, VIAL_CM


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


def fmt(number):
    text = format(number, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text


def number(value):
    return Decimal(str(value).strip())


def build(values, age):
    computed = []
    missing = [
        "Supplementary Data 1 的 log2 倍数和校正 P 值列这次没有下载，不用作权重。",
    ]
    used = set()
    seen = set()
    for key, value in values.items():
        label = MARKERS.get(key.casefold())
        if not label or label in seen:
            if label:
                used.add(key)
            continue
        seen.add(label)
        used.add(key)
        computed.append(f"{label}：测量值 {value}。这是图 1 点名的标志，没有权重。")

    if "climbing_cm" in values:
        used.add("climbing_cm")
        try:
            height = number(values["climbing_cm"])
        except (ValueError, InvalidOperation):
            missing.append("爬管高度不是数字。")
        else:
            if height < 0 or height > VIAL_CM:
                missing.append(f"爬管高度不在 0 到 {VIAL_CM} cm 的瓶高里，不算百分比。")
            else:
                percent = height / Decimal(VIAL_CM) * Decimal("100")
                computed.append(f"爬管高度 {fmt(height)} cm，是最大瓶高 {VIAL_CM} cm 的百分之 {fmt(percent)}。")

    if "alive" in values or "dead" in values:
        used.update(name for name in ("alive", "dead") if name in values)
        if "alive" not in values or "dead" not in values:
            missing.append("热击存活缺 alive 或 dead 列。")
        else:
            try:
                alive = number(values["alive"])
                dead = number(values["dead"])
            except (ValueError, InvalidOperation):
                missing.append("热击存活的 alive 或 dead 不是数字。")
            else:
                total = alive + dead
                if total == 0:
                    missing.append("热击存活的 alive 与 dead 之和为 0，不算百分比。")
                else:
                    percent = alive / total * Decimal("100")
                    computed.append(f"热击后存活是百分之 {fmt(percent)}。方法记的是存活相对死亡的百分比。")

    lipid_keys = ("ffa_ap1_pos", "ffa_ap1_neg", "tag_ap1_pos", "tag_ap1_neg")
    if any(key in values for key in lipid_keys):
        for key in lipid_keys:
            if key in values:
                used.add(key)
        if not all(key in values for key in lipid_keys):
            missing.append("脂质方向缺列：ffa_ap1_pos、ffa_ap1_neg、tag_ap1_pos、tag_ap1_neg。")
        else:
            try:
                ffa_pos, ffa_neg, tag_pos, tag_neg = (number(values[key]) for key in lipid_keys)
            except (ValueError, InvalidOperation):
                missing.append("脂质两侧的数值不是数字。")
            else:
                ffa = "更高" if ffa_pos > ffa_neg else "不高"
                tag = "更低" if tag_pos < tag_neg else "不更低"
                computed.append(
                    f"游离脂肪酸在 AP1 阳性侧{ffa}，三酰甘油在 AP1 阳性侧{tag}。图 4 的方向是游离脂肪酸更多、三酰甘油更少。"
                )

    for key, lipid in (("ffa_fdr", "游离脂肪酸"), ("tag_fdr", "三酰甘油")):
        if key not in values:
            continue
        used.add(key)
        try:
            fdr = number(values[key])
        except (ValueError, InvalidOperation):
            missing.append(f"{lipid} 的错误发现率不是数字。")
            continue
        if fdr < Decimal(LIPID_FDR):
            computed.append(f"{lipid} 的错误发现率 {fmt(fdr)} 低于脂质组使用的 {LIPID_FDR}。")
        else:
            computed.append(f"{lipid} 的错误发现率 {fmt(fdr)} 没有低于脂质组使用的 {LIPID_FDR}。")

    if age is not None:
        missing.append("这篇用果蝇日龄描述胶质出现的时间，给出的人的年龄不进入名单。")

    unknown = [key for key in values if key not in used]
    if unknown:
        missing.append("这些测量不在图 1 的标志或脂质、爬管读出里，没有另造权重：" + "、".join(unknown) + "。")
    return computed, missing


def render(computed, missing, meds, labs):
    intro = "这次只对照图 1 点名的标志，以及爬管和脂质组里写明的规则。差异表达倍数没有拿来打分。"
    body = [f"# {TITLE}", "", intro, "", "## 能算的", ""]
    body.append("能算的结果写在方法名单里。" if computed else "这次没有对上的标志、爬管或脂质。")
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
