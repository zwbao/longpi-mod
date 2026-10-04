#!/usr/bin/env python3
"""Personal readout. Published cutoffs and sequences live in presets.py."""

from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import (
    BOUNDARY,
    COLLAGEN_PEPTIDE,
    E_HEXAMER,
    E_MOTIF,
    HIGH_PG_ML,
    NORMAL_HIGH_PG_ML,
    NORMAL_LOW_PG_ML,
    POLY_AK,
    SCRAMBLED,
)

TITLE = "弹性蛋白片段"
PEPTIDES = (
    (E_MOTIF, "方法里的 E-motif"),
    (E_HEXAMER, "摘要里的 VGVAPG"),
    (SCRAMBLED, "打乱肽"),
    (POLY_AK, "多聚序列"),
    (COLLAGEN_PEPTIDE, "胶原肽"),
)


def load_pairs(path: Path | None) -> list[tuple[str, str]]:
    if path is None:
        return []
    text = path.read_text(encoding="utf-8-sig", errors="replace").strip()
    if not text:
        return []
    rows = list(csv.DictReader(text.splitlines()))
    if not rows:
        return []
    fields = {name.strip().lower(): name for name in rows[0] if name}
    name_key = fields.get("name") or fields.get("项目") or fields.get("指标")
    value_key = fields.get("value") or fields.get("结果") or fields.get("值")
    if name_key is None or value_key is None:
        raise ValueError("measurements file needs name,value columns")
    found = []
    for row in rows:
        name = (row.get(name_key) or "").strip()
        value = (row.get(value_key) or "").strip()
        if name:
            found.append((name, value))
    return found


def load_lines(path: Path | None) -> list[str]:
    if path is None:
        return []
    return [line.strip() for line in path.read_text(encoding="utf-8", errors="replace").splitlines() if line.strip() and not line.strip().startswith("#")]


def load_labs(path: Path | None) -> list[tuple[str, str, str]]:
    if path is None:
        return []
    text = path.read_text(encoding="utf-8-sig", errors="replace").strip()
    if not text:
        return []
    rows = list(csv.DictReader(text.splitlines()))
    if not rows:
        return []
    fields = {name.strip(): name for name in rows[0] if name}
    item_key = fields.get("项目") or fields.get("item") or fields.get("name")
    value_key = fields.get("结果") or fields.get("value") or fields.get("result")
    unit_key = fields.get("单位") or fields.get("unit")
    parsed = []
    for row in rows:
        item = (row.get(item_key, "") if item_key else "").strip()
        value = (row.get(value_key, "") if value_key else "").strip()
        unit = (row.get(unit_key, "") if unit_key else "").strip()
        if item and value:
            parsed.append((item, value, unit))
    return parsed


def as_float(text: str):
    raw = str(text).strip().replace(",", "")
    match = re.match(r"^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?", raw)
    if not match:
        return None
    return float(match.group(0))


def norm_token(text: str) -> str:
    return re.sub(r"[\s_\-]+", "", text.strip().casefold())


def peptide_key(text: str) -> str:
    return re.sub(r"[^A-Za-z]", "", text).upper()


def group_for(value: float):
    if value >= HIGH_PG_ML:
        return "高弹性蛋白片段组"
    if NORMAL_LOW_PG_ML <= value <= NORMAL_HIGH_PG_ML:
        return "正常弹性蛋白片段组"
    return None


def collect(pairs):
    eln = None
    others = []
    peptides = []
    for name, value in pairs:
        key = norm_token(name)
        if key in {"eln", "弹性蛋白片段", "elnpgml", "serumeln", "elnfragments"}:
            eln = as_float(value)
            continue
        if key in {"ha", "透明质酸", "透明质酸片段", "fn", "纤连蛋白", "纤连蛋白片段", "col", "胶原", "胶原片段"}:
            others.append(name)
            continue
        if key in {"peptide", "肽", "sequence", "序列"}:
            peptides.append(value)
    return eln, others, peptides


