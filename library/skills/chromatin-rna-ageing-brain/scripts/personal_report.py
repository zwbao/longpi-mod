#!/usr/bin/env python3
"""Write one personal readout. Labs are printed and do not enter the method list."""

from __future__ import annotations

from paper_card import lines as paper_card_lines


import argparse
import csv
import sys
from pathlib import Path

from presets import BOUNDARY, render_body


def read_table(path: Path) -> list[dict[str, str]]:
    raw = path.read_text(encoding="utf-8-sig")
    lines = [line for line in raw.splitlines() if line.strip()]
    if not lines:
        return []
    delimiter = "\t" if "\t" in lines[0] else ","
    reader = csv.DictReader(lines, delimiter=delimiter)
    rows = []
    for row in reader:
        cleaned = {}
        for key, value in row.items():
            if key is None:
                continue
            cleaned[key.strip().lower()] = (value or "").strip()
        if any(cleaned.values()):
            rows.append(cleaned)
    return rows


def read_lines(path: Path | None) -> list[str]:
    if path is None:
        return []
    names = []
    for line in path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            names.append(text)
    return names


def _norm(text: str) -> str:
    return "".join(text.casefold().split())


def medication_lines(items: list[dict], medications: list[str]) -> list[str]:
    keys = set()
    for item in items:
        keys.add(_norm(item["name"]))
        for alias in item.get("aliases") or []:
            keys.add(_norm(str(alias)))
    lines = []
    for name in medications:
        if _norm(name) in keys:
            lines.append(
                f"- {name}：这个名字在名单上。名单只说明方法登记了它，不能据此开始或停止。"
            )
        else:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def render_report(rows: list[dict[str, str]], medications: list[str], labs: list[str]) -> str:
    paragraphs, items = render_body(rows)
    lines = list(paragraphs)
    lines.append("")
    lines.append("## 方法算出的名单")
    if not items:
        lines.append("名单是空的。")
    else:
        for item in items:
            lines.append(f"- {item['name']}：{item['detail']}")
    lines.append("")
    lines.append("## 你正在使用的药")
    if not medications:
        lines.append("没有提供现用药。")
    else:
        lines.extend(medication_lines(items, medications))
    lines.append("")
    lines.append("## 体检")
    if not labs:
        lines.append("没有提供体检。体检不增删方法算出的名单。")
    else:
        lines.append("下面照录体检。体检不增删方法算出的名单。")
        for lab in labs:
            lines.append(f"- {lab}")
    lines.append("")
    lines.append(BOUNDARY)
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--measurements", default=None)
    parser.add_argument("--medications", default=None)
    parser.add_argument("--labs", default=None)
    parser.add_argument("--out", required=True)
    args = parser.parse_args(argv)
    rows = read_table(Path(args.measurements)) if args.measurements else []
    medications = read_lines(Path(args.medications) if args.medications else None)
    labs = read_lines(Path(args.labs) if args.labs else None)
    text = render_report(rows, medications, labs)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "report.md").write_text(_with_paper_card(text), encoding="utf-8")
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
