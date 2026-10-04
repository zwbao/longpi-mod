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

from presets import ALIASES, FLY_FOOD_UM, MOUSE_EARLY_PPM, MOUSE_LATE_PPM

def turnover_ratio(gfp_area, total_area):
    return gfp_area / total_area

def build(found):
    method = ["- 实验药物：雷帕霉素。"]
    missing = [
        "寿命表在 Supplementary Tables 1–9。打开后的列是 median、mean、log-rank p 和 Cox 的 Risk Ratio。没有这个人的生存时间列，不算风险比。",
        f"果蝇食物实验浓度是 {FLY_FOOD_UM:g} μM。小鼠饲料实验浓度是早期 {MOUSE_EARLY_PPM:g} ppm，较晚的类器官实验是 {MOUSE_LATE_PPM:g} ppm。这些是论文里的实验条件，不是给你的用法。",
    ]
    gfp = as_float(lookup(found, "gfp_area", "gfp", "绿色荧光面积"))
    total = as_float(lookup(found, "total_area", "gut_area", "肠面积"))
    if gfp is None or total is None:
        method.insert(0, "- 这次没有算出肠上皮更新比例。")
        missing.insert(0, "肠上皮更新比例缺 gfp_area 或 total_area。没有的面积不用 0 去填。")
    elif gfp <= 0 or total <= 0:
        method.insert(0, "- 面积不是正数，不算肠上皮更新比例。")
    else:
        ratio = turnover_ratio(gfp, total)
        method.insert(0, f"- 肠上皮更新比例是 {fmt(ratio)}。这是绿色荧光面积除以对应肠段总面积。")
    diffuse = as_float(lookup(found, "diffuse_count", "弥漫溶菌酶细胞数"))
    paneth = as_float(lookup(found, "paneth_count", "帕内特细胞数"))
    if diffuse is None or paneth is None:
        missing.append("弥漫溶菌酶比例缺 diffuse_count 或 paneth_count。没有的计数不用 0 去填。")
    elif diffuse < 0 or paneth <= 0:
        method.append("- 帕内特细胞计数不是正数，不算弥漫溶菌酶比例。")
    else:
        method.append(f"- 弥漫溶菌酶比例是 {fmt(diffuse / paneth)}。")
    return method, missing

def render(meds, labs, rows, age):
    found, _genes = measurements(rows)
    method, missing = build(found)
    intro = "能算的是你交来的肠段面积之比。不能算的是队列寿命表上的风险比，因为缺这个人的生存时间列。"
    text = finish("# 短暂雷帕霉素与肠自噬", intro, method, missing, meds, ALIASES, labs, age)
    return text

def report(out, medications, labs, measurements_path, age=None):
    text = render(load_meds(medications), labs, read_rows(measurements_path), age)
    return write_report(out, text)

def main():
    parser = argparse.ArgumentParser()
    add_args(parser)
    args = parser.parse_args()
    path = report(args.out, args.medications, args.labs, args.measurements, args.age)
    print(path)

if __name__ == "__main__":
    main()
