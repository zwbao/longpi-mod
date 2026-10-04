#!/usr/bin/env python3
"""Personal readout. Published symbols and labels live in presets.py."""

from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import BOUNDARY, IAS, IFTA_MILD, IFTA_SEVERE

TITLE = "铁与纤维化衰老"
IAS_BY_KEY = {gene.casefold(): gene for gene in IAS}
UNSCORED = {
    "mriiron": "磁共振铁",
    "mri-iron": "磁共振铁",
    "血清铁": "血清铁",
    "serumorion": "血清铁",
    "serumiron": "血清铁",
    "铁蛋白": "血清铁蛋白",
    "serumferritin": "血清铁蛋白",
    "转铁蛋白": "血清转铁蛋白",
    "serumtransferrin": "血清转铁蛋白",
}


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
    name_key = fields.get("name") or fields.get("项目") or fields.get("基因") or fields.get("gene")
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


def norm_token(text: str) -> str:
    return re.sub(r"[\s_\-]+", "", text.strip().casefold())


def as_float(text: str):
    raw = str(text).strip().replace(",", "")
    match = re.match(r"^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?", raw)
    if not match:
        return None
    return float(match.group(0))


def ifta_label(value: str):
    number = as_float(value)
    if number is None or number != int(number):
        return None
    score = int(number)
    if score in (0, 1):
        return IFTA_MILD
    if score in (2, 3):
        return IFTA_SEVERE
    return None


def collect(pairs: list[tuple[str, str]]):
    genes = []
    ifta = None
    ifta_raw = None
    unscored = []
    for name, value in pairs:
        key = norm_token(name)
        if key in {"ifta", "ifta0-3", "间质纤维化"}:
            ifta_raw = value
            ifta = ifta_label(value)
            continue
        if key in UNSCORED or norm_token(name) in {norm_token(item) for item in ("MRI - iron", "MRI-iron", "serum ferritin", "serum iron", "serum transferrin")}:
            unscored.append(UNSCORED.get(key, name))
            continue
        if key in {"gene", "基因"}:
            symbol = value.strip()
        else:
            symbol = name.strip()
        hit = IAS_BY_KEY.get(symbol.casefold())
        if hit and hit not in genes:
            genes.append(hit)
    return genes, ifta, ifta_raw, unscored


def method_names(genes, ifta) -> list[str]:
    names = list(genes)
    if ifta:
        names.append(ifta)
    return names


def render(pairs, medications, labs, age) -> str:
    genes, ifta, ifta_raw, unscored = collect(pairs)
    names = method_names(genes, ifta)
    able = ["## 能算的", ""]
    if age is not None:
        able.append(f"记录的年龄是 {age} 岁。这次计算不用年龄。")
    if genes:
        able.append("对上的铁堆积基因按补充数据表里的拼写写入名单，不加权。")
    else:
        able.append("这次没有基因对上铁堆积基因表。")
    if ifta:
        able.append(f"IFTA {ifta_raw} 对应补充数据表里的 {ifta}。")
    elif ifta_raw is not None:
        able.append(f"IFTA 读数是 {ifta_raw}，不在 0 到 3 的整数记分里。")
    unable = ["## 不能算的", ""]
    unable.append("富集分缺权重列。补充数据表只有基因符号。")
    unable.append("磁共振铁缺界值列。表里的平均值行是队列汇总，不拿来划线。")
    unable.append("血清铁、铁蛋白和转铁蛋白缺界值列。")
    for item in unscored:
        unable.append(f"{item} 这次有读数，仍然缺界值列，不进入名单。")
    if ifta_raw is not None and ifta is None:
        unable.append("IFTA 缺 0 到 3 的整数分数，不能套用分组词。")
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
    parser = argparse.ArgumentParser(description="Iron fibrosis senescence readout")
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
