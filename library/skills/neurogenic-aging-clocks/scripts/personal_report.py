#!/usr/bin/env python3
"""Compare one cell-type clock prediction with published SVZ clock errors.

Glmnet weights are not in the analysis repository, so no new age is fit.
Labs and medicines do not change the six cell-type lines.
"""

from __future__ import annotations

from paper_card import lines as paper_card_lines


import argparse
import csv
import sys
from pathlib import Path

from presets import ALIASES, BOOTSTRAP, BOUNDARY, PARABIOSIS

CELL_ZH = {
    "oligodendrocyte": "少突胶质细胞",
    "microglia": "小胶质细胞",
    "endothelial": "内皮细胞",
    "astrocyte-qNSC": "星形胶质与静止神经干细胞",
    "aNSC-NPC": "活化神经干细胞与神经前体细胞",
    "neuroblast": "神经母细胞",
}


def canonical(name: str) -> str | None:
    return ALIASES.get(name.strip().casefold())


def cell_lines(chosen: str | None, age: float | None, predicted: float | None) -> tuple[str, list[str]]:
    if chosen and age is not None and predicted is not None:
        error = abs(predicted - age)
        line = f"- {CELL_ZH[chosen]}（{chosen}）：你给的绝对误差是 {error:.2f} 个月。"
        if chosen == "aNSC-NPC":
            line += (
                f"论文在这个细胞类型上报告的时间年龄回春平均是 {PARABIOSIS['chrono'][2]:.2f} 个月。"
                "那是试验动物的中位数差，不是你的误差。"
            )
        elif chosen in BOOTSTRAP:
            _corr, err = BOOTSTRAP[chosen]
            line += f"论文对这个细胞类型报告的误差是 {err:.1f} 个月。那是交叉队列的误差，不是你的误差。"
        return f"{CELL_ZH[chosen]}的绝对误差是 {error:.2f} 个月。", [line]
    if chosen:
        return (
            "这次认出了细胞类型，但没有同时给出月龄和预测月龄，所以不算绝对误差。",
            [f"- {CELL_ZH[chosen]}（{chosen}）：这次没有同时给出月龄和预测月龄，所以不算绝对误差。"],
        )
    return "这次没有给出细胞类型，所以不算绝对误差。", ["没有算出绝对误差。"]


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


def render(chosen: str | None, age: float | None, predicted: float | None, meds: list[str], labs: list[str]) -> str:
    intro, items = cell_lines(chosen, age, predicted)
    lines = ["# 神经发生区细胞时钟", "", intro, "", "## 方法算出的名单", "", *items]
    lines.extend(["", *medication_lines(meds)])
    lines.extend(["", *exam_section(labs)])
    lines.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def report(
    out: Path,
    cell_type: str | None = None,
    age: float | None = None,
    predicted: float | None = None,
    medications: Path | None = None,
    labs: Path | None = None,
) -> Path:
    chosen = canonical(cell_type) if cell_type else None
    text = render(chosen, age, predicted, load_lines(medications), parse_labs(labs))
    out.mkdir(parents=True, exist_ok=True)
    destination = out / "report.md"
    destination.write_text(_with_paper_card(text), encoding="utf-8")
    return destination


def main() -> int:
    parser = argparse.ArgumentParser(description="SVZ cell-type clock readout")
    parser.add_argument("--cell-type", default=None)
    parser.add_argument("--age-months", type=float, default=None)
    parser.add_argument("--predicted-months", type=float, default=None)
    parser.add_argument("--medications", type=Path, default=None)
    parser.add_argument("--labs", type=Path, default=None)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    print(report(args.out, args.cell_type, args.age_months, args.predicted_months, args.medications, args.labs))
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
