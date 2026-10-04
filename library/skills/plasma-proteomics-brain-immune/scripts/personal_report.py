#!/usr/bin/env python3
"""Organ age z gaps from Oh et al. 2025."""

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



LOOKUP = {name: key for key, name in ORGANS.items()}
LOOKUP.update({key: key for key in ORGANS})


def organ_key(text: str):
    return LOOKUP.get(text.strip().lower()) or LOOKUP.get(text.strip())


def collect_z(rows):
    items, records = parse_table(rows)
    found = []
    for rec in records:
        key = organ_key(rec.get("organ") or rec.get("器官") or "")
        z = as_float(rec.get("z") or rec.get("z_gap"))
        if key and z is not None:
            found.append((key, z))
    for key, value in items.items():
        organ = organ_key(key)
        z = as_float(value)
        if organ and z is not None:
            found.append((organ, z))
    return found


def one_comparison(aged: list[str], young: list[str]) -> str:
    if len(aged) >= 8:
        return f"论文里 8 个及以上加速器官的死亡风险比是 {MORT_HR['8+']}。"
    if len(aged) >= 5:
        return f"论文里 5 到 7 个加速器官的死亡风险比是 {MORT_HR['5-7']}。"
    if len(aged) >= 2:
        return f"论文里 2 到 4 个加速器官的死亡风险比是 {MORT_HR['2-4']}。"
    if "brain" in aged:
        return f"论文里特别老化的脑，阿尔茨海默病风险比是 {AD_AGED_HR}。"
    if "brain" in young and "immune" in young:
        return f"论文里脑和免疫都年轻时的死亡风险比是 {YOUTH_BOTH_MORT_HR}。"
    if "brain" in young:
        return f"论文里特别年轻的脑，阿尔茨海默病风险比是 {AD_YOUTHFUL_HR}。"
    if "immune" in young:
        return f"论文里特别年轻的免疫，死亡风险比是 {YOUTH_IMMUNE_MORT_HR}。"
    return ""


def norm_key(text: str) -> str:
    return "".join(ch for ch in text.casefold() if ch.isalnum())


def protein_levels(rows):
    items, records = parse_table(rows)
    found = {}
    for key, value in items.items():
        number = as_float(value)
        if number is not None:
            found[norm_key(key)] = number
    for rec in records:
        if rec.get("organ") or rec.get("器官"):
            continue
        gene = rec.get("gene") or rec.get("protein") or ""
        number = as_float(rec.get("value") or rec.get("npx") or rec.get("z"))
        if gene and number is not None:
            found[norm_key(gene)] = number
    return found


def predict_models(rows):
    levels = protein_levels(rows)
    ages = []
    for key in MODEL_ORDER:
        coefs = MODEL_COEF[key]
        if any(norm_key(gene) not in levels for gene in coefs):
            continue
        total = MODEL_INTERCEPT[key]
        for gene, coef in coefs.items():
            total += coef * levels[norm_key(gene)]
        ages.append((MODEL_LABELS[key], total))
    return ages


def opening(rows):
    found = collect_z(rows)
    ages = predict_models(rows)
    matched = []
    bits = []
    if ages:
        parts = [f"{name} {total:.4f} 岁" for name, total in ages]
        bits.append("这次按补充表的线性公式，用你交来的蛋白 z 分数算出预测年龄：" + "，".join(parts) + "。")
        for name, _total in ages:
            if name not in matched:
                matched.append(name)
    if not found and not ages:
        return (
            "补充表给出了各器官的线性系数，这次没有交齐可相乘的蛋白 z 分数，也没有器官 z，所以没有算出预测年龄。"
        ), matched, ages
    aged, young = [], []
    for key, z in found:
        name = ORGANS[key]
        if name not in matched:
            matched.append(name)
        if z > EXTREME_Z:
            aged.append(key)
            side = f"高于 {EXTREME_Z:g} 个标准差"
        elif z < -EXTREME_Z:
            young.append(key)
            side = f"低于 −{EXTREME_Z:g} 个标准差"
        else:
            side = f"没有越过 {EXTREME_Z:g} 个标准差"
        bits.append(f"{name}的 z 是 {z:.1f}，{side}。")
    return "".join(bits) + one_comparison(aged, young), matched, ages


def method_lines(matched, ages=None):
    ages = ages or []
    if matched:
        head = f"对上了 {len(matched)} 个：" + "、".join(matched) + "。"
    else:
        head = "对上了 0 个。"
    lines = ["## 方法算出的名单", "", head]
    if not ages:
        lines.append("名单是" + "、".join(ORGANS.values()) + "。")
    for name, total in ages:
        lines.append(f"- {name} {total:.4f}")
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
    paragraph, matched, ages = opening(rows)
    lines = ["# 器官年龄差", "", paragraph, ""]
    lines.extend(method_lines(matched, ages))
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
