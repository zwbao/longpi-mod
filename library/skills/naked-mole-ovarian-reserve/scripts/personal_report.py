#!/usr/bin/env python3
"""Ovarian reserve from the published section-count formula."""

from __future__ import annotations

import csv
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import BOUNDARY, FACTORS, canonical_stage

TITLE = "# 裸鼹鼠卵巢储备"


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
    fields = {(name or "").strip().lower(): name for name in rows[0].keys() if name}
    key_field = "name" if "name" in fields else ("item" if "item" in fields else None)
    if key_field and "value" in fields:
        for row in rows:
            key = (row.get(fields[key_field]) or "").strip()
            if key:
                out[key] = (row.get(fields["value"]) or "").strip()
        return out
    if len(rows) == 1:
        return {key.strip(): (value or "").strip() for key, value in rows[0].items() if key}
    return out


def load_meds(path):
    if path is None:
        return []
    return [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip() and not line.startswith("#")]


def as_float(text):
    if text is None:
        return None
    raw = str(text).strip().replace(",", "")
    if raw == "":
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def fmt(value):
    return f"{value:.6g}"


def pick(kv, *keys):
    lowered = {key.casefold(): value for key, value in kv.items()}
    for key in keys:
        if key.casefold() in lowered:
            return lowered[key.casefold()]
    return None


def reserve(raw_count, sections_counted, total_sections, factor):
    return (raw_count / sections_counted) * total_sections / factor


def lab_lines(path):
    rows = read_rows(path)
    lines = ["## 体检", ""]
    if not rows:
        lines.append("没有提供体检。体检不增删方法算出的名单。")
        return lines
    lines.append("下面照录体检数值。体检不增删方法算出的名单。")
    for row in rows:
        lowered = {(k or "").strip(): (v or "").strip() for k, v in row.items()}
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
        tail = "这个名字出现在名单里" if name.casefold() in known else "名单里没有这个名字"
        lines.append(f"- {name}：{tail}。不能据此停。")
    return lines


def method_items(kv):
    computed = []
    missing = []
    stage = canonical_stage(pick(kv, "stage", "日龄", "阶段"))
    raw_count = as_float(pick(kv, "raw_count", "count", "计数"))
    counted = as_float(pick(kv, "sections_counted", "所计切片数"))
    total = as_float(pick(kv, "total_sections", "总切片数"))
    if stage == "p15":
        missing.append("正文没有给出 P15 的校正因子。Supplementary Data 19 是各只动物的总数，没有单独的 P15 校正因子列。")
    elif stage is None:
        missing.append("缺能对上的日龄阶段，不能选取校正因子。")
    elif stage not in FACTORS:
        missing.append("这个日龄没有校正因子列。")
    else:
        factor = FACTORS[stage]
        if None in (raw_count, counted, total):
            missing.append("缺计数、所计切片数或总切片数。")
        elif counted == 0:
            missing.append("所计切片数是 0，不能做除法。")
        else:
            value = reserve(raw_count, counted, total, factor)
            computed.append(f"卵巢储备：{fmt(value)}")
            computed.append(f"校正因子：{fmt(factor)}")
    missing.append("不把 Supplementary Data 19 里各只动物的计数当成这次的卵巢储备。")
    return computed, missing


def render(meds, labs, measurements):
    computed, missing = method_items(load_kv(measurements))
    lines = [TITLE, "", "## 能算的", ""]
    if computed:
        lines.extend(f"- {item}" for item in computed)
    else:
        lines.append("这次没有算完的读出。")
    lines.extend(["", "## 不能算的", ""])
    lines.extend(f"- {item}" for item in missing)
    listed = [f"- {item}" for item in computed] or ["- 没有进入方法名单的项目"]
    lines.extend(["", "## 方法算出的名单", "", *listed])
    names = [item.split("：", 1)[0] for item in computed]
    lines.extend(["", *medication_lines(meds, names), "", *lab_lines(labs), "", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def _with_paper_card(text):
    rows = text.splitlines()
    rest = rows[1:]
    while rest and rest[0] == "":
        rest = rest[1:]
    return "\n".join([rows[0], "", *paper_card_lines(), "", *rest]) + "\n"


def report(out, meds, labs, measurements, age=None):
    del age
    out.mkdir(parents=True, exist_ok=True)
    path = out / "report.md"
    path.write_text(_with_paper_card(render(load_meds(meds), labs, measurements)), encoding="utf-8")
    return path


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


if __name__ == "__main__":
    main()
