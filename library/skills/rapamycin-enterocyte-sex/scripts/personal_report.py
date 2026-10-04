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

from presets import ALIASES, FLY_DOSES_UM, MOUSE_MG_PER_KG

def size_ratio(treated, control):
    return treated / control

def p62_ratio(p62, total_protein):
    return p62 / total_protein

def sex_label(raw):
    token = norm(raw or "")
    if token in ("female", "f", "女", "雌", "雌性"):
        return "雌"
    if token in ("male", "m", "男", "雄", "雄性"):
        return "雄"
    return None

def build(found):
    method = ["- 实验药物：雷帕霉素。"]
    doses = "、".join(f"{dose:g}" for dose in FLY_DOSES_UM)
    missing = [
        "Supplementary Table 1 的 Cox 列是 Coefficient、exp(coeff)、SE、z、p。没有这个人的生存时间列，不算风险比。",
        f"果蝇食物实验浓度是 {doses} μM。小鼠方法写的是 {MOUSE_MG_PER_KG:g} mg/kg 体重。这些是实验条件，不是给你的用法。",
    ]
    control = as_float(lookup(found, "control_area", "对照面积"))
    treated = as_float(lookup(found, "treated_area", "处理面积"))
    if control is None or treated is None:
        method.insert(0, "- 这次没有算出肠细胞面积比。")
        missing.insert(0, "肠细胞面积比缺 control_area 或 treated_area。没有的面积不用 0 去填。")
    elif control <= 0 or treated <= 0:
        method.insert(0, "- 面积不是正数，不算肠细胞面积比。")
    else:
        method.insert(0, f"- 肠细胞面积比是 {fmt(size_ratio(treated, control))}。这是处理后面积除以对照面积。")
    p62 = as_float(lookup(found, "p62", "sqstm1"))
    total = as_float(lookup(found, "total_protein", "总蛋白"))
    if p62 is None or total is None:
        missing.append("p62 比总蛋白缺 p62 或 total_protein。没有的条带不用 0 去填。")
    elif total <= 0:
        method.append("- 总蛋白不是正数，不算 p62 比总蛋白。")
    else:
        method.append(f"- p62 比总蛋白是 {fmt(p62_ratio(p62, total))}。")
    sex_raw = lookup(found, "sex", "性别")
    if sex_raw is None:
        missing.append("缺 sex 列，不按雌雄写自噬方向。")
    else:
        label = sex_label(sex_raw)
        if label == "雌":
            method.append("- 你交来的肠细胞性别是雌。论文写雌性肠细胞经 H3/H4–Bchs 升高自噬。")
        elif label == "雄":
            method.append("- 你交来的肠细胞性别是雄。论文写雄性基础自噬较高，喂雷帕霉素不再升高。")
        else:
            method.append("- 性别写法对不上雌或雄，不套论文的方向。")
    return method, missing

def render(meds, labs, rows, age):
    found, _genes = measurements(rows)
    method, missing = build(found)
    intro = "能算的是肠细胞面积比、p62 比总蛋白，以及你交来的雌雄方向。不能算的是队列 Cox 风险比。"
    return finish("# 肠细胞性别与雷帕霉素", intro, method, missing, meds, ALIASES, labs, age)

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
