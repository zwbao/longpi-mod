#!/usr/bin/env python3
"""Personal readout. Cohort statistics stay in presets.py and claims.md."""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import BOUNDARY, FORMULAS, ITEMS, MISSING, REPORT_TITLE, TREATMENTS, resolve


def as_float(text):
    if text is None:
        return None
    raw = str(text).strip().replace("＋", "+").replace("－", "-")
    if raw == "":
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def _norm(text):
    return text.strip().casefold().replace(" ", "").replace("_", "").replace("-", "")


def load_measurements(path):
    if path is None:
        return {}
    text = path.read_text(encoding="utf-8-sig")
    lines = [line for line in text.splitlines() if line.strip() and not line.strip().startswith("#")]
    if not lines:
        return {}
    rows = list(csv.reader(lines))
    header = [cell.strip().lower() for cell in rows[0]]
    name_headers = {"name", "gene", "item", "项目", "mirna", "marker", "key", "rna"}
    value_headers = {"value", "结果", "expression", "表达", "result"}
    if header and header[0] in name_headers:
        name_idx = next(i for i, cell in enumerate(header) if cell in name_headers)
        value_idx = next((i for i, cell in enumerate(header) if cell in value_headers), 1)
        data = rows[1:]
    else:
        name_idx, value_idx, data = 0, 1, rows
    out = {}
    for row in data:
        if len(row) <= name_idx:
            continue
        key = row[name_idx].strip()
        if not key:
            continue
        value = row[value_idx].strip() if len(row) > value_idx else ""
        out[key] = value
    return out


def load_medications(path):
    if path is None:
        return []
    names = []
    for line in path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            names.append(text)
    return names


def parse_labs(path):
    if path is None:
        return []
    text = path.read_text(encoding="utf-8-sig")
    lines = [line for line in text.splitlines() if line.strip()]
    if not lines:
        return []
    if "," in lines[0] and ("项目" in lines[0] or "item" in lines[0].lower()):
        found = []
        for row in csv.DictReader(lines):
            lowered = {(key or "").strip(): (value or "").strip() for key, value in row.items()}
            name = lowered.get("项目") or lowered.get("item") or lowered.get("name") or ""
            value = lowered.get("结果") or lowered.get("value") or lowered.get("result") or ""
            unit = lowered.get("单位") or lowered.get("unit") or ""
            if name:
                found.append((name, value, unit))
        return found
    found = []
    for row in csv.reader(lines):
        if row and row[0].strip():
            value = row[1].strip() if len(row) > 1 else ""
            unit = row[2].strip() if len(row) > 2 else ""
            found.append((row[0].strip(), value, unit))
    return found


def _pick(values, aliases):
    folded = {_norm(key): value for key, value in values.items()}
    for alias in aliases:
        if _norm(alias) in folded:
            return folded[_norm(alias)]
    return None


def formula_lines(values):
    listed = []
    missing = []
    for spec in FORMULAS:
        numerator = _pick(values, spec["num"])
        denominator = _pick(values, spec["den"])
        if numerator is None and denominator is None:
            continue
        if numerator is None:
            missing.append(spec["missing_num"])
            continue
        if denominator is None:
            missing.append(spec["missing_den"])
            continue
        num = as_float(numerator)
        den = as_float(denominator)
        if num is None or den is None:
            missing.append(f"{spec['label']}的分子或分母不是数字，所以没有做除法。")
            continue
        if den == 0:
            missing.append(f"{spec['label']}的分母是 0，所以没有做除法。")
            continue
        ratio = num / den
        listed.append(f"{spec['label']} {ratio:.4f}。{spec['note']}")
    return listed, missing


def matched_lines(values):
    found = {}
    for raw, value in values.items():
        item_id = resolve(raw)
        if item_id and item_id not in found:
            found[item_id] = value
    lines = []
    for item_id, item in ITEMS.items():
        if item_id not in found:
            continue
        line = item["sentence"]
        value = found[item_id]
        if value != "":
            line += f"你提供的数值是 {value}。数值只照录，没有乘权重。"
        lines.append(line)
    return lines


def build(values, age):
    lines = matched_lines(values)
    ratios, ratio_missing = formula_lines(values)
    lines.extend(ratios)
    if lines:
        can = ["下面是能算的部分。只用正文写出的方向，或正文写死的除法。没有自造权重。", *lines]
    else:
        can = ["这次没有对上正文点名的项目，也没有凑齐正文定义的分子和分母，所以没有算出名单。"]
    missing = list(MISSING)
    missing.extend(ratio_missing)
    if age is None:
        missing.append("没有提供年龄。论文没有把单个年龄放进可套用的截距列。")
    else:
        missing.append(f"提供的年龄是 {age:g} 岁。论文没有把单个年龄放进可套用的截距列。")
    return can, missing, lines


def medication_lines(medications, list_lines):
    lines = ["## 你正在使用的药", ""]
    if not medications:
        lines.append("没有提供现用药。不能据此停。")
        return lines
    blob = "\n".join(list_lines)
    treatments = {_norm(name) for name in TREATMENTS}
    for name in medications:
        if _norm(name) in treatments:
            lines.append(f"- {name}：这个名字出现在论文的实验处理里。不能据此停。")
        elif name and name in blob:
            lines.append(f"- {name}：这个名字出现在方法名单里。不能据此停。")
        else:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def lab_block(labs):
    rows = ["## 体检", ""]
    if not labs:
        rows.append("没有提供体检。体检不增删方法算出的名单。")
        return rows
    rows.append("下面照录体检数值。体检不增删方法算出的名单。")
    for name, value, unit in labs:
        shown = " ".join(part for part in (name, value, unit) if part)
        rows.append(f"- {shown}")
    return rows


def render(values, meds, labs, age):
    can, missing, listed = build(values, age)
    body = [REPORT_TITLE, "", "## 能算的", "", *can, "", "## 不能算的", "", *missing]
    body.extend(["", "## 方法算出的名单", ""])
    if listed:
        body.extend(f"{index}. {line}" for index, line in enumerate(listed, start=1))
    else:
        body.append("没有项目进入名单。")
    body.extend(["", *medication_lines(meds, listed)])
    body.extend(["", *lab_block(labs)])
    body.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(body) + "\n"


def _with_paper_card(text):
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


def report(out, measurements=None, medications=None, labs=None, age=None):
    text = render(
        load_measurements(measurements),
        load_medications(medications),
        parse_labs(labs),
        age,
    )
    out.mkdir(parents=True, exist_ok=True)
    destination = out / "report.md"
    destination.write_text(_with_paper_card(text), encoding="utf-8")
    return destination


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--measurements", type=Path, default=None)
    parser.add_argument("--medications", type=Path, default=None)
    parser.add_argument("--labs", type=Path, default=None)
    parser.add_argument("--age", type=float, default=None)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    print(report(args.out, args.measurements, args.medications, args.labs, args.age))
    return 0


if __name__ == "__main__":
    sys.exit(main())
