#!/usr/bin/env python3
"""Personal readout. Published numbers live in presets.py."""

from __future__ import annotations

from paper_card import lines as paper_card_lines


import csv
from pathlib import Path

from presets import BOUNDARY


def read_rows(path):
    if path is None:
        return []
    with path.open(encoding="utf-8-sig", newline="") as handle:
        sample = handle.read(4096)
        handle.seek(0)
        if not sample.strip():
            return []
        dialect = csv.Sniffer().sniff(sample, delimiters=",\t")
        return list(csv.DictReader(handle, dialect=dialect))


def load_kv(path):
    rows = read_rows(path)
    out = {}
    if not rows:
        return out
    fields = {name.strip().lower(): name for name in rows[0].keys() if name}
    name_field = fields.get("item") or fields.get("marker") or fields.get("name") or fields.get("key")
    if name_field and "value" in fields:
        for row in rows:
            key = (row.get(name_field) or "").strip()
            if key:
                out[key] = (row.get(fields["value"]) or "").strip()
        return out
    if "gene" in fields:
        value_key = "value" if "value" in fields else ("expression" if "expression" in fields else None)
        for row in rows:
            key = (row.get(fields["gene"]) or "").strip()
            if key and value_key:
                out[key] = (row.get(fields[value_key]) or "").strip()
        return out
    if len(rows) == 1:
        return {key.strip(): (value or "").strip() for key, value in rows[0].items() if key}
    return out


def load_meds(path):
    if path is None:
        return []
    names = []
    for line in path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            names.append(text)
    return names


def lab_lines(path):
    rows = read_rows(path)
    lines = ["## 体检", ""]
    if not rows:
        lines.append("没有提供体检。体检不增删方法算出的名单。")
        return lines
    lines.append("下面照录体检数值。体检不增删方法算出的名单。")
    for row in rows:
        lowered = { (k or "").strip(): (v or "").strip() for k, v in row.items() }
        item = lowered.get("项目") or lowered.get("item") or ""
        value = lowered.get("结果") or lowered.get("value") or lowered.get("result") or ""
        unit = lowered.get("单位") or lowered.get("unit") or ""
        if item and value:
            suffix = f" {unit}" if unit else ""
            lines.append(f"- {item} {value}{suffix}")
        else:
            bits = [f"{key} {value}".strip() for key, value in lowered.items() if key and value]
            if bits:
                lines.append("- " + "，".join(bits))
    return lines


def medication_lines(meds, names):
    lines = ["## 你正在使用的药", ""]
    if not meds:
        lines.append("没有提供现用药。不能据此停。")
        return lines
    known = {name.casefold() for name in names}
    for name in meds:
        if name.casefold() in known:
            lines.append(f"- {name}：这个名字出现在名单里。不能据此停。")
        else:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def write_report(out, text):
    out.mkdir(parents=True, exist_ok=True)
    path = out / "report.md"
    if not text.endswith("\n"):
        text += "\n"
    path.write_text(_with_paper_card(text), encoding="utf-8")
    return path


def finish(lines):
    lines.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


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



SAMPLE_MEASUREMENTS = """item,value
lens_age,62
chronological_age,55
"""

TITLE = "# 晶状体年龄指数"

def list_names(kv):
    return ["晶状体年龄指数"]


def fast_cut_text(index):
    from presets import FAST_YEARS
    passed = [year for year in FAST_YEARS if index > year]
    if not passed:
        return "这次没有大于论文写出的快老化切点。"
    shown = "、".join(f"{year:g} 年" for year in passed)
    return f"这次大于论文写出的快老化切点：{shown}。"


def method_lines(kv, age, rows=None):
    del rows
    lens = as_float(kv.get("lens_age"))
    chrono = as_float(kv.get("chronological_age"))
    if chrono is None and age is not None:
        chrono = float(age)
    if lens is None or chrono is None:
        return "这次没有同时给出晶状体年龄和实足年龄，所以没有算出指数。", [
            "## 方法算出的名单",
            "",
            "- 晶状体年龄指数。这次没有算出。",
        ]
    index = lens - chrono
    if index > 0:
        direction = "偏快"
    elif index < 0:
        direction = "偏慢"
    else:
        direction = "与实足年龄相同"
    cut = fast_cut_text(index)
    intro = f"这次用晶状体年龄减去实足年龄，指数是 {index:.2f} 年，相对同龄人{direction}。{cut}"
    lines = [
        "## 方法算出的名单",
        "",
        f"- 晶状体年龄指数 {index:.2f} 年（{direction}）",
        f"- {cut}",
    ]
    return intro, lines


def extra_checks(text):
    from presets import AUC_DIFFUSE, FAST_YEARS, MAE_HIGH, MAE_LOW
    assert MAE_LOW == 4.25 and MAE_HIGH == 4.82
    assert FAST_YEARS == (5, 10, 20)
    assert AUC_DIFFUSE == 0.621
    assert "7.00" in text
    assert "大于论文写出的快老化切点：5 年" in text
    assert "4.25" not in text
    assert "0.621" not in text


def render(age, meds, labs, measurements):
    kv = load_kv(measurements)
    rows = read_rows(measurements)
    intro, listed = method_lines(kv, age, rows)
    lines = [TITLE, "", intro, ""]
    lines.extend(listed)
    lines.extend(["", *medication_lines(meds, list_names(kv))])
    lines.extend(["", *lab_lines(labs)])
    return finish(lines)


def report(out, meds, labs, measurements, age=None):
    text = render(age, load_meds(meds), labs, measurements)
    return write_report(out, text)


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--measurements", type=Path)
    parser.add_argument("--medications", type=Path)
    parser.add_argument("--labs", type=Path)
    parser.add_argument("--age", type=float)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    print(report(args.out, args.medications, args.labs, args.measurements, args.age))



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
