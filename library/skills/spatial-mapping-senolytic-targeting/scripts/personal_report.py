#!/usr/bin/env python3
"""log2 ratio of GAL3-positive to GAL3-negative expression. Mouse doses are not human doses."""

from __future__ import annotations

from paper_card import lines as paper_card_lines


import argparse
import csv
import math
from pathlib import Path

from presets import (
    ALIASES,
    AP20187_MG_PER_KG,
    BOUNDARY,
    INTERVENTIONS,
    MARKERS,
    VENETOCLAX_MG_PER_KG,
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


TITLE = "# 白质里的衰老小胶质细胞"

MARKER_ZH = {
    "Lgals3": "半乳糖凝集素 3",
    "Cdkn2a": "周期蛋白依赖性激酶抑制因子 2A",
    "Cdkn1a": "周期蛋白依赖性激酶抑制因子 1A",
    "Ccl2": "趋化因子配体 2",
    "Ccl3": "趋化因子配体 3",
    "Ccl4": "趋化因子配体 4",
    "Ccl5": "趋化因子配体 5",
    "Spp1": "骨桥蛋白",
    "Bcl2": "B 细胞淋巴瘤蛋白 2",
    "Apoe": "载脂蛋白 E",
    "Itgax": "整合素 αX",
}


def gal3_log2(positive: float, negative: float) -> float:
    return math.log2(positive / negative)


def _expr(rows: list[dict[str, str]]) -> dict[str, tuple[float | None, float | None]]:
    found = {}
    for row in rows:
        keys = field_map(row)
        gene = keys.get("gene") or keys.get("symbol")
        if not gene:
            continue
        found[norm(gene)] = (as_float(keys.get("gal3_pos")), as_float(keys.get("gal3_neg")))
    return found


def method_lines(rows: list[dict[str, str]]) -> tuple[str, list[str], list[str]]:
    lines = ["## 方法算出的名单", ""]
    names = list(INTERVENTIONS) + list(MARKERS)
    found = _expr(rows)
    calculated = []
    for gene in MARKERS:
        zh = MARKER_ZH.get(gene, "")
        label = f"{gene} {zh}".strip()
        pos, neg = found.get(norm(gene), (None, None))
        if pos is None or neg is None:
            continue
        if pos <= 0 or neg <= 0:
            lines.append(f"- {label}。表达量不是正数，不算 log2 倍数。")
        else:
            ratio = gal3_log2(pos, neg)
            calculated.append(f"{label} 是 {ratio:.4g}")
            lines.append(f"- {label}。GAL3 阳性比阴性的 log2 倍数是 {ratio:.4g}。")
    if calculated:
        intro = (
            "这次用阳性表达除以阴性表达，再取 log2。"
            + "，".join(calculated)
            + "。论文的差异表来自 DESeq2，这里没有计数矩阵，不算 P 值。小鼠剂量是论文的实验，不是给人的用法。"
        )
    else:
        intro = "这次没有成对的表达量，所以没有算出倍数。"
        lines.append("这次没有算出倍数。")
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
