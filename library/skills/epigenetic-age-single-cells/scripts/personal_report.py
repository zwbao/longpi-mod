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



import math

SAMPLE_MEASUREMENTS = """item,value
chr15_85673573,1
chr2_164791899,1
chr14_18232282,1
chr8_120378626,1
chr9_119973353,1
chr8_125670104,0
chr3_51333355,1
chr9_85324737,0
"""

TITLE = "# 单细胞甲基化月龄"

def age_grid(min_age, max_age, step):
    n = int(round((max_age - min_age) / step))
    return [min_age + i * step for i in range(n + 1)]


def maximum_likelihood_age(records, min_age=-20, max_age=60, step=1, zero_rep=0.001, one_rep=0.999):
    """Same product-of-probabilities as scAge.compute_probabilities, first maximum kept."""
    best_age = None
    best_ll = None
    for age in age_grid(min_age, max_age, step):
        ll = 0.0
        for coef, intercept, met in records:
            p = coef * age + intercept
            if p >= 1:
                p = one_rep
            elif p <= 0:
                p = zero_rep
            if met == 1:
                ll += math.log(p)
            elif met == 0:
                ll += math.log(1.0 - p)
            else:
                raise ValueError("methylation must be 0 or 1")
        if best_ll is None or ll > best_ll:
            best_ll = ll
            best_age = age
    return round(float(best_age), 2)


def list_names(kv):
    from presets import REFERENCE
    return [row[0] for row in REFERENCE]


def method_lines(kv, age, rows=None):
    del age, rows
    from presets import AGE_STEP, MAX_AGE, MIN_AGE, ONE_MET, REFERENCE, ZERO_MET
    observed = []
    seen = []
    for chrom, _r, coef, intercept in REFERENCE:
        if chrom not in kv:
            continue
        met = as_float(kv[chrom])
        if met in (0.0, 1.0):
            observed.append((coef, intercept, int(met)))
            seen.append(chrom)
    lines = ["## 方法算出的名单", "", "下面的编号是甲基化位点，不是药。"]
    if not observed:
        lines.append("没有交上的位点。")
        return "这次没有这些位点的甲基化，所以没有算出月龄。", lines
    pred = maximum_likelihood_age(observed, MIN_AGE, MAX_AGE, AGE_STEP, ZERO_MET, ONE_MET)
    for chrom in seen:
        lines.append(f"- {chrom}")
    lines.append(f"最大似然月龄是 {pred:.2f} 个月。")
    intro = f"这次算出小鼠肝脏参照上的最大似然月龄，是 {pred:.2f} 个月。"
    return intro, lines


def extra_checks(text):
    from presets import REFERENCE
    assert REFERENCE[0][0] == "chr15_85673573"
    assert REFERENCE[0][2] == -0.023755180198680476
    assert maximum_likelihood_age([(-0.02, 0.5, 1)]) == -20
    assert maximum_likelihood_age([(-0.02, 0.5, 0)]) == 25
    from presets import AGE_STEP
    assert AGE_STEP == 0.1
    assert "最大似然月龄" in text
    assert "-18.40" in text
    assert "不是药" in text
    assert "743078" not in text
    assert "0.95" not in text
    assert "2.1" not in text


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
