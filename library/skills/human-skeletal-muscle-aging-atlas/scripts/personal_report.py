#!/usr/bin/env python3
"""Personal readout for the human skeletal muscle aging atlas.

Cohort log2fc values are not applied. Named cell states keep the published direction.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import BOUNDARY, FINDINGS, TITLE


def load_measurements(path: Path | None) -> list[tuple[str, str]]:
    if path is None:
        return []
    text = path.read_text(encoding="utf-8", errors="replace")
    lines = [line.strip() for line in text.splitlines() if line.strip() and not line.strip().startswith("#")]
    if not lines:
        return []
    start = 1 if lines[0].split(",")[0].strip().casefold() in {"name", "项目", "指标"} else 0
    rows = []
    for line in lines[start:]:
        if "," in line:
            name, value = line.split(",", 1)
            rows.append((name.strip(), value.strip()))
        else:
            rows.append((line.strip(), ""))
    return rows


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
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    start = 1 if lines and lines[0].split(",")[0].strip() in {"项目", "item", "name"} else 0
    rows = []
    for line in lines[start:]:
        parts = [part.strip() for part in line.split(",")]
        if len(parts) >= 2 and parts[0] not in {"项目", "item"}:
            unit = parts[2] if len(parts) > 2 else ""
            rows.append((parts[0], parts[1], unit))
    return rows


def fold(text: str) -> str:
    return text.casefold().replace(" ", "").replace("_", "").replace("−", "-")


def matched_findings(measurements: list[tuple[str, str]]):
    hits = []
    missed = []
    for name, _value in measurements:
        folded = fold(name)
        best = None
        best_len = -1
        for key, aliases, sentence in FINDINGS:
            for alias in aliases:
                token = fold(alias)
                if token and token in folded and len(token) > best_len:
                    best = (key, sentence)
                    best_len = len(token)
        if best is None:
            missed.append(name)
        elif best[0] not in {item[0] for item in hits}:
            hits.append(best)
    order = [item[0] for item in FINDINGS]
    hits.sort(key=lambda item: order.index(item[0]))
    return hits, missed


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


def render_report(measurements, medications, labs, age) -> str:
    hits, missed = matched_findings(measurements)
    lines = [f"# {TITLE}", "", "## 方法算出的名单", ""]
    if not hits:
        lines.append("名单是空的。")
    else:
        for index, (_key, sentence) in enumerate(hits, start=1):
            lines.append(f"{index}. {sentence}")
    lines.extend([
        "",
        "## 不能算的",
        "",
        "没有计算个人分数。Supplementary Table 3 有 beta_old、beta_young 和 log2fc，没有截距列。",
    ])
    if missed:
        shown = "、".join(missed)
        lines.append(f"{shown} 没有对上正文里的方向，这些名字没有用 log2fc 去打分。")
    if age is not None:
        lines.append("提供了年龄。年龄分组是队列的写法，没有拿来改上面的方向。")
    lines.append("")
    lines.extend(medication_lines(medications))
    lines.extend(["", *lab_section(labs), "", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def method_section(text: str) -> str:
    start = text.index("## 方法算出的名单\n")
    end = text.index("\n## 不能算的")
    return text[start:end]


def write_report(out_dir, measurements, medications, labs, age=None) -> Path:
    text = render_report(
        load_measurements(measurements),
        load_lines(medications),
        load_labs(labs),
        age,
    )
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "report.md"
    path.write_text(_with_paper_card(text), encoding="utf-8")
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Human skeletal muscle aging atlas readout")
    parser.add_argument("--measurements", type=Path)
    parser.add_argument("--medications", type=Path)
    parser.add_argument("--labs", type=Path)
    parser.add_argument("--age", type=float)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    path = write_report(args.out, args.measurements, args.medications, args.labs, args.age)
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
