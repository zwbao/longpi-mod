#!/usr/bin/env python3
"""ProteinScore readout without elastic-net weights."""

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



def norm_key(text: str) -> str:
    return "".join(ch for ch in text.casefold() if ch.isalnum())


def complete_scores(rows):
    items, _records = parse_table(rows)
    levels = {}
    for key, value in items.items():
        number = as_float(value)
        if number is not None:
            levels[norm_key(key)] = number
    done = []
    for name, feats in SCORE_WEIGHTS.items():
        copies = {}
        for gene, _pid, _coef in feats:
            copies[norm_key(gene)] = copies.get(norm_key(gene), 0) + 1
        total = 0.0
        ok = True
        for gene, pid, coef in feats:
            full = norm_key(pid)
            short = norm_key(gene)
            if full in levels:
                total += coef * levels[full]
            elif short in levels and copies[short] == 1:
                total += coef * levels[short]
            else:
                ok = False
                break
        if ok:
            done.append((name, total))
    return done


def hba_clause(hba: float) -> str:
    value = f"你提供的糖化血红蛋白是 {hba:.0f} mmol/mol"
    if hba > HBA1C_DIAGNOSIS:
        beside = f"论文写出的诊断界是两次大于 {HBA1C_DIAGNOSIS} mmol/mol，用来对照 2型糖尿病"
    elif HBA1C_SCREEN_LOW <= hba <= HBA1C_SCREEN_HIGH:
        beside = f"它落在论文写出的筛查带 {HBA1C_SCREEN_LOW} 到 {HBA1C_SCREEN_HIGH} mmol/mol，用来对照 2型糖尿病"
    else:
        beside = "它不在论文写出的筛查带里，论文用这个指标对照 2型糖尿病"
    return value + "，" + beside + "。"


def opening(rows):
    items, _records = parse_table(rows)
    scores = complete_scores(rows)
    hba = as_float(items.get("hba1c"))
    if scores:
        parts = [f"{name} {value:.6f}" for name, value in scores]
        text = "这次用补充表的系数，把你交来的缩放蛋白量加总成线性预测值：" + "，".join(parts) + "。"
        if hba is not None:
            text += hba_clause(hba)
        return text, scores
    text = "补充表有蛋白系数，但这次没有凑齐任何一个分数的全部蛋白，所以没有算出线性预测值。"
    if hba is not None:
        text += hba_clause(hba)
    return text, []


def method_lines(scores):
    lines = ["## 方法算出的名单", ""]
    if not scores:
        lines.append("对上了 0 个。")
        return lines
    lines.append(f"对上了 {len(scores)} 个。")
    for name, value in scores:
        lines.append(f"- {name} {value:.6f}")
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
    lines = ["# 血液蛋白与发病", "", paragraph, ""]
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
