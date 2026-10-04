#!/usr/bin/env python3
"""ALBATRO-style length comparison for one gene table.

Cutoffs come from the paper. The repository does not assign i and k.
"""

from __future__ import annotations

from paper_card import lines as paper_card_lines


import argparse
import csv
import math
from pathlib import Path

from presets import (
    ALIASES,
    BOUNDARY,
    FIG4B_DOWN_MEDIAN_BP,
    FIG4B_P,
    FIG4B_UP_MEDIAN_BP,
    LOG2FC_ABS,
    PADJ_MAX,
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


def mann_whitney_p(left: list[float], right: list[float]) -> float:
    """Two-sided Mann-Whitney. Exact when the pooled size is small; otherwise a normal approximation."""
    if not left or not right:
        return float("nan")
    pooled = [(value, 0) for value in left] + [(value, 1) for value in right]
    pooled.sort(key=lambda item: item[0])
    ranks = [0.0] * len(pooled)
    i = 0
    while i < len(pooled):
        j = i
        while j + 1 < len(pooled) and pooled[j + 1][0] == pooled[i][0]:
            j += 1
        average = (i + j) / 2 + 1
        for k in range(i, j + 1):
            ranks[k] = average
        i = j + 1
    rank_left = sum(rank for rank, item in zip(ranks, pooled) if item[1] == 0)
    n1 = len(left)
    n2 = len(right)
    u1 = n1 * n2 + n1 * (n1 + 1) / 2 - rank_left
    u = min(u1, n1 * n2 - u1)
    if n1 + n2 <= 12:
        from itertools import combinations

        values = left + right
        observed = abs(u1 - n1 * n2 / 2)
        extreme = 0
        total = 0
        for chosen in combinations(range(n1 + n2), n1):
            chosen_set = set(chosen)
            sample = [values[index] for index in chosen]
            other = [values[index] for index in range(n1 + n2) if index not in chosen_set]
            # reuse U via pairwise comparison
            wins = 0.0
            for a in sample:
                for b in other:
                    if a > b:
                        wins += 1
                    elif a == b:
                        wins += 0.5
            total += 1
            if abs(wins - n1 * n2 / 2) + 1e-9 >= observed:
                extreme += 1
        return extreme / total
    tie_term = 0.0
    i = 0
    while i < len(pooled):
        j = i
        while j + 1 < len(pooled) and pooled[j + 1][0] == pooled[i][0]:
            j += 1
        t = j - i + 1
        tie_term += t * t * t - t
        i = j + 1
    n = n1 + n2
    variance = n1 * n2 / 12 * ((n + 1) - tie_term / (n * (n - 1)))
    if variance <= 0:
        return 1.0
    z = (u1 - n1 * n2 / 2) / math.sqrt(variance)
    return math.erfc(abs(z) / math.sqrt(2))


def passing_genes(rows: list[dict[str, str]]) -> list[dict[str, float | str]]:
    found = []
    for row in rows:
        keys = field_map(row)
        gene = keys.get("gene") or keys.get("symbol") or keys.get("基因")
        log2fc = as_float(keys.get("log2fc") or keys.get("lfc") or keys.get("log2foldchange"))
        padj = as_float(keys.get("padj") or keys.get("fdr") or keys.get("p_adj") or keys.get("adjp"))
        length = as_float(keys.get("length_bp") or keys.get("length") or keys.get("bp"))
        if not gene or log2fc is None or padj is None or length is None or length <= 0:
            continue
        if abs(log2fc) > LOG2FC_ABS and padj < PADJ_MAX:
            found.append({"gene": gene, "log2fc": log2fc, "padj": padj, "length": length})
    found.sort(key=lambda item: (-abs(float(item["log2fc"])), str(item["gene"])))
    return found


def method_lines(rows: list[dict[str, str]]) -> tuple[str, list[str], list[str]]:
    genes = passing_genes(rows)
    if not genes:
        intro = "这次没有基因同时达到倍数和校正显著性的门槛，所以没有比较长度。"
        lines = ["## 方法算出的名单", "", "没有基因进入名单。出现的名字是基因符号，不是药。"]
        return intro, lines, []
    names = []
    up = []
    down = []
    lines = ["## 方法算出的名单", "", "下面是过了门槛的基因。这些是基因符号，不是药。"]
    for item in genes:
        direction = "上调" if float(item["log2fc"]) > 0 else "下调"
        names.append(str(item["gene"]))
        (up if direction == "上调" else down).append(float(item["length"]))
        lines.append(
            f"- {item['gene']}。长度 {int(item['length'])} bp，{direction}。"
        )
    if up and down:
        up_med = median(up)
        down_med = median(down)
        longer = "下调基因更长。" if down_med > up_med else "下调基因没有更长。"
        p_value = mann_whitney_p(up, down)
        intro = (
            f"这次比较了达到门槛的上调基因和下调基因的中位长度。"
            f"上调 {up_med:.0f} bp，下调 {down_med:.0f} bp。{longer}"
            f"两侧长度的 Wilcoxon 双侧 P 是 {p_value:.4g}。"
            f"论文 Fig. 4b 的中位长度是上调 {FIG4B_UP_MEDIAN_BP} bp、下调 {FIG4B_DOWN_MEDIAN_BP} bp。"
            "那是队列结果，不是你的病程。"
        )
        lines.append(
            f"上调中位长度 {up_med:.0f} bp，下调中位长度 {down_med:.0f} bp。"
        )
    else:
        intro = "这次有基因过了门槛，但上调或下调有一侧是空的，所以没有比较两侧长度。"
    return intro, lines, names


def median(values: list[float]) -> float:
    ordered = sorted(values)
    mid = len(ordered) // 2
    if len(ordered) % 2:
        return float(ordered[mid])
    return (ordered[mid - 1] + ordered[mid]) / 2


def render(meds: list[str], labs: Path | None, rows: list[dict[str, str]]) -> str:
    intro, body, names = method_lines(rows)
    lines = ["# 血液转录本的长度偏倚", "", intro, ""]
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
