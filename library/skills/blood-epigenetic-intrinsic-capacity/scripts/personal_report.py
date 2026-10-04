#!/usr/bin/env python3
"""Intrinsic capacity domain rescale without CpG weights."""

from __future__ import annotations

from paper_card import lines as paper_card_lines


import argparse
import csv
from pathlib import Path

from presets import *

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




def parse_table(rows):
    items = {}
    records = []
    for row in rows:
        keys = {(k or "").strip().lower(): (v or "").strip() for k, v in row.items()}
        if "item" in keys and "value" in keys and "organ" not in keys:
            if keys["item"]:
                items[keys["item"].lower()] = keys["value"]
        else:
            records.append(keys)
    return items, records


def miss(name: str) -> str:
    return f"- {name}：名单里没有这个名字。不能据此停。"



def dnam_score(items):
    levels = {}
    for key, value in items.items():
        if not key.startswith("cg"):
            continue
        number = as_float(value)
        if number is not None:
            levels[key] = number
    if any(site not in levels for site in CPG_COEF):
        return None
    return IC_INTERCEPT + sum(CPG_COEF[site] * levels[site] for site in CPG_COEF)


def opening(rows):
    items, _records = parse_table(rows)
    dnam = dnam_score(items)
    if dnam is not None:
        return f"这次用补充表的位点系数和截距，算出甲基化内在能力是 {dnam:.6f}。", [("甲基化内在能力", dnam)]
    needed = ("mmse", "sppb", "phq9", "vision", "hearing")
    labels = {"mmse": "认知", "sppb": "行走", "phq9": "情绪", "vision": "感觉", "hearing": "感觉"}
    matched = []
    for key, label in labels.items():
        if as_float(items.get(key)) is not None and label not in matched:
            matched.append(label)
    if any(items.get(key) in (None, "") for key in needed):
        return (
            "补充表有甲基化系数，这次没有交齐全部位点，临床分数也没有到齐，所以没有算出内在能力。"
        ), matched
    values = [as_float(items[key]) for key in needed]
    if any(value is None for value in values):
        return (
            "补充表有甲基化系数，这次没有交齐全部位点，临床分数也读不成数字，所以没有算出内在能力。"
        ), matched
    mmse, sppb, phq9, vision, hearing = values
    partial = (
        mmse / MMSE_MAX
        + sppb / SPPB_MAX
        + (PHQ9_MAX - phq9) / PHQ9_MAX
        + ((vision / VISION_MAX) + (hearing / HEARING_MAX)) / 2
    ) / 4
    return (
        f"认知、行走、情绪、感觉按满分缩放到 0 到 1 后的平均是 {partial:.2f}。"
        "这不是论文的 IC，握力没有放进去。"
    ), matched


def method_lines(matched):
    lines = ["## 方法算出的名单", ""]
    if matched and isinstance(matched[0], tuple):
        lines.append(f"对上了 {len(matched)} 个。")
        for name, value in matched:
            lines.append(f"- {name} {value:.6f}")
        return lines
    if matched:
        head = f"对上了 {len(matched)} 个：" + "、".join(matched) + "。"
    else:
        head = "对上了 0 个。"
    lines.extend([head, "名单是" + "、".join(DOMAINS) + "。"])
    return lines


def medication_lines(meds):
    lines = ["## 你正在使用的药", ""]
    if not meds:
        lines.append("没有提供现用药。")
        return lines
    for name in meds:
        lines.append(miss(name))
    return lines


def render(age, meds, labs, rows):
    paragraph, matched = opening(rows)
    lines = ["# 内在能力", "", paragraph, ""]
    lines.extend(method_lines(matched))
    lines.extend(["", *medication_lines(meds)])
    lines.extend(["", *lab_lines(labs)])
    return finish(lines)


def report(out, meds, labs, measurements, age=None):
    return write_report(out, render(age, load_meds(meds), labs, load_measurement_rows(measurements)))


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
