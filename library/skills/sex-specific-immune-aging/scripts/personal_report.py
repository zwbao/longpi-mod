#!/usr/bin/env python3
"""Personal readout when the paper full text was not available.

No score and no threshold are computed. Checkup labs do not create a method list.
"""

from __future__ import annotations

from paper_card import lines as paper_card_lines


import argparse
import csv
import sys
from pathlib import Path

from presets import BOUNDARY, LEAD, MEASUREMENT, TITLE


def load_measurements(path: Path | None) -> list[tuple[str, str]]:
    if path is None:
        return []
    text = path.read_text(encoding="utf-8", errors="replace").strip()
    if not text:
        return []
    rows = list(csv.DictReader(text.splitlines()))
    if not rows:
        return []
    fields = {name.strip().lower(): name for name in rows[0] if name}
    name_key = fields.get("name") or fields.get("marker") or fields.get("项目") or fields.get("指标")
    value_key = fields.get("value") or fields.get("结果") or fields.get("值")
    if name_key is None or value_key is None:
        raise ValueError("measurements file needs name,value columns")
    found = []
    for row in rows:
        name = (row.get(name_key) or "").strip()
        value = (row.get(value_key) or "").strip()
        if name:
            found.append((name, value))
    return found


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


def medication_lines(medications: list[str]) -> list[str]:
    lines = ["## 你正在使用的药", ""]
    if not medications:
        lines.append("没有提供现用药。")
        return lines
    for name in medications:
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
    measurements: list[tuple[str, str]],
    medications: list[str],
    labs: list[tuple[str, str, str]],
) -> str:
    del measurements
    lines = [
        f"# {TITLE}",
        "",
        LEAD,
        "",
        "## 方法算出的名单",
        "",
        MEASUREMENT,
        "名单是空的。",
        "",
    ]
    lines.extend(medication_lines(medications))
    lines.extend(["", *lab_section(labs)])
    lines.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def method_section(text: str) -> str:
    start = text.index("## 方法算出的名单\n")
    end = text.index("\n## 你正在使用的药")
    return text[start:end]


def write_report(
    out_dir: Path,
    measurements: Path | None,
    medications: Path | None,
    labs: Path | None,
) -> Path:
    text = render_report(load_measurements(measurements), load_lines(medications), load_labs(labs))
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "report.md"
    path.write_text(_with_paper_card(text), encoding="utf-8")
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Readout without a paper full text")
    parser.add_argument("--measurements", type=Path)
    parser.add_argument("--medications", type=Path)
    parser.add_argument("--labs", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    path = write_report(args.out, args.measurements, args.medications, args.labs)
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
