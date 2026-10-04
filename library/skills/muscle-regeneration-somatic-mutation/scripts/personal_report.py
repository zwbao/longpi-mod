#!/usr/bin/env python3
"""Personal readout for somatic mutations during muscle regeneration.

A named gene is looked up in the bold rows of Supplementary Table 1.
Grip strength is not computed.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import BOUNDARY, GENES, NPM1_NOTE, TITLE


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


def gene_sentence(gene: str, above: tuple[str, ...], other: tuple[str, ...]) -> str:
    parts = [f"{gene}：Supplementary Table 1 的加粗行，来自小鼠再生肌肉。"]
    if above:
        parts.append("高于表注界 0.5 的蛋白改变是 " + "、".join(above) + "。")
    if other:
        parts.append("没有高于这个界的蛋白改变是 " + "、".join(other) + "。")
    if gene == "Npm1":
        parts.append(NPM1_NOTE)
    if not above and not other and gene != "Npm1":
        parts.append("没有高于表注界 0.5 的错义分数。")
    parts.append("这不是你的测序结果。")
    return "".join(parts)


def matched_genes(measurements: list[tuple[str, str]]):
    by_name = {gene.casefold(): (gene, above, other) for gene, above, other in GENES}
    hits = []
    missed = []
    seen = set()
    for name, _value in measurements:
        row = by_name.get(name.casefold())
        if row is None:
            if name not in missed:
                missed.append(name)
            continue
        if row[0] not in seen:
            seen.add(row[0])
            hits.append(row)
    order = [gene for gene, _above, _other in GENES]
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
    hits, missed = matched_genes(measurements)
    lines = [f"# {TITLE}", "", "## 方法算出的名单", ""]
    if not hits:
        lines.append("名单是空的。")
    else:
        for index, (gene, above, other) in enumerate(hits, start=1):
            lines.append(f"{index}. {gene_sentence(gene, above, other)}")
    lines.extend([
        "",
        "## 不能算的",
        "",
        "握力的折叠变化没有算。正文写用体重做归一化，并比较最后四次的平均值和第一次，没有写出归一化的式子，也没有写明比较是比值还是差值。",
    ])
    if missed:
        shown = "、".join(missed)
        lines.append(f"{shown} 不在加粗的肌肉相关行里。")
    if age is not None:
        lines.append("提供了年龄。年龄不在这张变异表里。")
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
    parser = argparse.ArgumentParser(description="Muscle regeneration somatic mutation readout")
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
