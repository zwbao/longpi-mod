#!/usr/bin/env python3
"""Methylation age from Supplementary Table 20. Missing sites are not filled."""

from __future__ import annotations

import csv
import math
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import (
    BOUNDARY,
    CLOCKS,
    MATURITY_YEARS,
    MAX_LIFESPAN,
    OFFSET_K,
    canonical_species,
    canonical_tissue,
    models,
)

TITLE = "# 裸鼹鼠甲基化年龄"


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
    probe = fields.get("cg") or fields.get("probe")
    beta = fields.get("beta") or fields.get("value")
    if probe and beta and probe != beta:
        for row in rows:
            key = (row.get(probe) or "").strip()
            if key:
                out[key] = (row.get(beta) or "").strip()
        for extra in ("tissue", "species", "queen"):
            if extra in fields and extra not in {probe, beta}:
                out[extra] = (rows[0].get(fields[extra]) or "").strip()
        return out
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


def f_inverse(y, maturity=MATURITY_YEARS):
    if y < 0:
        return (maturity + OFFSET_K) * math.exp(y) - OFFSET_K
    return (maturity + OFFSET_K) * y + maturity


def relative_age(age, species):
    return age / MAX_LIFESPAN[species]


def beta_map(kv):
    found = {}
    for key, value in kv.items():
        token = key.strip()
        if not token.casefold().startswith("cg"):
            continue
        number = as_float(value)
        if number is None:
            continue
        found[token] = number
    return found


def predict(clock, betas):
    model = models()[clock]
    missing = [cg for cg in model["weights"] if cg not in betas]
    if missing or model["intercept"] is None:
        return None, missing
    outside = [cg for cg in model["weights"] if not 0.0 <= betas[cg] <= 1.0]
    if outside:
        return None, outside
    total = model["intercept"]
    for cg, coef in model["weights"].items():
        total += coef * betas[cg]
    if model["transform"] == "loglin":
        total = f_inverse(total)
    return total, []


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


def method_items(kv, age):
    computed = []
    missing = []
    species = canonical_species(pick(kv, "species", "物种"))
    if age is not None and species in MAX_LIFESPAN:
        computed.append(f"定义上的相对年龄：{fmt(relative_age(age, species))}")
    elif age is not None:
        missing.append("有年龄，但物种不是人或裸鼹鼠。缺这篇给出的最大寿命列。")
    tissue_text = pick(kv, "tissue", "组织")
    clock = canonical_tissue(tissue_text) if tissue_text else None
    betas = beta_map(kv)
    if tissue_text and clock is None:
        missing.append("这个组织对不上 Supplementary Table 20 的时钟列。")
    elif clock is None:
        missing.append("缺组织列，不算甲基化年龄。")
    else:
        column = CLOCKS[clock][1]
        label = models()[clock]["label"]
        outside = [cg for cg, value in betas.items() if cg in models()[clock]["weights"] and not 0.0 <= value <= 1.0]
        if outside:
            missing.append(f"{label} 有位点不在 0 到 1，不算甲基化年龄。")
        else:
            value, absent = predict(clock, betas)
            if value is None:
                example = "、".join(absent[:5])
                missing.append(
                    f"缺 {column} 对应的 beta 列，缺 {len(absent)} 个位点，例如 {example}。不把缺的位点补 0。"
                )
            else:
                unit = "相对年龄" if models()[clock]["transform"] == "relative" else "岁"
                computed.append(f"{label}：{fmt(value)} {unit}")
                if models()[clock]["transform"] == "relative" and species in MAX_LIFESPAN:
                    computed.append(f"相对年龄乘最大寿命：{fmt(value * MAX_LIFESPAN[species])} 岁")
                elif models()[clock]["transform"] == "relative":
                    missing.append("相对年龄时钟已算出比例。缺人或裸鼹鼠的最大寿命，不把它换成岁。")
    queen = pick(kv, "queen", "女王")
    if queen is not None and queen.strip().casefold() in {"1", "yes", "true", "是", "queen", "女王"}:
        missing.append("女王身份没有交互系数列。Supplementary Table 20 不能按女王身份改年龄。")
    else:
        missing.append("Supplementary Table 20 没有女王与年龄的交互系数列，不另作加减。")
    return computed, missing


def render(meds, labs, measurements, age):
    kv = load_kv(measurements)
    computed, missing = method_items(kv, age)
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
