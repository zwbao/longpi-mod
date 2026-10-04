#!/usr/bin/env python3
"""Named mitophagy inducers. No similarity vectors and no personal dose."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import BOUNDARY, COMPOUNDS, TITLE


def read_rows(path: Path | None) -> list[dict[str, str]]:
    if path is None or not path.exists():
        return []
    text = path.read_text(encoding="utf-8-sig")
    if not text.strip():
        return []
    sample = text[:4096]
    dialect = csv.Sniffer().sniff(sample, delimiters=",\t")
    return list(csv.DictReader(text.splitlines(), dialect=dialect))


def load_meds(path: Path | None) -> list[str]:
    if path is None or not path.exists():
        return []
    names = []
    for line in path.read_text(encoding="utf-8").splitlines():
        item = line.strip()
        if item and not item.startswith("#"):
            names.append(item)
    return names


def norm(text: str) -> str:
    value = text.strip().casefold().replace(" ", "").replace("-", "").replace("_", "")
    for form in ("肠溶片", "缓释片", "咀嚼片", "分散片", "胶囊", "颗粒", "滴丸", "注射液", "片"):
        value = value.replace(form, "")
    return value


def lab_lines(path: Path | None) -> list[str]:
    rows = read_rows(path)
    lines = ["## 体检", ""]
    if not rows:
        lines.append("没有提供体检。体检不增删方法算出的名单。")
        return lines
    lines.append("下面照录体检数值。体检不增删方法算出的名单。")
    for row in rows:
        lowered = {(k or "").strip(): (v or "").strip() for k, v in row.items()}
        item = lowered.get("项目") or lowered.get("item") or lowered.get("name")
        value = lowered.get("结果") or lowered.get("value") or lowered.get("result")
        unit = lowered.get("单位") or lowered.get("unit") or ""
        if item and value:
            suffix = f" {unit}" if unit else ""
            lines.append(f"- {item} {value}{suffix}")
    return lines


def alias_pairs() -> list[tuple[str, str]]:
    pairs = []
    for row in COMPOUNDS:
        pairs.append((row["display"], row["display"]))
        for alias in row["aliases"]:
            pairs.append((alias, row["display"]))
    return pairs


def medication_lines(meds: list[str]) -> list[str]:
    lines = ["## 你正在使用的药", ""]
    if not meds:
        lines.append("没有提供现用药。不能据此停。")
        return lines
    for name in meds:
        token = norm(name)
        hit = None
        for alias, display in alias_pairs():
            folded = norm(alias)
            if folded and (folded == token or (len(folded) >= 3 and folded in token)):
                hit = display
                break
        if hit is None:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
        else:
            lines.append(f"- {name}：对应名单上的 {hit}。不能据此停。")
    return lines


def method_lines() -> list[str]:
    lines = [
        "## 方法算出的名单",
        "",
        "下面是正文点名、并在细胞实验里诱导线粒体自噬的化合物。没有写成剂量。",
    ]
    for row in COMPOUNDS:
        lines.append(f"- {row['display']}。{row['note']}这是论文里的化合物，不是给你的剂量。")
    return lines


def cannot_lines() -> list[str]:
    return [
        "## 不能算的",
        "",
        "相似度是诱导物向量和化合物向量的点积。已打开的 MOESM3 只有文库编号之间的两两相似度，没有诱导物向量列，也没有化合物名称列。",
        "没有名称列的编号没有写进名单。代码没有公开仓库，所以没有另行拟合相似度。",
    ]


def render(meds: list[str], labs: Path | None) -> str:
    lines = [
        TITLE,
        "",
        "这次列出正文点名的细胞实验诱导物。实验浓度没有写成用法。",
        "",
    ]
    lines.extend(method_lines())
    lines.extend(["", *cannot_lines()])
    lines.extend(["", *medication_lines(meds)])
    lines.extend(["", *lab_lines(labs)])
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


def write_report(out: Path, text: str) -> Path:
    out.mkdir(parents=True, exist_ok=True)
    path = out / "report.md"
    path.write_text(_with_paper_card(text), encoding="utf-8")
    return path


def report(out: Path, meds: Path | None, labs: Path | None, measurements: Path | None, age: float | None = None) -> Path:
    del measurements, age
    return write_report(out, render(load_meds(meds), labs))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--measurements", type=Path)
    parser.add_argument("--medications", type=Path)
    parser.add_argument("--labs", type=Path)
    parser.add_argument("--age", type=float)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    print(report(args.out, args.medications, args.labs, args.measurements, args.age))


if __name__ == "__main__":
    main()
