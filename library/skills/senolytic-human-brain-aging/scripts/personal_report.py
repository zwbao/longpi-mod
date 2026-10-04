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
    ABT737_ORGANOID_UM,
    ALIASES,
    DASATINIB_MOUSE_MG_PER_KG,
    DASATINIB_ORGANOID_UM,
    FISETIN_MOUSE_MG_PER_KG,
    NAVITOCLAX_MOUSE_MG_PER_KG,
    NAVITOCLAX_ORGANOID_UM,
    QUERCETIN_MOUSE_MG_PER_KG,
    QUERCETIN_ORGANOID_UM,
)

def rank_score(p_value, logfc):
    if logfc > 0:
        sign = 1
    elif logfc < 0:
        sign = -1
    else:
        sign = 0
    return -p_value * sign

def gene_pairs(found, genes):
    paired = []
    seen = []
    for keys in genes:
        gene = keys.get("gene") or keys.get("symbol")
        p_value = as_float(keys.get("p") or keys.get("pvalue") or keys.get("p_value"))
        logfc = as_float(keys.get("logfc") or keys.get("log2fc") or keys.get("lfc"))
        paired.append((gene, p_value, logfc))
        seen.append(norm(gene))
    names = []
    for key in found:
        if key.endswith("p") and not key.endswith("logfc"):
            stem = key[:-1]
            if stem and stem not in names:
                names.append(stem)
        if key.endswith("logfc"):
            stem = key[: -len("logfc")]
            if stem and stem not in names:
                names.append(stem)
    for stem in names:
        if stem in seen:
            continue
        p_value = as_float(found.get(stem + "p"))
        logfc = as_float(found.get(stem + "logfc"))
        paired.append((stem, p_value, logfc))
    return paired

def build(found, genes):
    method = ["- 实验药物：纳维托克、ABT-737、达沙替尼、槲皮素、非瑟酮。"]
    missing = [
        "转录组年龄用的是另一篇文章里的时钟。本文没有位点权重列，缺的也不是 Supplementary Table 1 的 Primer、Target、Sequence，所以不算转录组年龄。",
        "通路富集缺 HALLMARK 基因集和 NES 列，不算富集分。",
        (
            f"类器官实验浓度是纳维托克 {NAVITOCLAX_ORGANOID_UM:g} μM、"
            f"ABT-737 {ABT737_ORGANOID_UM:g} μM、达沙替尼 {DASATINIB_ORGANOID_UM:g} μM、"
            f"槲皮素 {QUERCETIN_ORGANOID_UM:g} μM。"
            f"小鼠灌胃实验是纳维托克 {NAVITOCLAX_MOUSE_MG_PER_KG:g} mg/kg、"
            f"达沙替尼 {DASATINIB_MOUSE_MG_PER_KG:g} mg/kg、"
            f"槲皮素 {QUERCETIN_MOUSE_MG_PER_KG:g} mg/kg、"
            f"非瑟酮 {FISETIN_MOUSE_MG_PER_KG:g} mg/kg。"
            "这些是实验条件，不是给你的用法。"
        ),
    ]
    pairs = gene_pairs(found, genes)
    if not pairs:
        method.insert(0, "- 这次没有算出基因排序分。")
        missing.insert(0, "排序分缺基因的 P 和 logfc。没有的数不用 0 去填。")
        return method, missing
    scored = False
    for gene, p_value, logfc in pairs:
        label = gene or "未命名基因"
        if p_value is None or logfc is None:
            missing.append(f"{label} 缺 P 或 logfc，不算这一行的排序分。")
            continue
        score = rank_score(p_value, logfc)
        method.insert(0, f"- {label} 的排序分是 {fmt(score)}。这是 P 值取负再乘 logfc 的符号。")
        scored = True
    if not scored:
        method.insert(0, "- 这次没有算出基因排序分。")
    return method, missing

def render(meds, labs, rows, age):
    found, genes = measurements(rows)
    method, missing = build(found, genes)
    intro = "能算的是你交来的基因排序分，公式是负的 P 值乘 logfc 的符号。不能算的是转录组年龄。"
    return finish("# 衰老细胞清除与脑类器官", intro, method, missing, meds, ALIASES, labs, age)

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
