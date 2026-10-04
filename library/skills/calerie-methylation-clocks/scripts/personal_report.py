#!/usr/bin/env python3
"""Place one person's clock values next to the published CALERIE ITT effects.

The Stata repository analyzes the trial. It does not score a new person.
Labs and medicines do not change the three-clock list.
"""

from __future__ import annotations

from paper_card import lines as paper_card_lines


import argparse
import csv
import sys
from pathlib import Path

from presets import ALIASES, BOUNDARY, CLOCKS


def load_clocks(path: Path | None) -> dict[str, float]:
    if path is None:
        return {}
    rows = list(csv.DictReader(path.read_text(encoding="utf-8").splitlines()))
    if not rows:
        return {}
    fields = {name.strip().lower(): name for name in rows[0] if name}
    name_key = fields.get("name") or fields.get("时钟")
    value_key = fields.get("value") or fields.get("结果")
    if not name_key or not value_key:
        raise ValueError("时钟表需要 name,value 两列")
    found = {}
    for row in rows:
        raw = (row.get(name_key) or "").strip()
        key = ALIASES.get(raw.casefold(), raw)
        if key in CLOCKS:
            found[key] = float(row[value_key])
    return found


def load_lines(path: Path | None) -> list[str]:
    if path is None:
        return []
    return [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip() and not line.startswith("#")]


def clock_lines(values: dict[str, float]) -> list[str]:
    if not values:
        return ["没有给出时钟数值。"]
    lines = []
    for key, value in values.items():
        spec = CLOCKS[key]
        effect = spec["m12"][0]
        lines.append(
            f"- {spec['display']}：你的测量是 {value:g}。"
            f"论文十二个月的组间效应量是 {effect:.2f}。"
            "这是限食组和随意进食组的平均差，不是你的变化。"
        )
    return lines


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


def render(values: dict[str, float], meds: list[str], labs: list[str]) -> str:
    if values:
        bits = []
        for key, value in values.items():
            spec = CLOCKS[key]
            bits.append(f"{spec['display']} 是 {value:g}，十二个月组间效应量是 {spec['m12'][0]:.2f}")
        intro = "。".join(bits) + "。这是限食组和随意进食组的平均差，不是你的变化。"
    else:
        intro = "这次没有给出时钟数值，所以没有可以对照的个人测量。"
    lines = ["# 限食试验时钟", "", intro, "", "## 方法算出的名单", "", *clock_lines(values)]
    lines.extend(["", *medication_lines(meds)])
    lines.extend(["", *exam_section(labs)])
    lines.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def report(out: Path, clocks: Path | None = None, medications: Path | None = None, labs: Path | None = None) -> Path:
    text = render(load_clocks(clocks), load_lines(medications), parse_labs(labs))
    out.mkdir(parents=True, exist_ok=True)
    destination = out / "report.md"
    destination.write_text(_with_paper_card(text), encoding="utf-8")
    return destination


def main() -> int:
    parser = argparse.ArgumentParser(description="CALERIE clock readout")
    parser.add_argument("--clocks", type=Path, default=None)
    parser.add_argument("--medications", type=Path, default=None)
    parser.add_argument("--labs", type=Path, default=None)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    print(report(args.out, args.clocks, args.medications, args.labs))
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
