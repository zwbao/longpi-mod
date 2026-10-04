#!/usr/bin/env python3
"""Personal readout: match named genes or variants. Do not multiply cohort weights."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import BOUNDARY, CAN, CANNOT, LEAD, TITLE, extra_cannot, method_lines


def load_measurements(path: Path | None) -> dict[str, str]:
    if path is None:
        return {}
    rows: dict[str, str] = {}
    lines = [
        line for line in path.read_text(encoding="utf-8", errors="replace").splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]
    if not lines:
        return rows
    start = 1 if "," in lines[0] and lines[0].split(",")[0].strip().lower() in {"name", "项目", "key"} else 0
    for line in lines[start:]:
        if "," not in line:
            key, value = line.strip(), ""
        else:
            key, value = line.split(",", 1)
        key = key.strip()
        if key:
            rows[key] = value.strip()
    return rows


def load_medications(path: Path | None) -> list[str]:
    if path is None:
        return []
    names = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            names.append(text)
    return names


def parse_labs(path: Path | None) -> list[tuple[str, str, str]]:
    if path is None:
        return []
    text = path.read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()
    if lines and ("项目" in lines[0] or "item" in lines[0].casefold()) and "," in lines[0]:
        import csv

        found = []
        for row in csv.DictReader(lines):
            name = (row.get("项目") or row.get("item") or row.get("name") or "").strip()
            value = (row.get("结果") or row.get("value") or row.get("result") or "").strip()
            unit = (row.get("单位") or row.get("unit") or "").strip()
            if name:
                found.append((name, value, unit))
        return found
    found = []
    for line in lines:
        parts = [part.strip() for part in line.split(",")]
        if parts and parts[0] and parts[0] not in {"项目", "item", "name"}:
            value = parts[1] if len(parts) > 1 else ""
            unit = parts[2] if len(parts) > 2 else ""
            found.append((parts[0], value, unit))
    return found


def medication_lines(medications: list[str], list_lines: list[str]) -> list[str]:
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


def lab_block(labs: list[tuple[str, str, str]]) -> list[str]:
    rows = ["## 体检", ""]
    if not labs:
        rows.append("没有提供体检。体检不增删方法算出的名单。")
        return rows
    rows.append("下面照录体检数值。体检不增删方法算出的名单。")
    for name, value, unit in labs:
        shown = " ".join(part for part in (name, value, unit) if part)
        rows.append(f"- {shown}")
    return rows


def render(list_lines: list[str], cannot_extra: list[str], meds: list[str], labs, age) -> str:
    body = [f"# {TITLE}", "", LEAD, ""]
    if age is not None:
        body.append("写了年龄。年龄不改方法名单。")
        body.append("")
    body.extend(["## 能算的", "", CAN, ""])
    body.extend(["## 不能算的", ""])
    body.extend(CANNOT)
    body.extend(cannot_extra)
    body.extend(["", "## 方法算出的名单"])
    body.extend(list_lines or ["没有项目进入名单。"])
    body.extend(["", *medication_lines(meds, list_lines)])
    body.extend(["", *lab_block(labs)])
    body.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(body) + "\n"


def report(out: Path, measurements=None, medications=None, labs=None, age=None) -> Path:
    values = load_measurements(measurements)
    lines = method_lines(values)
    text = render(lines, extra_cannot(values), load_medications(medications), parse_labs(labs), age)
    out.mkdir(parents=True, exist_ok=True)
    destination = out / "report.md"
    destination.write_text(_with_paper_card(text), encoding="utf-8")
    return destination


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


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--measurements", type=Path, default=None)
    parser.add_argument("--medications", type=Path, default=None)
    parser.add_argument("--labs", type=Path, default=None)
    parser.add_argument("--age", type=float, default=None)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    print(report(args.out, args.measurements, args.medications, args.labs, args.age))
    return 0


if __name__ == "__main__":
    sys.exit(main())
