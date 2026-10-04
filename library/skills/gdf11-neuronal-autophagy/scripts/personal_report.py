#!/usr/bin/env python3
"""Serum GDF11 readout. No classification threshold and no mouse dose."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import ALIASES, BOUNDARY, MARKER, TITLE


def read_rows(path: Path | None) -> list[dict[str, str]]:
    if path is None or not path.exists():
        return []
    text = path.read_text(encoding="utf-8-sig")
    if not text.strip():
        return []
    dialect = csv.Sniffer().sniff(text[:4096], delimiters=",\t")
    return list(csv.DictReader(text.splitlines(), dialect=dialect))


def load_meds(path: Path | None) -> list[str]:
    if path is None or not path.exists():
        return []
    names = []
    for line in path.read_text(encoding="utf-8").splitlines():
        item = line.strip()
        if item and not item.startswith("#"):
            names.append(item)
    return names


def norm(text: str) -> str:
    value = text.strip().casefold().replace(" ", "").replace("-", "").replace("_", "")
    for form in ("肠溶片", "缓释片", "咀嚼片", "分散片", "胶囊", "颗粒", "滴丸", "注射液", "片"):
        value = value.replace(form, "")
    return value


def as_float(text: str | None) -> float | None:
    if text is None:
        return None
    raw = str(text).strip().replace(",", "")
    if raw == "":
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def load_kv(path: Path | None) -> dict[str, str]:
    found = {}
    for row in read_rows(path):
        keys = {(k or "").strip().lower(): (v or "").strip() for k, v in row.items() if k}
        name = keys.get("name") or keys.get("item") or keys.get("项目") or keys.get("指标")
        value = keys.get("value") or keys.get("结果") or keys.get("值")
        if name and value is not None:
            found[norm(name)] = value
    return found


def serum_value(kv: dict[str, str]) -> float | None:
    for key in ("serumgdf11pgml", "gdf11", "血清gdf11", "血清生长分化因子"):
        if key in kv:
            return as_float(kv[key])
    return None


def lab_lines(path: Path | None) -> list[str]:
    rows = read_rows(path)
    lines = ["## 体检", ""]
    if not rows:
        lines.append("没有提供体检。体检不增删方法算出的名单。")
        return lines
    lines.append("下面照录体检数值。体检不增删方法算出的名单。")
    for row in rows:
        lowered = {(k or "").strip(): (v or "").strip() for k, v in row.items()}
        item = lowered.get("项目") or lowered.get("item") or lowered.get("name")
        value = lowered.get("结果") or lowered.get("value") or lowered.get("result")
        unit = lowered.get("单位") or lowered.get("unit") or ""
        if item and value:
            suffix = f" {unit}" if unit else ""
            lines.append(f"- {item} {value}{suffix}")
    return lines


def medication_lines(meds: list[str]) -> list[str]:
    lines = ["## 你正在使用的药", ""]
    if not meds:
        lines.append("没有提供现用药。不能据此停。")
        return lines
    known = {norm(alias) for alias in ALIASES}
    known.add(norm(MARKER))
    for name in meds:
        token = norm(name)
        hit = token in known or any(len(alias) >= 3 and alias in token for alias in known)
        if hit:
            lines.append(f"- {name}：对应名单上的 {MARKER}。不能据此停。")
        else:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def method_lines(kv: dict[str, str]) -> list[str]:
    value = serum_value(kv)
    lines = ["## 方法算出的名单", ""]
    if value is None:
        lines.append(f"- {MARKER}。这次没有给出血清浓度。这是论文里的标志物，不是给你的剂量。")
    else:
        lines.append(f"- {MARKER}。你提供的血清浓度是 {value:g} pg/ml。这是论文里的标志物，不是给你的剂量。")
    return lines


def cannot_lines() -> list[str]:
    return [
        "## 不能算的",
        "",
        "没有把血清浓度分成抑郁或没有抑郁，因为论文没有给出判别阈值这一列。",
        "小鼠的注射方案没有写成用法。",
    ]


def render(meds: list[str], labs: Path | None, measurements: Path | None) -> str:
    kv = load_kv(measurements)
    lines = [TITLE, "", "这次只处理血清生长分化因子。", ""]
    lines.extend(method_lines(kv))
    lines.extend(["", *cannot_lines()])
    lines.extend(["", *medication_lines(meds)])
    lines.extend(["", *lab_lines(labs)])
    lines.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def _with_paper_card(text: str) -> str:
    if "## 论文卡片" in text:
        return text
    rows = text.splitlines()
    if not rows or not rows[0].startswith("# "):
        return text
    rest = rows[1:]
    while rest and rest[0] == "":
        rest = rest[1:]
    out = "\n".join([rows[0], "", *paper_card_lines(), "", *rest])
    if text.endswith("\n"):
        out += "\n"
    return out


def report(out: Path, meds: Path | None, labs: Path | None, measurements: Path | None, age: float | None = None) -> Path:
    del age
    out.mkdir(parents=True, exist_ok=True)
    path = out / "report.md"
    path.write_text(_with_paper_card(render(load_meds(meds), labs, measurements)), encoding="utf-8")
    return path


def main() -> None:
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
