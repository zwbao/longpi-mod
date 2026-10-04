#!/usr/bin/env python3
"""NHEJ reporter frequency and the paper's transformation combinations."""

from __future__ import annotations

import csv
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import (
    BOUNDARY,
    HITS_BOWHEAD_AGAR,
    HITS_BOWHEAD_CRISPR,
    HITS_HUMAN,
)

TITLE = "# 弓头鲸修复读出"


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
    if "name" in fields and "value" in fields:
        for row in rows:
            key = (row.get(fields["name"]) or "").strip()
            if key:
                out[key] = (row.get(fields["value"]) or "").strip()
        return out
    if "item" in fields and "value" in fields:
        for row in rows:
            key = (row.get(fields["item"]) or "").strip()
            if key:
                out[key] = (row.get(fields["value"]) or "").strip()
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


def species_kind(text):
    if text is None:
        return None
    token = text.strip().casefold().replace("_", " ")
    if token in {"human", "homo sapiens", "人"}:
        return "human"
    if token in {"bowhead", "bowhead whale", "balaena mysticetus", "balaena", "弓头鲸"}:
        return "bowhead"
    return None


def nhej_frequency(gfp, dsred):
    if dsred == 0:
        return None
    return gfp / dsred


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
        if name.casefold() in known:
            lines.append(f"- {name}：这个名字出现在名单里。不能据此停。")
        else:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def list_names(items):
    names = []
    for item in items:
        names.append(item.split("：", 1)[0].lstrip("- ").strip())
    return names


def method_items(kv):
    computed = []
    missing = []
    kind = species_kind(pick(kv, "species", "物种"))
    gfp = as_float(pick(kv, "gfp", "gfp_positive", "GFP"))
    dsred = as_float(pick(kv, "dsred", "dsred_positive", "DsRed"))
    cirbp = pick(kv, "cirbp", "CIRBP")
    if gfp is not None and dsred is not None:
        if dsred == 0:
            missing.append("DsRed 阳性是 0，不能做 Fig. 4 的除法。")
        else:
            computed.append(f"非同源末端连接频率：{fmt(nhej_frequency(gfp, dsred))}")
    elif gfp is not None or dsred is not None:
        missing.append("缺 GFP 阳性或 DsRed 阳性其中一列，不算连接频率。")
    else:
        missing.append("缺 GFP 阳性和 DsRed 阳性两列，不算连接频率。")
    if kind == "human":
        computed.append("人成纤维细胞转化组合：" + "、".join(HITS_HUMAN))
    elif kind == "bowhead":
        computed.append("弓头鲸软琼脂组合：" + "、".join(HITS_BOWHEAD_AGAR))
        computed.append("弓头鲸 CRISPR 组合：" + "、".join(HITS_BOWHEAD_CRISPR))
    else:
        missing.append("缺物种列。这篇只对照了人和弓头鲸成纤维细胞的转化组合。")
    if cirbp is not None:
        missing.append(
            "给了 CIRBP，但不能把它换成修复分数。缺把蛋白丰度映射到读出的系数列。"
        )
    else:
        missing.append("没有 CIRBP 系数列，不算 CIRBP 分数。")
    return computed, missing


def render(meds, labs, measurements):
    kv = load_kv(measurements)
    computed, missing = method_items(kv)
    lines = [TITLE, "", "## 能算的", ""]
    if computed:
        lines.extend(f"- {item}" for item in computed)
    else:
        lines.append("这次没有算完的读出。")
    lines.extend(["", "## 不能算的", ""])
    lines.extend(f"- {item}" for item in missing)
    listed = [f"- {item}" for item in computed] or ["- 没有进入方法名单的项目"]
    lines.extend(["", "## 方法算出的名单", "", *listed])
    names = []
    for item in computed:
        names.extend(part.strip() for part in item.replace("：", "、").split("、"))
    lines.extend(["", *medication_lines(meds, names)])
    lines.extend(["", *lab_lines(labs)])
    lines.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def _with_paper_card(text):
    if "## 论文卡片" in text:
        return text
    rows = text.splitlines()
    rest = rows[1:]
    while rest and rest[0] == "":
        rest = rest[1:]
    merged = [rows[0], "", *paper_card_lines(), "", *rest]
    return "\n".join(merged) + ("\n" if text.endswith("\n") else "")


def write_report(out, text):
    out.mkdir(parents=True, exist_ok=True)
    path = out / "report.md"
    path.write_text(_with_paper_card(text), encoding="utf-8")
    return path


def report(out, meds, labs, measurements, age=None):
    del age
    text = render(load_meds(meds), labs, measurements)
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


if __name__ == "__main__":
    main()
