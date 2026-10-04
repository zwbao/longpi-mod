#!/usr/bin/env python3
"""Named terpenoid autophagy activators. No Emax rank and no clock weights."""

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
    dialect = csv.Sniffer().sniff(text[:4096], delimiters=",\t")
    return list(csv.DictReader(text.splitlines(), dialect=dialect))


def load_meds(path: Path | None) -> list[str]:
    if path is None or not path.exists():
        return []
    return [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip() and not line.startswith("#")]


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
    lines = ["## 方法算出的名单", "", "下面是正文点名的自噬激活物。没有写成剂量。"]
    for row in COMPOUNDS:
        lines.append(f"- {row['display']}。{row['note']}这是论文里的名字，不是给你的剂量。")
    return lines


def cannot_lines() -> list[str]:
    return [
        "## 不能算的",
        "",
        "没有计算表观遗传年龄，因为缺 HorvathMammalMethyl40 的 CpG 权重列。",
        "Supplementary Table 2 有斑马鱼 log2 荧光面积的均值、标准误和只数。这些不是个人自噬分数，表里也没有把它们换成个人分数的系数列。",
        "Supplementary Table 1 的 Previous report 列只填了三个已经报道过的分子。另外几个试点命中没有单独的命中标记列，所以没有写进名单。",
        "实验浓度没有写成用法。",
    ]


def render(meds: list[str], labs: Path | None) -> str:
    lines = [TITLE, "", "这次列出正文点名的自噬激活物。", ""]
    lines.extend(method_lines())
    lines.extend(["", *cannot_lines()])
    lines.extend(["", *medication_lines(meds)])
    lines.extend(["", *lab_lines(labs)])
    lines.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def _with_paper_card(text: str) -> str:
    rows = text.splitlines()
    rest = rows[1:]
    while rest and rest[0] == "":
        rest = rest[1:]
    out = "\n".join([rows[0], "", *paper_card_lines(), "", *rest])
    if text.endswith("\n"):
        out += "\n"
    return out


def report(out: Path, meds: Path | None, labs: Path | None, measurements: Path | None, age: float | None = None) -> Path:
    del measurements, age
    out.mkdir(parents=True, exist_ok=True)
    path = out / "report.md"
    path.write_text(_with_paper_card(render(load_meds(meds), labs)), encoding="utf-8")
    return path


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
