#!/usr/bin/env python3
"""Personal organ age-gap readout for Wen et al., Nature Aging 2024.

The gap is predicted age minus chronological age. Predicted ages are taken
only from the user file. Support-vector weights are not in the paper.
"""

from __future__ import annotations

from paper_card import lines as paper_card_lines


import argparse
import csv
import sys
from pathlib import Path

from presets import ALIASES, BOUNDARY, ORGANS


def load_predicted(path: Path | None) -> tuple[dict[str, float], list[str]]:
    if path is None:
        return {}, []
    text = path.read_text(encoding="utf-8", errors="replace")
    rows = list(csv.DictReader(text.splitlines()))
    if not rows:
        return {}, []
    fields = {name.strip().lower(): name for name in rows[0] if name}
    organ_key = fields.get("organ") or fields.get("器官") or fields.get("name")
    age_key = fields.get("predicted_age") or fields.get("predicted") or fields.get("预测年龄")
    if organ_key is None or age_key is None:
        raise ValueError("predicted-age file needs organ,predicted_age columns")
    found: dict[str, float] = {}
    unknown = []
    for row in rows:
        raw = (row.get(organ_key) or "").strip()
        key = ALIASES.get(raw.casefold()) or ALIASES.get(raw)
        if key is None:
            if raw:
                unknown.append(raw)
            continue
        found[key] = float(row[age_key])
    return found, unknown


def load_lines(path: Path | None) -> list[str]:
    if path is None:
        return []
    names = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            names.append(text)
    return names


def load_labs(path: Path | None) -> list[tuple[str, str, str]]:
    if path is None:
        return []
    text = path.read_text(encoding="utf-8", errors="replace").strip()
    if not text:
        return []
    first = text.splitlines()[0]
    if "项目" in first or "item" in first.casefold():
        rows = list(csv.DictReader(text.splitlines()))
        if not rows:
            return []
        fields = {name.strip(): name for name in rows[0] if name}
        item_key = fields.get("项目") or fields.get("item") or fields.get("name")
        value_key = fields.get("结果") or fields.get("value") or fields.get("result")
        unit_key = fields.get("单位") or fields.get("unit")
        parsed = []
        for row in rows:
            item = (row.get(item_key, "") if item_key else "").strip()
            value = (row.get(value_key, "") if value_key else "").strip()
            unit = (row.get(unit_key, "") if unit_key else "").strip()
            if item and value:
                parsed.append((item, value, unit))
        return parsed
    return [(line.strip(), "", "") for line in text.splitlines() if line.strip()]


def age_gap(predicted_age: float, chronological_age: float) -> float:
    return predicted_age - chronological_age


def method_names() -> list[str]:
    return [label for _key, label, _loci, _h2 in ORGANS]


def medication_lines(medications: list[str]) -> list[str]:
    names = {label.casefold() for label in method_names()}
    lines = ["## 你正在使用的药", ""]
    if not medications:
        lines.append("没有提供现用药。")
        return lines
    for name in medications:
        if name.casefold() in names:
            lines.append(f"- {name}：这个名字出现在方法名单里。不能据此停。")
        else:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def lab_section(labs: list[tuple[str, str, str]]) -> list[str]:
    lines = ["## 体检", ""]
    if not labs:
        lines.append("没有提供体检。体检不增删方法算出的名单。")
        return lines
    lines.append("下面照录体检数值。体检不增删方法算出的名单。")
    for item, value, unit in labs:
        suffix = f" {unit}" if unit else ""
        lines.append(f"- {item} {value}{suffix}")
    return lines


def render_report(
    predicted: dict[str, float],
    unknown: list[str],
    age: float | None,
    medications: list[str],
    labs: list[tuple[str, str, str]],
) -> str:
    computed = age is not None and any(key in predicted for key, _label, _loci, _h2 in ORGANS)
    if computed:
        lead = "用你给的预测年龄减去实足年龄，算出了年龄差。"
    elif predicted and age is None:
        lead = "有预测年龄，但没有实足年龄，所以没有年龄差。"
    else:
        lead = "没有这些器官的预测年龄，所以没有年龄差。"
    if unknown:
        lead += "".join(f"{name} 不加入方法名单。" for name in unknown)
    lines = ["# 器官年龄差", "", lead, "", "## 方法算出的名单", ""]
    matched = False
    for key, label, _loci, _h2 in ORGANS:
        if key not in predicted:
            continue
        matched = True
        if age is not None:
            gap = age_gap(predicted[key], age)
            lines.append(f"- {label}：预测年龄 {predicted[key]:g} 岁，年龄差 {gap:.2f} 岁。")
        else:
            lines.append(f"- {label}：有预测年龄 {predicted[key]:g} 岁，但没有实足年龄，不算年龄差。")
    if not matched:
        lines.append("这次没有年龄差。")
    lines.extend(["", *medication_lines(medications), "", *lab_section(labs), "", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def method_section(text: str) -> str:
    start = text.index("## 方法算出的名单\n")
    end = text.index("\n## 你正在使用的药")
    return text[start:end]


def write_report(
    out_dir: Path,
    predicted: Path | None,
    age: float | None,
    medications: Path | None,
    labs: Path | None,
) -> Path:
    values, unknown = load_predicted(predicted)
    text = render_report(values, unknown, age, load_lines(medications), load_labs(labs))
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "report.md"
    path.write_text(_with_paper_card(text), encoding="utf-8")
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Organ age-gap readout from Wen et al. 2024")
    parser.add_argument("--predicted", type=Path)
    parser.add_argument("--age", type=float)
    parser.add_argument("--medications", type=Path)
    parser.add_argument("--labs", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    path = write_report(args.out, args.predicted, args.age, args.medications, args.labs)
    sys.stdout.write(str(path) + "\n")
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
    raise SystemExit(main())
