#!/usr/bin/env python3
"""Place named C. elegans neurons on the BitAge table shipped with NeuronAging.

The young and old tails use the repository quantile of 0.2. Checkup labs and
current medicines do not change that placement or the three tested compounds.
"""

from __future__ import annotations

from paper_card import lines as paper_card_lines


import argparse
import csv
import sys
from pathlib import Path

from presets import BINS, BOUNDARY, NEURONS, QUANTILE, TESTED


def quantile(values: list[float], q: float) -> float:
    ordered = sorted(values)
    pos = q * (len(ordered) - 1)
    lo = int(pos)
    hi = min(lo + 1, len(ordered) - 1)
    frac = pos - lo
    return ordered[lo] * (1 - frac) + ordered[hi] * frac


def cuts() -> tuple[float, float]:
    ages = [row[0] for row in NEURONS.values()]
    return quantile(ages, QUANTILE), quantile(ages, 1 - QUANTILE)


def tail_counts() -> tuple[int, int]:
    young_cut, old_cut = cuts()
    young = sum(1 for age, _, _ in NEURONS.values() if age <= young_cut)
    old = sum(1 for age, _, _ in NEURONS.values() if age >= old_cut)
    return young, old


def age_bin(hours: float) -> int:
    edges = BINS[1:]
    for index, edge in enumerate(edges):
        if hours <= edge:
            return index
    return len(edges)


def load_lines(path: Path | None) -> list[str]:
    if path is None:
        return []
    return [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip() and not line.startswith("#")]


TYPE_ZH = {
    "Interneuron": "中间神经元",
    "Sensory": "感觉神经元",
    "Motor": "运动神经元",
    "Unknown": "类型未标明",
}


def type_zh(kind: str) -> str:
    return "、".join(TYPE_ZH.get(part, part) for part in kind.split(";"))


def classify(name: str) -> str | None:
    row = NEURONS.get(name)
    if row is None:
        folded = {key.casefold(): key for key in NEURONS}
        key = folded.get(name.casefold())
        if key is None:
            return None
        name = key
        row = NEURONS[name]
    age, kind, cilium = row
    young_cut, old_cut = cuts()
    if age <= young_cut:
        tail = "落在最年轻一侧"
    elif age >= old_cut:
        tail = "落在最年老一侧"
    else:
        tail = "落在两侧之间"
    cilium_text = "表上标了纤毛" if cilium else "表上没有纤毛标记"
    return f"- {name}：预测 {age:.2f} 小时，{type_zh(kind)}，{tail}，{cilium_text}。"


def medication_lines(names: list[str]) -> list[str]:
    lines = ["## 你正在使用的药", ""]
    if not names:
        lines.append("没有提供现用药。")
        return lines
    for name in names:
        folded = name.casefold()
        hit = None
        for display, aliases, _note in TESTED:
            if any(alias.casefold() in folded for alias in aliases):
                hit = display
                break
        if hit is None:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
        else:
            lines.append(f"- {name}：论文测试过这个化合物，对应 {hit}。不能据此停。")
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


def render(neuron_lines: list[str], meds: list[str], labs: list[str]) -> str:
    if neuron_lines:
        intro = "".join(line[2:] if line.startswith("- ") else line for line in neuron_lines)
    else:
        intro = "这次没有给出神经元名字，所以没有对照预测小时数。"
    lines = ["# 神经元预测年龄", "", intro, "", "## 方法算出的名单", ""]
    if neuron_lines:
        lines.extend(neuron_lines)
    else:
        lines.append("没有对照到神经元。")
    lines.extend(["", *medication_lines(meds)])
    lines.extend(["", *exam_section(labs)])
    lines.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def report(out: Path, neurons: Path | None, medications: Path | None, labs: Path | None) -> Path:
    neuron_lines = []
    for name in load_lines(neurons):
        line = classify(name)
        neuron_lines.append(line or f"- {name}：BitAge 表里没有这个名字。")
    text = render(neuron_lines, load_lines(medications), parse_labs(labs))
    out.mkdir(parents=True, exist_ok=True)
    destination = out / "report.md"
    destination.write_text(_with_paper_card(text), encoding="utf-8")
    return destination


def main() -> int:
    parser = argparse.ArgumentParser(description="BitAge neuron readout")
    parser.add_argument("--neurons", type=Path, default=None)
    parser.add_argument("--medications", type=Path, default=None)
    parser.add_argument("--labs", type=Path, default=None)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    print(report(args.out, args.neurons, args.medications, args.labs))
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
