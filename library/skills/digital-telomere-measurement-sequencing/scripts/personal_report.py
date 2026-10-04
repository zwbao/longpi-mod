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



import statistics

SAMPLE_MEASUREMENTS = """item,value
lengths,1;2;3;4;5
"""

TITLE = "# 端粒长度分布"

def collect_lengths(kv, rows):
    vals = []
    raw = kv.get("lengths") or ""
    for part in raw.replace(",", ";").split(";"):
        number = as_float(part)
        if number is not None:
            vals.append(number)
    if vals:
        return vals
    for row in rows or []:
        for key, value in row.items():
            if key and key.strip().lower() in {"telomere_length", "length_bp"}:
                number = as_float(value)
                if number is not None:
                    vals.append(number)
    return vals


def summarize(lengths):
    ordered = sorted(lengths)
    q1, _q2, q3 = statistics.quantiles(ordered, n=4, method="inclusive")
    return {
        "min": ordered[0],
        "q1": q1,
        "median": statistics.median(ordered),
        "mean": statistics.fmean(ordered),
        "q3": q3,
        "max": ordered[-1],
    }


def list_names(kv):
    return ["最小值", "下四分位", "中位数", "平均数", "上四分位", "最大值"]


def age_group(age):
    if age is None:
        return None
    if 18 <= age <= 20:
        return "年轻组"
    if 35 <= age <= 65:
        return "中年组"
    if age > 70:
        return "老年组"
    return None


def method_lines(kv, age, rows=None):
    lengths = collect_lengths(kv, rows)
    if len(lengths) < 2:
        return "这次没有至少两条端粒长度，所以没有算出分布。", [
            "## 方法算出的名单",
            "",
            "没有算出概括数。",
        ]
    stats = summarize(lengths)
    intro = f"这次从端粒长度算出六个概括数，中位数是 {stats['median']:g}。"
    group = age_group(age)
    if group:
        intro += f"年龄落在论文里的{group}。"
    lines = [
        "## 方法算出的名单",
        "",
        f"- 最小值 {stats['min']:g}",
        f"- 下四分位 {stats['q1']:g}",
        f"- 中位数 {stats['median']:g}",
        f"- 平均数 {stats['mean']:g}",
        f"- 上四分位 {stats['q3']:g}",
        f"- 最大值 {stats['max']:g}",
    ]
    return intro, lines


def extra_checks(text):
    stats = summarize([1, 2, 3, 4, 5])
    assert stats["median"] == 3
    assert stats["mean"] == 3
    assert "中位数 3" in text
    assert "0.95" not in text
    from presets import AUC_SYMPTOMATIC, YOUNG_N, MIDDLE_N, ELDER_N, N_HEALTHY
    assert AUC_SYMPTOMATIC == 0.95
    assert YOUNG_N + MIDDLE_N + ELDER_N == N_HEALTHY == 14


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
