#!/usr/bin/env python3
"""Crypt substitution rate, and the published lifespan slope."""

from __future__ import annotations

import csv
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import BOUNDARY, ELB_K, canonical_species, species_table

TITLE = "# 哺乳动物体细胞突变率"


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
    raw = str(text).strip().replace("＋", "+").replace("－", "-").replace(",", "")
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


def per_year(count, age):
    if age == 0:
        return None
    return count / age


def model_rate(lifespan):
    if lifespan == 0:
        return None
    return ELB_K / lifespan


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
        hit = name.casefold() in known
        tail = "这个名字出现在名单里" if hit else "名单里没有这个名字"
        lines.append(f"- {name}：{tail}。不能据此停。")
    return lines


def method_items(kv, age_arg):
    computed = []
    missing = []
    burden = as_float(pick(kv, "substitution_burden", "substitutions", "替换数"))
    indels = as_float(pick(kv, "indel_burden", "indels", "插入缺失"))
    age = as_float(pick(kv, "age", "年龄"))
    if age is None:
        age = age_arg
    lifespan = as_float(pick(kv, "lifespan", "寿命"))
    species_text = pick(kv, "species", "物种")
    species = canonical_species(species_text) if species_text else None
    rate = None
    if burden is not None and age is not None:
        if age <= 0:
            missing.append("年龄不能用来做除法，不算隐窝年替换率。")
        else:
            rate = per_year(burden, age)
            computed.append(f"隐窝年替换率：{fmt(rate)}")
    elif burden is not None or (age is not None and species is None):
        missing.append("缺替换数或年龄，不算隐窝年替换率。")
    else:
        missing.append("缺替换数和年龄，不算隐窝年替换率。")
    if indels is not None and age is not None and age > 0:
        computed.append(f"隐窝年插入缺失：{fmt(per_year(indels, age))}")
        missing.append("插入缺失的年率可以相除。终生负担斜率 k 只对应替换，缺插入缺失的 k 列。")
    elif indels is not None:
        missing.append("给了插入缺失，但缺可用的年龄，不算年插入缺失。")
    row = species_table().get(species) if species else None
    if species_text and species is None:
        missing.append("这个物种名字对不上 Supplementary Table 3 的物种列。")
    elif species == "Harbour porpoise":
        missing.append("港湾鼠海豚在 Supplementary Table 3 没有年均替换率。正文写采样个体年龄未知。")
    elif row:
        computed.append(f"{species} 的表内年均替换率：{fmt(row['rate'])}")
        computed.append(f"{species} 的 Lifespan_80：{fmt(row['lifespan_80'])} 年")
        if lifespan is None:
            lifespan = row["lifespan_80"]
        computed.append(f"按斜率 {fmt(ELB_K)} 估计的年替换率：{fmt(model_rate(lifespan))}")
    elif species_text is None:
        missing.append("缺物种列，不能对照 Supplementary Table 3。")
    if rate is not None and lifespan is not None and lifespan > 0:
        computed.append(f"按这次年替换率乘寿命：{fmt(rate * lifespan)}")
    missing.append("不把物种回归的置信区间写成这个人的误差。")
    return computed, missing


def render(meds, labs, measurements, age):
    kv = load_kv(measurements)
    computed, missing = method_items(kv, age)
    lines = [TITLE, "", "## 能算的", ""]
    lines.extend(f"- {item}" for item in computed) if computed else lines.append("这次没有算完的读出。")
    lines.extend(["", "## 不能算的", ""])
    lines.extend(f"- {item}" for item in missing)
    listed = [f"- {item}" for item in computed] or ["- 没有进入方法名单的项目"]
    lines.extend(["", "## 方法算出的名单", "", *listed])
    names = [item.split("：", 1)[0] for item in computed]
    lines.extend(["", *medication_lines(meds, names)])
    lines.extend(["", *lab_lines(labs), "", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def _with_paper_card(text):
    rows = text.splitlines()
    rest = rows[1:]
    while rest and rest[0] == "":
        rest = rest[1:]
    return "\n".join([rows[0], "", *paper_card_lines(), "", *rest]) + "\n"


def report(out, meds, labs, measurements, age=None):
    out.mkdir(parents=True, exist_ok=True)
    path = out / "report.md"
    path.write_text(_with_paper_card(render(load_meds(meds), labs, measurements, age)), encoding="utf-8")
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
