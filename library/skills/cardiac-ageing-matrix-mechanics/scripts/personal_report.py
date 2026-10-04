#!/usr/bin/env python3
"""Personal readout. Published numbers live in presets.py."""

from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import (
    BOUNDARY,
    CONDITIONS,
    FC_HIGH,
    FC_LOW_DEN,
    FC_LOW_NUM,
    NATIVE_AGED_KPA,
    NATIVE_YOUNG_KPA,
    P_MAX,
    SCAFFOLD_SOFT_KPA,
    SCAFFOLD_STIFF_KPA,
)

TITLE = "心脏基质力学"
FC_LOW = FC_LOW_NUM / FC_LOW_DEN


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
    names = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            names.append(text)
    return names


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


def ecm_token(text: str):
    key = norm_token(text)
    if key in {"young", "y", "年轻", "青年"}:
        return "young"
    if key in {"aged", "old", "年老", "老年", "老化"}:
        return "aged"
    return None


def stiff_token(text: str):
    key = norm_token(text)
    if key in {"soft", "软"}:
        return "soft"
    if key in {"stiff", "硬"}:
        return "stiff"
    return None


def split_gene(name: str):
    lowered = name.strip()
    for suffix, kind in (
        ("_fold", "fc"),
        ("_fc", "fc"),
        ("_倍数", "fc"),
        ("_pvalue", "p"),
        ("_p值", "p"),
        ("_p", "p"),
    ):
        if lowered.casefold().endswith(suffix.casefold()):
            stem = lowered[: -len(suffix)].strip()
            return stem, kind
    return None, None


def collect(pairs: list[tuple[str, str]]):
    modulus = None
    ecm = None
    stiff = None
    folds = {}
    pvalues = {}
    for name, value in pairs:
        key = norm_token(name)
        if key in {"杨氏模量", "youngsmodulus", "youngsmoduluskpa", "ekpa", "modulus", "moduluskpa"}:
            modulus = as_float(value)
            continue
        if key in {"ecm", "ecmage", "基质", "基质年龄", "matrix"}:
            ecm = ecm_token(value)
            continue
        if key in {"stiffness", "刚度", "软硬"}:
            stiff = stiff_token(value)
            continue
        stem, kind = split_gene(name)
        if stem and kind == "fc":
            folds[stem] = as_float(value)
        elif stem and kind == "p":
            pvalues[stem] = as_float(value)
    return modulus, ecm, stiff, folds, pvalues


def method_names(ecm, stiff, folds, pvalues) -> list[str]:
    names = []
    if ecm and stiff:
        names.append(CONDITIONS[(ecm, stiff)])
    stems = sorted(set(folds) | set(pvalues), key=str.casefold)
    for stem in stems:
        fold = folds.get(stem)
        pvalue = pvalues.get(stem)
        if fold is None or pvalue is None:
            continue
        if pvalue < P_MAX and (fold > FC_HIGH or fold < FC_LOW):
            names.append(stem)
    return names


def render(pairs, medications, labs, age) -> str:
    modulus, ecm, stiff, folds, pvalues = collect(pairs)
    names = method_names(ecm, stiff, folds, pvalues)
    able = ["## 能算的", ""]
    if age is not None:
        able.append(f"记录的年龄是 {age} 岁。这次计算不用年龄。")
    if modulus is not None:
        able.append(
            f"杨氏模量 {modulus:g} kPa。与图 2e 年轻组织均值 {NATIVE_YOUNG_KPA:g} kPa 相差 {abs(modulus - NATIVE_YOUNG_KPA):g} kPa，"
            f"与年老组织均值 {NATIVE_AGED_KPA:g} kPa 相差 {abs(modulus - NATIVE_AGED_KPA):g} kPa。"
        )
        able.append(
            f"与图 2f 软支架均值 {SCAFFOLD_SOFT_KPA:g} kPa 相差 {abs(modulus - SCAFFOLD_SOFT_KPA):g} kPa，"
            f"与硬支架均值 {SCAFFOLD_STIFF_KPA:g} kPa 相差 {abs(modulus - SCAFFOLD_STIFF_KPA):g} kPa。"
        )
    else:
        able.append("这次没有给出杨氏模量，所以没有和已发表均值做差。")
    if ecm and stiff:
        able.append(f"基质年龄和软硬都有，支架名字是 {CONDITIONS[(ecm, stiff)]}。")
    unable = ["## 不能算的", ""]
    if modulus is None:
        unable.append("杨氏模量比较缺杨氏模量列，单位是 kPa。")
    if not (ecm and stiff):
        unable.append("支架名字缺基质年龄或软硬标签。两个都有才命名 SoftY、StiffY、SoftA、StiffA。")
    stems = sorted(set(folds) | set(pvalues), key=str.casefold)
    incomplete = False
    for stem in stems:
        if folds.get(stem) is None:
            unable.append(f"{stem} 缺倍数列。")
            incomplete = True
        if pvalues.get(stem) is None:
            unable.append(f"{stem} 缺 p 值列。")
            incomplete = True
    if not stems:
        unable.append("差异基因缺倍数列和 p 值列。")
    unable.append("蛋白质差异缺可点积的系数列。图上的原始点不是权重。")
    unable.append("论文给出的代码仓库是焦点粘附图像宏，不算这次的模量或基因。")
    if incomplete:
        unable.append("倍数和 p 值缺一的基因不进入名单。")
    listed = ["## 方法算出的名单", ""]
    if names:
        for name in names:
            listed.append(f"- {name}")
    else:
        listed.append("名单是空的。")
    meds = medication_lines(medications, names)
    lab = lab_section(labs)
    rows = [f"# {TITLE}", "", *paper_card_lines(), "", *able, "", *unable, "", *listed, "", *meds, "", *lab, "", f"边界: {BOUNDARY}"]
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
    parser = argparse.ArgumentParser(description="Cardiac matrix mechanics readout")
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
