#!/usr/bin/env python3
"""Personal readout of ProtAge minus chronological age.

LightGBM weights are not in the method repository. mean_SHAP_value is not used.
"""

from __future__ import annotations

from paper_card import lines as paper_card_lines


import argparse
from pathlib import Path

import csv

from presets import (
    BOTTOM5_PROTAGEGAP_YEARS,
    BOUNDARY,
    PROTEINS,
    TOP5_PROTAGEGAP_YEARS,
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


def load_measurements(path: Path | None) -> dict[str, str]:
    rows = read_rows(path)
    if not rows:
        return {}
    fields = {name.strip().lower(): name for name in rows[0].keys() if name}
    if "item" in fields and "value" in fields:
        out = {}
        for row in rows:
            key = (row.get(fields["item"]) or "").strip()
            if key:
                out[key] = (row.get(fields["value"]) or "").strip()
        return out
    if len(rows) == 1:
        return {key.strip(): (value or "").strip() for key, value in rows[0].items() if key}
    # long table: keep every column of every row under a list encoded later
    return {"__rows__": rows}  # type: ignore[dict-item]


def load_measurement_rows(path: Path | None) -> list[dict[str, str]]:
    return read_rows(path)


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
        lowered = { (k or "").strip(): (v or "").strip() for k, v in row.items() }
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
    raw = str(text).strip().replace("＋", "+").replace("－", "-")
    if raw == "":
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def matched_proteins(rows: list[dict[str, str]]) -> tuple[list[str], float | None]:
    supplied = {}
    protage = None
    for row in rows:
        keys = {k.strip().lower(): (v or "").strip() for k, v in row.items() if k}
        if "item" in keys or "marker" in keys or "name" in keys:
            name = keys.get("item") or keys.get("marker") or keys.get("name") or ""
            value = keys.get("value", "")
        elif "gene" in keys:
            name = keys["gene"]
            value = keys.get("npx") or keys.get("value") or ""
        else:
            continue
        if name.lower() in {"protage", "蛋白质年龄"}:
            protage = as_float(value)
        else:
            supplied[name] = value
    matched = []
    for gene in supplied:
        label = PROTEINS.get(gene.upper())
        if label and label not in matched:
            matched.append(label)
    return matched, protage


def opening(rows: list[dict[str, str]], age: float | None) -> tuple[str, list[str]]:
    matched, protage = matched_proteins(rows)
    if protage is not None and age is not None:
        gap = protage - age
        if gap >= 0:
            beside = f"论文里前 5% 的平均差是 {TOP5_PROTAGEGAP_YEARS} 年。"
        else:
            beside = f"论文里后 5% 的平均差是 {BOTTOM5_PROTAGEGAP_YEARS} 年。"
        return f"你交来的蛋白质年龄减去实足年龄是 {gap:.1f} 年。{beside}", matched
    return (
        "补充表和公开仓库都没有 LightGBM 系数，这次也没有同时给出蛋白质年龄和实足年龄，所以没有算出年龄差。"
    ), matched


def method_lines(matched: list[str]) -> list[str]:
    lines = ["## 方法算出的名单", "", f"对上了 {len(matched)} 个。"]
    for name in matched:
        lines.append(f"- {name}")
    if not matched:
        lines.append("没有对上的名字。")
    return lines


def medication_lines(meds: list[str]) -> list[str]:
    lines = ["## 你正在使用的药", ""]
    if not meds:
        lines.append("没有提供现用药。")
        return lines
    known = {name.casefold() for name in PROTEINS.values()}
    for name in meds:
        if name.casefold() in known:
            lines.append(f"- {name}：这个名字出现在蛋白名单的可读名里。不能据此停。")
        else:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def render(age: float | None, meds: list[str], labs: Path | None, rows: list[dict[str, str]]) -> str:
    paragraph, matched = opening(rows, age)
    lines = ["# 蛋白质年龄和实足年龄", "", paragraph, ""]
    lines.extend(method_lines(matched))
    lines.extend(["", *medication_lines(meds)])
    lines.extend(["", *lab_lines(labs)])
    return finish(lines)


def report(out: Path, meds: Path | None, labs: Path | None, measurements: Path | None, age: float | None = None) -> Path:
    text = render(age, load_meds(meds), labs, load_measurement_rows(measurements))
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
