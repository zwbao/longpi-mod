#!/usr/bin/env python3
"""Relative age, and methylation age when all 26 Clock1 sites are supplied."""

from __future__ import annotations

import argparse
import csv
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import BOUNDARY, CLOCK_GENES, MAX_LIFESPAN, relative_age

HERE = Path(__file__).resolve().parent
WEIGHTS: dict[str, Decimal] = {}
INTERCEPT = Decimal("0")


def load_clock() -> None:
    global INTERCEPT
    with (HERE / "clock1.csv").open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            if row["position"] == "Interception":
                INTERCEPT = Decimal(row["weight"])
            else:
                WEIGHTS[row["position"]] = Decimal(row["weight"])


load_clock()


def _with_paper_card(text: str) -> str:
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


def load_lines(path):
    if path is None:
        return []
    rows = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            rows.append(text)
    return rows


def parse_labs(path):
    if path is None:
        return []
    found = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if not text or text.startswith("#") or text.startswith("项目"):
            continue
        parts = [p.strip() for p in text.replace("，", ",").split(",")]
        if len(parts) < 2:
            parts = text.split()
        if len(parts) < 2:
            continue
        name, raw = parts[0], parts[1]
        unit = parts[2] if len(parts) > 2 else ""
        try:
            value = float(raw)
        except ValueError:
            continue
        found.append((name, value, unit))
    return found


def lab_lines(path):
    rows = parse_labs(path)
    lines = ["## 体检", ""]
    if not rows:
        lines.append("没有提供体检。体检不增删方法算出的名单。")
        return lines
    lines.append("下面照录体检数值。体检不增删方法算出的名单。")
    for name, value, unit in rows:
        unit_bit = f" {unit}" if unit else ""
        lines.append(f"- {name} {value:g}{unit_bit}")
    return lines


def species_of(raw_lines: list[str]) -> str:
    for line in raw_lines:
        if line.lower().startswith("species="):
            value = line.split("=", 1)[1].strip().lower()
            if value in MAX_LIFESPAN:
                return value
    return "nmr"


def parse_sites(path):
    if path is None:
        return "nmr", {}, [], []
    raw = load_lines(path)
    species = species_of(raw)
    values: dict[str, Decimal] = {}
    bad: list[str] = []
    conflict: list[str] = []
    for line in raw:
        if line.lower().startswith("species="):
            continue
        parts = [p.strip() for p in line.replace("，", ",").split(",")]
        if len(parts) < 2:
            parts = line.split()
        if len(parts) < 2:
            bad.append(line)
            continue
        name, raw_value = parts[0], parts[1]
        if name.lower() in {"position", "cpg", "site", "位点"}:
            continue
        if name == "Interception":
            continue
        try:
            value = Decimal(raw_value)
        except Exception:
            bad.append(name)
            continue
        if value < 0 or value > 1:
            bad.append(name)
            continue
        if name in values and values[name] != value:
            conflict.append(name)
            continue
        values[name] = value
    return species, values, bad, conflict


def years(value: Decimal) -> str:
    return str(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def methylation_age(values: dict[str, Decimal]) -> Decimal | None:
    if any(site not in values for site in WEIGHTS):
        return None
    total = INTERCEPT
    for site, weight in WEIGHTS.items():
        total += weight * values[site]
    return total


def medication_lines(names):
    genes = set(CLOCK_GENES)
    lines = ["## 你正在使用的药", ""]
    if not names:
        lines.append("没有提供现用药。")
        return lines
    for name in names:
        if name in genes:
            lines.append(f"- {name}：这个名字出现在方法名单里。不能据此停。")
        else:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def clock_sentence(values, bad, conflict) -> str:
    if bad or conflict:
        return "有位点读不了、互相冲突，或不在零到一之间，不算甲基化年龄。"
    missing = [site for site in WEIGHTS if site not in values]
    if missing:
        shown = "、".join(missing[:8])
        extra = f" 等 {len(missing)} 个" if len(missing) > 8 else ""
        return f"缺了位点{extra}：{shown}。不填补，不算甲基化年龄。"
    age = methylation_age(values)
    return f"甲基化年龄是 {years(age)} 岁。权重来自 Supplementary Data 4 的 Clock1。"


def render(age, meds, labs, measurements):
    species, values, bad, conflict = parse_sites(measurements)
    species_name = {"nmr": "裸鼹鼠", "mouse": "小鼠", "human": "人"}[species]
    clock = clock_sentence(values, bad, conflict)
    scored = None if bad or conflict else methylation_age(values)
    if age is None:
        lead = f"没有实足年龄，所以没有相对年龄。{clock}"
    else:
        scaled = relative_age(age, species)
        lead = f"实足年龄除以{species_name}的最大寿命，相对年龄是 {scaled:.4f}。{clock}"
    lines = ["# 裸鼹鼠血液时钟", "", lead, "", "## 方法算出的名单", ""]
    if age is None:
        lines.append("这次没有相对年龄。")
    else:
        lines.append(f"- 相对年龄：{relative_age(age, species):.4f}")
    if scored is None:
        lines.append("- 甲基化年龄：这次没有算。")
    else:
        lines.append(f"- 甲基化年龄：{years(scored)} 岁。")
    lines.append("- 时钟相关基因：" + "、".join(CLOCK_GENES) + "。这次没有这些基因的表达量。")
    lines.extend(["", *medication_lines(load_lines(meds)), "", *lab_lines(labs), "", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def report(out, age, medications, labs, measurements=None):
    out.mkdir(parents=True, exist_ok=True)
    path = out / "report.md"
    path.write_text(_with_paper_card(render(age, medications, labs, measurements)), encoding="utf-8")
    return path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--medications", type=Path)
    parser.add_argument("--labs", type=Path)
    parser.add_argument("--age", type=float)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--measurements", type=Path)
    args = parser.parse_args()
    report(args.out, args.age, args.medications, args.labs, args.measurements)


if __name__ == "__main__":
    main()
