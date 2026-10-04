#!/usr/bin/env python3
"""Laterality index (L-R)/(L+R) for one person's left and right measures.

Hemispheric brain age is not predicted. Labs and medicines do not change the indices.
"""

from __future__ import annotations

from paper_card import lines as paper_card_lines


import argparse
import csv
import sys
from pathlib import Path

from presets import BOUNDARY, LATERALITY_DEFINITION, LIHBA_R_MULTIMODAL, laterality_index


def laterality(left: float, right: float) -> float | None:
    return laterality_index(left, right)


def load_regions(path: Path | None) -> list[tuple[str, float, float]]:
    if path is None:
        return []
    rows = list(csv.DictReader(path.read_text(encoding="utf-8").splitlines()))
    if not rows:
        raise ValueError("区域表是空的")
    fields = {name.strip().lower(): name for name in rows[0] if name}
    name_key = fields.get("name") or fields.get("区域")
    left_key = fields.get("left") or fields.get("左")
    right_key = fields.get("right") or fields.get("右")
    if not name_key or not left_key or not right_key:
        raise ValueError("区域表需要 name,left,right 三列")
    parsed = []
    for row in rows:
        parsed.append((row[name_key].strip(), float(row[left_key]), float(row[right_key])))
    return parsed


def region_lines(rows: list[tuple[str, float, float]]) -> list[str]:
    lines = []
    for name, left, right in rows:
        value = laterality(left, right)
        if value is None:
            lines.append(f"- {name}：左右之和为 0，侧化指数没有定义。")
            continue
        line = (
            f"- {name}：侧化指数 {value:.4f}，左 {left:g}，右 {right:g}。"
            f"定义是 {LATERALITY_DEFINITION}。"
        )
        if name.casefold() == "hba":
            line += (
                f"论文里多模态绝对侧化与年龄的相关是 {LIHBA_R_MULTIMODAL:.3f}。"
                "这不是预测出的脑年龄。"
            )
        lines.append(line)
    return lines


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


def render(rows: list[tuple[str, float, float]], meds: list[str], labs: list[str]) -> str:
    if rows:
        bits = []
        for name, left, right in rows:
            value = laterality(left, right)
            if value is None:
                bits.append(f"{name}的左右之和为 0，侧化指数没有定义")
            else:
                bits.append(f"{name}的侧化指数是 {value:.4f}")
        intro = "。".join(bits) + "。"
        items = region_lines(rows)
    else:
        intro = "这次没有给出左右测量，所以不算侧化指数。"
        items = ["没有算出侧化指数。"]
    lines = ["# 半球侧化", "", intro, "", "## 方法算出的名单", "", *items]
    lines.extend(["", *medication_lines(meds)])
    lines.extend(["", *exam_section(labs)])
    lines.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def report(out: Path, regions: Path | None = None, medications: Path | None = None, labs: Path | None = None) -> Path:
    text = render(load_regions(regions), load_lines(medications), parse_labs(labs))
    out.mkdir(parents=True, exist_ok=True)
    destination = out / "report.md"
    destination.write_text(_with_paper_card(text), encoding="utf-8")
    return destination


def main() -> int:
    parser = argparse.ArgumentParser(description="Hemispheric laterality readout")
    parser.add_argument("--regions", type=Path, default=None)
    parser.add_argument("--medications", type=Path, default=None)
    parser.add_argument("--labs", type=Path, default=None)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    print(report(args.out, args.regions, args.medications, args.labs))
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
