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
    if "item" in fields and "value" in fields:
        for row in rows:
            key = (row.get(fields["item"]) or "").strip()
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
disease,cad
prs,1.1
"""

TITLE = "# 多基因与肠道菌群"

DISEASE_ZH = {"cad": "冠心病", "t2d": "二型糖尿病", "ad": "阿尔茨海默病", "prostate": "前列腺癌"}


def disease_key(kv):
    raw = (kv.get("disease") or "").strip().lower()
    aliases = {
        "cad": "cad", "chd": "cad", "冠心病": "cad",
        "t2d": "t2d", "diabetes": "t2d", "糖尿病": "t2d",
        "ad": "ad", "alzheimer": "ad", "阿尔茨海默": "ad",
        "prostate": "prostate", "前列腺癌": "prostate",
    }
    return aliases.get(raw)


def list_names(kv):
    from presets import FACTORS
    key = disease_key(kv)
    if key is None:
        return []
    return [item[1] for item in FACTORS[key]]


def provided_map(kv, age):
    values = {
        "BL_AGE": age if age is not None else as_float(kv.get("age")),
        "BMI": as_float(kv.get("bmi")),
        "SYSTM": as_float(kv.get("sbp")),
        "DIASM": as_float(kv.get("dbp")),
        "KOL": as_float(kv.get("cholesterol")),
        "HDL": as_float(kv.get("hdl")),
        "TRIG": as_float(kv.get("trig")),
        "CURR_SMOKE": kv.get("smoking") or None,
        "exercise": kv.get("exercise") or None,
        "PREVAL_DIAB_GDM": kv.get("diabetes") or None,
        "PREVAL_DIAB_T2": kv.get("diabetes") or None,
        "MI_FAMILYHIST": kv.get("mi_family") or None,
        "DIAB_FAMILYHIST": kv.get("diab_family") or None,
        "CANC_FAMILYHIST": kv.get("cancer_family") or None,
        "ALKI2_FR02": as_float(kv.get("alcohol")),
        "PREVAL_STR_SAH_TIA": kv.get("stroke") or None,
        "PREVAL_MENTAL": kv.get("mental") or None,
    }
    return values


def _shown(value):
    if isinstance(value, str):
        return value
    return f"{value:g}"


def method_lines(kv, age, rows=None):
    del rows
    from presets import FACTORS
    key = disease_key(kv)
    if key is None:
        return "这次没有病种，所以没有对上因素名单。", [
            "## 方法算出的名单",
            "",
            "没有对上的病种。",
        ]
    factors = FACTORS[key]
    values = provided_map(kv, age)
    lines = [
        "## 方法算出的名单",
        "",
        f"下面是{DISEASE_ZH[key]}在论文里用到的常规因素。回归系数不在已读材料里，这些数没有换成发病概率。",
    ]
    for code, label in factors:
        value = values[code]
        if value is None or value == "":
            lines.append(f"- {label}。这份表没有给出。")
        else:
            lines.append(f"- {label}。你给了 {_shown(value)}。")
    prs = as_float(kv.get("prs"))
    gms = as_float(kv.get("microbiome_score"))
    if prs is None:
        lines.append("- 多基因分数。这份表没有给出。")
    else:
        lines.append(f"- 多基因分数。你给了 {prs:g}。")
    if gms is None:
        lines.append("- 菌群分数。这份表没有给出。")
    else:
        lines.append(f"- 菌群分数。你给了 {gms:g}。")
    if key == "prostate":
        lines.append("前列腺癌模型只在男性中拟合。")
    intro = "这次不能算出你的发病概率，因为回归系数不在已读材料里。"
    return intro, lines


def extra_checks(text):
    from presets import CSTAT
    assert CSTAT["cad"]["age"][0] == 0.719
    assert CSTAT["cad"]["age_prs"][0] == 0.766
    assert CSTAT["cad"]["crf_prs_gms"][0] == 0.794
    assert "0.766" not in text
    assert "体质指数" in text
    assert "发病概率" in text
    assert "0.794" not in text
    assert "333" not in text


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
