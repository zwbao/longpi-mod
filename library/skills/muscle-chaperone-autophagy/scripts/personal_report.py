#!/usr/bin/env python3
"""Personal readout for the skeletal-muscle CMA paper.

The score is not computed: the weight and direction columns are not in the supplement.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import BOUNDARY, HUMAN_PROTEINS, NETWORK_GENES, TITLE


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
    return text.casefold().replace(" ", "").replace("_", "").replace("-", "")


def named_network(measurements: list[tuple[str, str]]) -> list[str]:
    keys = {fold(gene) for gene in (*NETWORK_GENES, *HUMAN_PROTEINS)}
    found = []
    for name, _value in measurements:
        if fold(name) in keys and name not in found:
            found.append(name)
    return found


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
    lines = [
        f"# {TITLE}",
        "",
        "## 方法算出的名单",
        "",
        "名单是空的。",
        "",
        "## 不能算的",
        "",
        "没有计算伴侣介导自噬分数。方法写每个组分的权重是 1 或 2、方向是 +1 或 −1，Supplementary Fig. 1 只有基因名，缺权重列和方向列。",
    ]
    named = named_network(measurements)
    if named:
        shown = "、".join(named)
        lines.append(f"你点到的 {shown} 在正文或 Supplementary Fig. 1 里出现过，仍然缺这两列，没有加进分数。")
    else:
        lines.append("这次没有点到补充图里的网络基因名。")
    if age is not None:
        lines.append("提供了年龄。这篇没有用年龄去算个人分数。")
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
    parser = argparse.ArgumentParser(description="Skeletal muscle CMA readout")
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