def peptide_hits(sequences):
    hits = []
    for raw in sequences:
        key = peptide_key(raw)
        matched = None
        for sequence, label in PEPTIDES:
            if key == sequence:
                matched = label
                break
        if matched:
            hits.append(f"{raw}（{matched}）")
        else:
            hits.append(None)
    return hits


def render(pairs, medications, labs, age) -> str:
    eln, others, peptides = collect(pairs)
    hits = peptide_hits(peptides)
    names = []
    able = ["## 能算的", ""]
    if age is not None:
        able.append(f"记录的年龄是 {age} 岁。分组不用年龄。")
    if eln is None:
        able.append("这次没有弹性蛋白片段浓度。")
    else:
        label = group_for(eln)
        if label:
            names.append(label)
            able.append(f"弹性蛋白片段 {eln:g} pg/ml，落入{label}。")
        else:
            able.append(f"弹性蛋白片段 {eln:g} pg/ml，不在正文定义的高组或正常组。")
            names.append("不在高组或正常组")
    for raw, hit in zip(peptides, hits):
        if hit:
            names.append(hit)
            able.append(f"肽序列对上了正文：{hit}。")
        else:
            able.append(f"肽序列 {raw} 没有对上正文写出的序列。")
    unable = ["## 不能算的", ""]
    if eln is None:
        unable.append("分组缺弹性蛋白片段列，单位按 pg/ml 读取。")
    unable.append("年龄回归缺斜率列和截距列。图的源数据只有年龄和浓度。")
    unable.append("标准化贝塔缺单独的系数列。")
    if others:
        unable.append("其他基质碎片缺分组界值列：" + "、".join(others) + "。")
    else:
        unable.append("透明质酸、纤连蛋白和胶原碎片缺分组界值列。")
    for raw, hit in zip(peptides, hits):
        if hit is None:
            unable.append(f"{raw} 不是正文列出的肽，不进入名单。")
    listed = ["## 方法算出的名单", ""]
    if names:
        for name in names:
            listed.append(f"- {name}")
    else:
        listed.append("名单是空的。")
    rows = [
        f"# {TITLE}",
        "",
        *paper_card_lines(),
        "",
        *able,
        "",
        *unable,
        "",
        *listed,
        "",
        *medication_lines(medications, names),
        "",
        *lab_section(labs),
        "",
        f"边界: {BOUNDARY}",
    ]
    return "\n".join(rows) + "\n"


def medication_lines(medications, names) -> list[str]:
    lines = ["## 你正在使用的药", ""]
    if not medications:
        lines.append("没有提供现用药。不能据此停。")
        return lines
    known = {name.casefold() for name in names}
    for name in medications:
        if name.casefold() in known:
            lines.append(f"- {name}：这个名字出现在名单里。不能据此停。")
        else:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def lab_section(labs) -> list[str]:
    lines = ["## 体检", ""]
    if not labs:
        lines.append("没有提供体检。体检不增删方法算出的名单。")
        return lines
    lines.append("下面照录体检数值。体检不增删方法算出的名单。")
    for item, value, unit in labs:
        suffix = f" {unit}" if unit else ""
        lines.append(f"- {item} {value}{suffix}")
    return lines


def method_section(text: str) -> str:
    start = text.index("## 方法算出的名单\n")
    end = text.index("\n## 你正在使用的药")
    return text[start:end]


def write_report(out_dir: Path, measurements: Path | None, medications: Path | None, labs: Path | None, age=None) -> Path:
    text = render(load_pairs(measurements), load_lines(medications), load_labs(labs), age)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "report.md"
    path.write_text(text, encoding="utf-8")
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Elastin fragment readout")
    parser.add_argument("--measurements", type=Path)
    parser.add_argument("--medications", type=Path)
    parser.add_argument("--labs", type=Path)
    parser.add_argument("--age", type=float)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    path = write_report(args.out, args.measurements, args.medications, args.labs, args.age)
    sys.stdout.write(str(path) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
