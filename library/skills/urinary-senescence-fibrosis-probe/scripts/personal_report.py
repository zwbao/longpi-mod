#!/usr/bin/env python3
"""Personal readout. The detection rule lives in presets.py."""

from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import (
    BOUNDARY,
    CLEAVABLE,
    CLEAVABLE_CORE,
    CONTROL,
    CONTROL_CORE,
    SD_MULTIPLIER,
)

TITLE = "尿液衰老探针"


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


def collect(pairs):
    values = {}
    peptide = None
    mmp7 = False
    for name, value in pairs:
        key = norm_token(name)
        if key in {"a414", "吸光度414", "absorbance414"}:
            values["a414"] = as_float(value)
        elif key in {"a652", "a652pers", "a652nms"}:
            values["a652"] = as_float(value)
        elif key in {"背景均值", "backgroundmean", "blankmean"}:
            values["mean"] = as_float(value)
        elif key in {"背景标准差", "backgroundsd", "blanksd"}:
            values["sd"] = as_float(value)
        elif key in {"a414背景均值", "a414backgroundmean"}:
            values["a414_mean"] = as_float(value)
        elif key in {"a414背景标准差", "a414backgroundsd"}:
            values["a414_sd"] = as_float(value)
        elif key in {"a652背景均值", "a652backgroundmean"}:
            values["a652_mean"] = as_float(value)
        elif key in {"a652背景标准差", "a652backgroundsd"}:
            values["a652_sd"] = as_float(value)
        elif key in {"peptide", "肽", "sequence", "序列"}:
            peptide = value
        elif key in {"mmp7", "mmp7nm", "基质金属蛋白酶"}:
            mmp7 = True
    return values, peptide, mmp7


def blank_for(values, assay):
    mean = values.get(f"{assay}_mean", values.get("mean"))
    sd = values.get(f"{assay}_sd", values.get("sd"))
    shared = f"{assay}_mean" not in values and f"{assay}_sd" not in values
    return mean, sd, shared


def judge(signal, mean, sd):
    if signal is None or mean is None or sd is None or sd < 0:
        return None
    lod = mean + SD_MULTIPLIER * sd
    return signal > lod, lod


def render(pairs, medications, labs, age) -> str:
    values, peptide, mmp7 = collect(pairs)
    names = []
    able = ["## 能算的", ""]
    unable = ["## 不能算的", ""]
    if age is not None:
        able.append(f"记录的年龄是 {age} 岁。这次计算不用年龄。")
    saw_signal = False
    for assay, label in (("a414", "合金测定"), ("a652", "过氧化物酶测定")):
        if assay not in values:
            continue
        saw_signal = True
        mean, sd, shared = blank_for(values, assay)
        judged = judge(values[assay], mean, sd)
        if judged is None:
            if mean is None:
                unable.append(f"{label}缺背景均值列。")
            if sd is None:
                unable.append(f"{label}缺背景标准差列。")
            if sd is not None and sd < 0:
                unable.append(f"{label}的背景标准差不能是负数。")
            continue
        above, lod = judged
        share = "，背景与另一套测定共用。" if shared and "a414" in values and "a652" in values else "。"
        if above:
            names.append(f"{label}高于检出限")
            able.append(f"{label}读数 {values[assay]:g}，检出限 {lod:g}，高于检出限{share}")
        else:
            names.append(f"{label}不超过检出限")
            able.append(f"{label}读数 {values[assay]:g}，检出限 {lod:g}，不超过检出限{share}")
    if not saw_signal:
        able.append("这次没有吸光度。")
        unable.append("检出判断缺吸光度列，以及背景均值列和背景标准差列。")
    if peptide:
        key = peptide_key(peptide)
        if key in {CLEAVABLE, CLEAVABLE_CORE}:
            names.append("可切开肽")
            able.append("肽序列对上方法里的可切开肽。")
        elif key in {CONTROL, CONTROL_CORE}:
            names.append("对照肽")
            able.append("肽序列对上方法里的对照肽。")
        else:
            unable.append("这条肽序列不是方法里的可切开肽或对照肽。")
    if mmp7:
        unable.append("基质金属蛋白酶浓度缺界值列，不划线。")
    else:
        unable.append("浓度划线缺界值列。源数据是各浓度下的吸光度，没有单独的界值。")
    if not names and saw_signal:
        pass
    listed = ["## 方法算出的名单", ""]
    if names:
        for name in names:
            listed.append(f"- {name}")
    else:
        listed.append("名单是空的。")
    if not able[2:]:
        able.append("这次没有可计算的读数。")
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
    parser = argparse.ArgumentParser(description="Urinary senescence probe readout")
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
