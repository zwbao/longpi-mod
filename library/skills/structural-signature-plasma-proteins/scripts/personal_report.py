#!/usr/bin/env python3
"""Record the three peptides. Compare only a proteome-wide accessibility."""

from __future__ import annotations

from paper_card import lines as paper_card_lines


import argparse
import csv
import math
from pathlib import Path

from presets import (
    ALIASES,
    BOUNDARY,
    GROUP_MEANS,
    PANEL,
    PEPTIDES,
    WEIGHTS_PRESENT,

)

def read_rows(path: Path | None) -> list[dict[str, str]]:
    if path is None:
        return []
    with path.open(encoding="utf-8-sig", newline="") as handle:
        sample = handle.read(4096)
        handle.seek(0)
        if not sample.strip():
            return []
        dialect = csv.Sniffer().sniff(sample, delimiters=",\t")
        return list(csv.DictReader(handle, dialect=dialect))


def load_meds(path: Path | None) -> list[str]:
    if path is None:
        return []
    names = []
    for line in path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            names.append(text)
    return names


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
        else:
            bits = [f"{key} {value}".strip() for key, value in lowered.items() if key and value]
            if bits:
                lines.append("- " + "，".join(bits))
    return lines


def write_report(out: Path, text: str) -> Path:
    out.mkdir(parents=True, exist_ok=True)
    path = out / "report.md"
    if not text.endswith("\n"):
        text += "\n"
    path.write_text(_with_paper_card(text), encoding="utf-8")
    return path


def finish(lines: list[str]) -> str:
    lines.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def as_float(text: str | None) -> float | None:
    if text is None:
        return None
    raw = str(text).strip().replace("＋", "+").replace("－", "-").replace(",", "")
    if raw == "":
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def norm(text: str) -> str:
    value = text.strip().casefold().replace(" ", "").replace("-", "").replace("_", "")
    for form in ("肠溶片", "缓释片", "咀嚼片", "分散片", "胶囊", "颗粒", "滴丸", "注射液", "片"):
        value = value.replace(form, "")
    return value


def alias_pairs() -> list[tuple[str, str]]:
    pairs = []
    for display, aliases in ALIASES.items():
        pairs.append((display, display))
        for alias in aliases:
            pairs.append((alias, display))
    return pairs


def medication_lines(meds: list[str], names: list[str]) -> list[str]:
    lines = ["## 你正在使用的药", ""]
    if not meds:
        lines.append("没有提供现用药。不能据此停。")
        return lines
    known = {norm(name): name for name in names if norm(name)}
    for name in meds:
        hit = known.get(norm(name))
        if hit is None:
            token = norm(name)
            for alias, display in alias_pairs():
                folded = norm(alias)
                if len(folded) >= 3 and (folded == token or folded in token):
                    hit = display
                    break
        if hit is None:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
        else:
            lines.append(f"- {name}：对应名单上的 {hit}。不能据此停。")
    return lines


def field_map(row: dict[str, str]) -> dict[str, str]:
    return {(k or "").strip().lower(): (v or "").strip() for k, v in row.items() if k}


TITLE = "# 血浆蛋白的结构可及性"


def nearest_group(value: float) -> tuple[str, float]:
    label, mean = min(GROUP_MEANS, key=lambda item: (abs(value - item[1]), item[0]))
    return label, abs(value - mean)


def _values(rows: list[dict[str, str]]) -> dict[str, float]:
    found = {}
    for row in rows:
        keys = field_map(row)
        item = keys.get("item") or keys.get("protein") or keys.get("gene") or keys.get("项目")
        value = as_float(keys.get("value") or keys.get("结果") or keys.get("accessibility"))
        if item and value is not None:
            found[norm(item)] = value
    return found


def _overall(found: dict[str, float]) -> float | None:
    for key in ("整体可及性", "overall", "mean_accessibility", "proteome"):
        if norm(key) in found:
            return found[norm(key)]
    return None


def method_lines(rows: list[dict[str, str]]) -> tuple[str, list[str], list[str]]:
    found = _values(rows)
    lines = ["## 方法算出的名单", ""]
    names = []
    any_peptide = False
    for symbol, display in PANEL:
        names.append(display)
        peptide = PEPTIDES[symbol]
        value = None
        for alias in (symbol, display):
            if norm(alias) in found:
                value = found[norm(alias)]
                break
        if value is None:
            lines.append(f"- {display}。肽段 {peptide}。这份表没有可及性。")
            continue
        any_peptide = True
        lines.append(
            f"- {display}。肽段 {peptide}。可及性 {value:g}。论文没有印出这个肽段的分组平均，也不印分类器系数，所以没有分组。"
        )
    overall = _overall(found)
    if overall is not None:
        label, distance = nearest_group(overall)
        lines.append(
            f"- 整体可及性。数值 {overall:g}，离论文组平均最近的是{label}，差 {distance:.4g} 个百分点。这不是三个肽段的分类。"
        )
        intro = (
            f"这次把整体可及性 {overall:g} 和论文的组平均作了比较，最近的是{label}。"
            "这不是三个肽段的分类。"
        )
    elif any_peptide:
        intro = "这次照录了肽段可及性。论文没有印出分类器系数，所以没有分成健康、轻度认知障碍或阿尔茨海默病。"
    else:
        intro = "这次没有可及性数值，也没有分类器系数，所以没有分类。"
    return intro, lines, names


def render(meds: list[str], labs: Path | None, rows: list[dict[str, str]]) -> str:
    intro, body, names = method_lines(rows)
    lines = [TITLE, "", intro, ""]
    lines.extend(body)
    lines.extend(["", *medication_lines(meds, names)])
    lines.extend(["", *lab_lines(labs)])
    return finish(lines)


def report(out: Path, meds: Path | None, labs: Path | None, measurements: Path | None, age: float | None = None) -> Path:
    del age
    text = render(load_meds(meds), labs, read_rows(measurements))
    return write_report(out, text)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--measurements", type=Path)
    parser.add_argument("--medications", type=Path)
    parser.add_argument("--labs", type=Path)
    parser.add_argument("--age", type=float)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    path = report(args.out, args.medications, args.labs, args.measurements, args.age)
    print(path)



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
    main()
