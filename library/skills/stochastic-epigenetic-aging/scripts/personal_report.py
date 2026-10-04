#!/usr/bin/env python3
"""Compute RR2 and the CpG switch probability from the paper's formulas.

The mitotic-clock package is a different calculation and is not run here.
Labs and medicines do not change the three published fractions.
"""

from __future__ import annotations

from paper_card import lines as paper_card_lines


import argparse
import csv
import math
import sys
from pathlib import Path

from presets import ALIASES, BOUNDARY, FRACTIONS, GAMMA


def relative_r2(stochastic: float, clock: float) -> float:
    if clock == 0:
        raise ValueError("时钟 R2 不能为 0")
    return stochastic / clock


def switch_probability(effect_size: float, gamma: float = GAMMA) -> float:
    return 1.0 - math.exp(-gamma * abs(effect_size))


def load_lines(path: Path | None) -> list[str]:
    if path is None:
        return []
    return [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip() and not line.startswith("#")]


def medication_lines(names: list[str]) -> list[str]:
    lines = ["## 你正在使用的药", ""]
    if not names:
        lines.append("没有提供现用药。")
        return lines
    for name in names:
        lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def exam_section(labs: list[str]) -> list[str]:
    lines = ["## 体检", ""]
    if not labs:
        lines.append("没有提供体检。体检不增删方法算出的名单。")
        return lines
    lines.append("下面照录体检数值。体检不增删方法算出的名单。")
    lines.extend(labs)
    return lines


LAB_PANELS = {
    "alt": ("谷丙转氨酶", None, 40),
    "ast": ("谷草转氨酶", None, 40),
    "creatinine": ("肌酐", None, 115),
    "egfr": ("肾小球滤过率", 60, None),
    "hemoglobin": ("血红蛋白", 110, None),
    "platelets": ("血小板", 100, None),
}
LAB_ALIASES = {
    "谷丙转氨酶": "alt", "谷丙": "alt", "alt": "alt",
    "谷草转氨酶": "ast", "谷草": "ast", "ast": "ast",
    "肌酐": "creatinine", "creatinine": "creatinine",
    "肾小球滤过率": "egfr", "egfr": "egfr",
    "血红蛋白": "hemoglobin", "血小板": "platelets",
}


def parse_labs(path: Path | None) -> list[str]:
    if path is None:
        return []
    text = path.read_text(encoding="utf-8", errors="replace")
    lines = [line for line in text.splitlines() if line.strip()]
    parsed: list[str] = []

    def one(item: str, value_text: str) -> None:
        compact = item.casefold().replace(" ", "")
        key = next((panel for alias, panel in LAB_ALIASES.items() if alias.casefold() in compact), None)
        if key is None:
            return
        digits = "".join(ch if ch.isdigit() or ch == "." else " " for ch in value_text).split()
        if not digits:
            return
        value = float(digits[0])
        label, low, high = LAB_PANELS[key]
        if low is not None and value < low:
            bound = f"，低于常见下限 {low:g}"
        elif high is not None and value > high:
            bound = f"，高于常见上限 {high:g}"
        else:
            bound = "，在常见范围内"
        parsed.append(f"- {label} {value:g}{bound}")

    if lines and ("," in lines[0] or "\t" in lines[0]):
        dialect = csv.excel_tab if "\t" in lines[0] else csv.excel
        table = list(csv.DictReader(lines, dialect=dialect))
        fields = {name.strip().lower(): name for name in table[0]} if table else {}
        item_key = fields.get("项目") or fields.get("item") or fields.get("name")
        value_key = fields.get("结果") or fields.get("value") or fields.get("result")
        if item_key and value_key:
            for row in table:
                one(row.get(item_key, ""), row.get(value_key, ""))
    if not parsed:
        for line in lines:
            one(line, line)
    if not parsed:
        return ["没有从体检文件里读到可识别的项目。体检不增删方法算出的名单。"]
    parsed.append("超出常见范围的项目只写在这里。体检不增删方法算出的名单。")
    return parsed


def render(clock: str | None, rr2: float | None, probability: float | None, meds: list[str], labs: list[str]) -> str:
    items = []
    shown = clock or "未命名时钟"
    if rr2 is not None:
        intro = f"{shown} 的 RR2 是 {rr2:.4f}。"
        line = f"- {shown}：RR2={rr2:.4f}。"
        spec = FRACTIONS.get(clock or "")
        if spec:
            line += f"论文写这个时钟能由随机过程解释的比例是 {spec['text']}。这是队列汇总，不是你的权重。"
        items.append(line)
    else:
        intro = "这次没有同时给出两个决定系数，所以不算随机成分所占的比例。"
    if probability is not None:
        items.append(f"- 位点切换概率是 {probability:.4f}。这是按论文公式从你给的效应算出来的，不是治疗权重。")
        if rr2 is None:
            intro = f"位点切换概率是 {probability:.4f}。"
        else:
            intro = f"{intro[:-1]}。位点切换概率是 {probability:.4f}。"
    if not items:
        items = ["没有算出比例。"]
    lines = ["# 表观遗传随机成分", "", intro, "", "## 方法算出的名单", "", *items]
    lines.extend(["", *medication_lines(meds)])
    lines.extend(["", *exam_section(labs)])
    lines.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def report(
    out: Path,
    clock: str | None = None,
    r2_stochastic: float | None = None,
    r2_clock: float | None = None,
    effect_size: float | None = None,
    medications: Path | None = None,
    labs: Path | None = None,
) -> Path:
    name = ALIASES.get(clock.casefold()) if clock else None
    if clock and name is None:
        name = clock
    rr2 = None
    if r2_stochastic is not None and r2_clock is not None:
        rr2 = relative_r2(r2_stochastic, r2_clock)
    probability = switch_probability(effect_size) if effect_size is not None else None
    text = render(name, rr2, probability, load_lines(medications), parse_labs(labs))
    out.mkdir(parents=True, exist_ok=True)
    destination = out / "report.md"
    destination.write_text(_with_paper_card(text), encoding="utf-8")
    return destination


def main() -> int:
    parser = argparse.ArgumentParser(description="Stochastic epigenetic fraction readout")
    parser.add_argument("--clock", default=None)
    parser.add_argument("--r2-stochastic", type=float, default=None)
    parser.add_argument("--r2-clock", type=float, default=None)
    parser.add_argument("--effect-size", type=float, default=None)
    parser.add_argument("--medications", type=Path, default=None)
    parser.add_argument("--labs", type=Path, default=None)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    print(report(args.out, args.clock, args.r2_stochastic, args.r2_clock, args.effect_size, args.medications, args.labs))
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
