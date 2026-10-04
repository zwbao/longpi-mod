#!/usr/bin/env python3
"""Personal readout. Cohort counts stay in presets and are not printed."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import BOUNDARY, TITLE, build


def load_measurements(path: Path | None) -> dict[str, str]:
    found: dict[str, str] = {}
    if path is None:
        return found
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        text = line.strip()
        if not text or text.startswith("#"):
            continue
        if text.lower().startswith("name,") or text.startswith("项目,"):
            continue
        if "," not in text:
            continue
        name, value = text.split(",", 1)
        found[name.strip()] = value.strip()
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
    rows = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        text = line.strip()
        if not text or text.startswith("#") or text.startswith("项目"):
            continue
        parts = [part.strip() for part in text.replace("，", ",").split(",")]
        if len(parts) < 2:
            continue
        unit = parts[2] if len(parts) > 2 else ""
        rows.append((parts[0], parts[1], unit))
    return rows


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
    lines.append("下面照录体检。体检不增删方法算出的名单。")
    for item, value, unit in labs:
        suffix = f" {unit}" if unit else ""
        lines.append(f"- {item} {value}{suffix}")
    return lines


def method_section(text: str) -> str:
    start = text.index("## 方法算出的名单")
    end = text.index("## 你正在使用的药")
    return text[start:end]


def render_report(measurements: dict[str, str], medications: list[str], labs, age) -> str:
    lead, items = build(measurements, age)
    lines = [f"# {TITLE}", "", lead, "", "## 方法算出的名单", ""]
    lines.extend(items)
    lines.extend(["", *medication_lines(medications), "", *lab_section(labs)])
    lines.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


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


def write_report(out_dir: Path, measurements: Path | None, medications: Path | None, labs: Path | None, age: float | None) -> Path:
    text = render_report(load_measurements(measurements), load_lines(medications), load_labs(labs), age)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "report.md"
    path.write_text(_with_paper_card(text), encoding="utf-8")
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--measurements", type=Path)
    parser.add_argument("--medications", type=Path)
    parser.add_argument("--labs", type=Path)
    parser.add_argument("--age", type=float)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    path = write_report(args.out, args.measurements, args.medications, args.labs, args.age)
    sys.stdout.write(str(path) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
