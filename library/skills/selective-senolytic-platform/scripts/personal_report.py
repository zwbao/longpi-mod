#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import BOUNDARY

def read_rows(path):
    if path is None:
        return []
    text_path = Path(path)
    if not text_path.exists():
        return []
    raw = text_path.read_text(encoding="utf-8-sig")
    if not raw.strip():
        return []
    sample = raw[:4096]
    dialect = csv.Sniffer().sniff(sample, delimiters=",\t")
    return list(csv.DictReader(raw.splitlines(), dialect=dialect))

def load_meds(path):
    if path is None:
        return []
    names = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            names.append(text)
    return names

def norm(text):
    value = text.strip().casefold().replace(" ", "").replace("-", "").replace("_", "")
    for form in ("肠溶片", "缓释片", "咀嚼片", "分散片", "胶囊", "颗粒", "滴丸", "注射液", "片"):
        value = value.replace(form, "")
    return value

def as_float(text):
    if text is None:
        return None
    raw = str(text).strip().replace("＋", "+").replace("－", "-").replace(",", "")
    if raw == "":
        return None
    try:
        return float(raw)
    except ValueError:
        return None

def field_map(row):
    return {(k or "").strip().lower(): (v or "").strip() for k, v in row.items() if k}

def measurements(rows):
    found = {}
    genes = []
    for row in rows:
        keys = field_map(row)
        if keys.get("gene") or keys.get("symbol"):
            genes.append(keys)
            continue
        name = keys.get("name") or keys.get("item") or keys.get("项目")
        value = keys.get("value") or keys.get("结果")
        if name:
            found[norm(name)] = value
    return found, genes

def fmt(value):
    return f"{value:.6g}"

def lab_lines(path):
    rows = read_rows(path)
    lines = ["## 体检", ""]
    if not rows:
        lines.append("没有提供体检。体检不增删方法算出的名单。")
        return lines
    lines.append("下面照录体检数值。体检不增删方法算出的名单。")
    for row in rows:
        keys = {(k or "").strip(): (v or "").strip() for k, v in row.items() if k}
        item = keys.get("项目") or keys.get("item") or keys.get("name")
        value = keys.get("结果") or keys.get("value") or keys.get("result")
        unit = keys.get("单位") or keys.get("unit") or ""
        if item and value:
            suffix = f" {unit}" if unit else ""
            lines.append(f"- {item} {value}{suffix}")
    return lines

def medication_lines(meds, aliases):
    lines = ["## 你正在使用的药", ""]
    if not meds:
        lines.append("没有提供现用药。不能据此停。")
        return lines
    pairs = []
    for display, names in aliases.items():
        for alias in names:
            pairs.append((norm(alias), display))
    pairs.sort(key=lambda item: len(item[0]), reverse=True)
    for name in meds:
        token = norm(name)
        hit = None
        for folded, display in pairs:
            if len(folded) >= 3 and (folded == token or folded in token):
                hit = display
                break
        if hit is None:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
        else:
            lines.append(f"- {name}：对应名单上的 {hit}。不能据此停。")
    return lines

def lookup(found, *names):
    for name in names:
        if norm(name) in found:
            return found[norm(name)]
    return None

def finish(title, intro, method, missing, meds, aliases, labs, age):
    lines = [title, "", intro]
    if age is not None:
        lines.extend(["", f"你提供的年龄是 {fmt(age)} 岁。这个数不进入方法名单。"])
    lines.extend(["", "## 方法算出的名单", ""])
    lines.extend(method)
    lines.extend(["", "## 不能算的", ""])
    lines.extend(f"- {item}" for item in missing)
    lines.extend(["", *medication_lines(meds, aliases)])
    lines.extend(["", *lab_lines(labs)])
    lines.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"

def write_report(out, text):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    path = out / "report.md"
    rows = text.splitlines()
    rest = rows[1:]
    while rest and rest[0] == "":
        rest = rest[1:]
    merged = [rows[0], "", *paper_card_lines(), "", *rest]
    body = "\n".join(merged)
    if text.endswith("\n"):
        body += "\n"
    path.write_text(body, encoding="utf-8")
    return path

def add_args(parser):
    parser.add_argument("--measurements", type=Path)
    parser.add_argument("--medications", type=Path)
    parser.add_argument("--labs", type=Path)
    parser.add_argument("--age", type=float)
    parser.add_argument("--out", type=Path, required=True)

from presets import (
    ALIASES,
    DASATINIB_MG_PER_MOUSE,
    MGL392_MG_PER_MOUSE,
    PALBOCICLIB_MG_PER_MOUSE,
    QUERCETIN_MG_PER_MOUSE,
)

def selectivity_index(lc50, ic50):
    return lc50 / ic50

def build(found):
    method = ["- 实验名称：GL9、GL392、mGL392、达沙替尼、槲皮素、帕博西尼。"]
    missing = [
        "Supplementary Note 3 的标题写着 IC50，表身是各浓度存活百分比，以及 Dunnett 的 Mean Diff、置信区间、Adjusted P、n1、n2。没有拟合后的 IC50 列，也没有 LC50 点估计列。图注里的 LC50 是大于号下界，不用来填这个人的 LC50。",
        (
            f"小鼠实验用量是帕博西尼 {PALBOCICLIB_MG_PER_MOUSE:g} mg/只、"
            f"mGL392 {MGL392_MG_PER_MOUSE:g} mg/只、"
            f"达沙替尼 {DASATINIB_MG_PER_MOUSE:g} mg/只、"
            f"槲皮素 {QUERCETIN_MG_PER_MOUSE:g} mg/只。"
            "这些是每只小鼠的实验用量，不是给你的用法。"
        ),
    ]
    ic50 = as_float(lookup(found, "ic50", "IC50"))
    lc50 = as_float(lookup(found, "lc50", "LC50"))
    if ic50 is None or lc50 is None:
        method.insert(0, "- 这次没有算出选择性指数。")
        missing.insert(0, "选择性指数缺 ic50 或 lc50。没有的浓度不用 0 去填。")
    elif ic50 <= 0 or lc50 <= 0:
        method.insert(0, "- 浓度不是正数，不算选择性指数。")
    else:
        method.insert(0, f"- 选择性指数是 {fmt(selectivity_index(lc50, ic50))}。这是 LC50 除以 IC50。")
    return method, missing

def render(meds, labs, rows, age):
    found, _genes = measurements(rows)
    method, missing = build(found)
    intro = "能算的是你交来的 LC50 除以 IC50。不能算的是从存活百分比去拟合半数浓度。"
    return finish("# 脂褐素导向的清除平台", intro, method, missing, meds, ALIASES, labs, age)

def report(out, medications, labs, measurements_path, age=None):
    text = render(load_meds(medications), labs, read_rows(measurements_path), age)
    return write_report(out, text)

def main():
    parser = argparse.ArgumentParser()
    add_args(parser)
    args = parser.parse_args()
    print(report(args.out, args.medications, args.labs, args.measurements, args.age))

if __name__ == "__main__":
    main()
