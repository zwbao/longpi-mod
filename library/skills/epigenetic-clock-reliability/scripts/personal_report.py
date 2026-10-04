#!/usr/bin/env python3
"""Absolute deviation between two supplied clock ages. PC loadings are absent."""

from __future__ import annotations

from paper_card import lines as paper_card_lines


import argparse
import csv
import math
from pathlib import Path

from presets import (
    ALIASES,
    BOUNDARY,
    CLOCKS,
    HORVATH1_MEDIAN,
    HORVATH1_MAX,
    PCPHENOAGE_MAX,
    PCPHENOAGE_MEDIAN,
    PHENOAGE_MAX,
    PHENOAGE_MEDIAN,
    RDATA_PRESENT,
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


TITLE = "# 两次甲基化年龄的差"

CLOCK_ZH = {
    "Horvath1": "霍瓦特时钟",
    "Horvath2": "霍瓦特皮肤时钟",
    "Hannum": "汉纳姆时钟",
    "PhenoAge": "表型年龄",
    "GrimAge": "格里姆年龄",
    "DNAmTL": "甲基化端粒长度",
    "PCHorvath1": "主成分霍瓦特时钟",
    "PCHorvath2": "主成分霍瓦特皮肤时钟",
    "PCHannum": "主成分汉纳姆时钟",
    "PCPhenoAge": "主成分表型年龄",
    "PCGrimAge": "主成分格里姆年龄",
    "PCDNAmTL": "主成分甲基化端粒长度",
}


def replicate_deviation(age_a: float, age_b: float) -> float:
    return abs(age_a - age_b)


PUBLISHED = {
    "Horvath1": f"Fig. 1 的中位差是 {HORVATH1_MEDIAN} 年，最大 {HORVATH1_MAX} 年。",
    "PhenoAge": f"Fig. 1 的中位差是 {PHENOAGE_MEDIAN} 年，最大 {PHENOAGE_MAX} 年。",
    "PCPhenoAge": f"Fig. 3 的中位差是 {PCPHENOAGE_MEDIAN} 年，最大 {PCPHENOAGE_MAX} 年。",
}


def _devs(rows: list[dict[str, str]]) -> dict[str, float]:
    found = {}
    bag: dict[str, float | None] = {}
    for row in rows:
        keys = field_map(row)
        clock = keys.get("clock")
        a = as_float(keys.get("age_a"))
        b = as_float(keys.get("age_b"))
        if clock and a is not None and b is not None and "age_a" in keys:
            found[norm(clock)] = replicate_deviation(a, b)
            continue
        item = keys.get("marker") or keys.get("item") or keys.get("key")
        if item and keys.get("value") not in (None, ""):
            bag[norm(item)] = as_float(keys.get("value"))
    for clock in CLOCKS:
        if norm(clock) in found:
            continue
        left = bag.get(norm(f"{clock}_a"))
        right = bag.get(norm(f"{clock}_b"))
        if left is not None and right is not None:
            found[norm(clock)] = replicate_deviation(left, right)
    return found


def method_lines(rows: list[dict[str, str]]) -> tuple[str, list[str], list[str]]:
    found = _devs(rows)
    lines = ["## 方法算出的名单", ""]
    done = []
    for clock in CLOCKS:
        label = f"{clock} {CLOCK_ZH.get(clock, '')}".strip()
        deviation = found.get(norm(clock))
        if deviation is None:
            continue
        done.append(f"{label} 的绝对差是 {deviation:.4g} 年")
        published = PUBLISHED.get(clock)
        if published:
            lines.append(
                f"- {label}。两次年龄的绝对差是 {deviation:.4g} 年。{published}这不是新的生物年龄。"
            )
        else:
            lines.append(f"- {label}。两次年龄的绝对差是 {deviation:.4g} 年。论文没有给这个时钟单独的一个中位差。")
    if done:
        intro = "这次算出两次甲基化年龄的绝对差。" + "，".join(done) + "。仓库没有主成分载荷，不算 PC 年龄。"
    else:
        intro = "这次没有成对的甲基化年龄，所以没有算出两次之差。不算 PC 年龄。"
        lines.append("这次没有算出两次之差。")
    return intro, lines, list(CLOCKS)


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
