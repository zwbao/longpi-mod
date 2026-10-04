#!/usr/bin/env python3
from __future__ import annotations

from paper_card import lines as paper_card_lines


import argparse
import csv
from pathlib import Path

from presets import BOUNDARY


def read_rows(path: Path | None) -> list[dict[str, str]]:
    if path is None or not path.exists():
        return []
    with path.open(encoding="utf-8-sig", newline="") as handle:
        sample = handle.read(4096)
        handle.seek(0)
        if not sample.strip():
            return []
        dialect = csv.Sniffer().sniff(sample, delimiters=",\t")
        return list(csv.DictReader(handle, dialect=dialect))


def load_meds(path: Path | None) -> list[str]:
    if path is None or not path.exists():
        return []
    names = []
    for line in path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            names.append(text)
    return names


def as_float(text: str | None) -> float | None:
    if text is None:
        return None
    raw = str(text).strip().replace("＋", "+").replace("－", "-")
    if raw == "":
        return None
    try:
        return float(raw)
    except ValueError:
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
        else:
            bits = [f"{key} {val}".strip() for key, val in lowered.items() if key and val]
            if bits:
                lines.append("- " + "，".join(bits))
    return lines


def medication_lines(meds: list[str], known: set[str]) -> list[str]:
    lines = ["## 你正在使用的药", ""]
    if not meds:
        lines.append("没有提供现用药。")
        return lines
    folded = {name.casefold() for name in known}
    for name in meds:
        if name.casefold() in folded:
            lines.append(f"- {name}：这个名字出现在方法名单里。不能据此停。")
        else:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def finish(lines: list[str]) -> str:
    lines.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def write_report(out: Path, text: str) -> Path:
    out.mkdir(parents=True, exist_ok=True)
    path = out / "report.md"
    path.write_text(_with_paper_card(text if text.endswith("\n") else text + "\n"), encoding="utf-8")
    return path



from presets import MAE_YEARS, UNDERPOWERED_BELOW, age_gap


TISSUE_ZH = {
    "liver": "肝",
    "heart": "心脏",
    "lung": "肺",
    "kidney": "肾",
    "brain": "脑",
    "skin": "皮肤",
    "muscle": "肌肉",
    "adipose": "脂肪",
    "spleen": "脾",
    "pancreas": "胰腺",
}


def tissue_name(raw: str) -> str:
    return TISSUE_ZH.get(raw.casefold(), raw)


def tissues(rows, age_arg=None):
    found = []
    bag = {}
    for row in rows:
        low = {(k or "").strip().lower(): (v or "").strip() for k, v in row.items() if k}
        tissue = low.get("tissue")
        predicted = as_float(low.get("predicted"))
        age = as_float(low.get("age"))
        n_samples = as_float(low.get("n_samples"))
        if tissue and predicted is not None and age is not None:
            found.append((tissue_name(tissue), age_gap(predicted, age), n_samples))
            continue
        item = low.get("item") or low.get("marker") or low.get("name") or ""
        if item and "value" in low and not tissue:
            bag[item.lower()] = low.get("value") or ""
    if age_arg is not None:
        for tissue in TISSUE_ZH:
            raw = bag.get(tissue) or bag.get(f"{tissue}_predicted")
            pred = as_float(raw) if raw else None
            if pred is not None:
                found.append((tissue_name(tissue), age_gap(pred, float(age_arg)), None))
    return found


def opening(rows, age_arg=None):
    found = tissues(rows, age_arg)
    if not found:
        return "配套源码里没有拟合好的切片权重。这次也没有同时提供组织的预测年龄和实足年龄，所以没有算出年龄差。"
    bits = [f"{tissue} 的预测年龄减去实足年龄是 {gap:.1f} 年" for tissue, gap, _n in found]
    text = "这次算出" + "，".join(bits) + f"。论文里全部组织的平均绝对误差是 {MAE_YEARS} 年，那是队列误差，不是给你画的线。切片权重没有重新套用，这次用的是你给出的预测年龄。"
    if any(n is not None and n < UNDERPOWERED_BELOW for _tissue, _gap, n in found):
        text += "标了样本量、并且低于论文界线的组织，在原文里会被视为功效不足。"
    return text


def method_lines(rows, age_arg=None):
    found = tissues(rows, age_arg)
    lines = ["## 方法算出的名单", ""]
    if not found:
        lines.append("- 组织年龄差：这次没有算出。")
        return lines
    for tissue, gap, _n in found:
        lines.append(f"- {tissue}：预测年龄减去实足年龄是 {gap:.1f} 年。")
    return lines


def known_names(rows):
    return {tissue for tissue, _gap, _n in tissues(rows)}


def render(meds, labs, rows, age_arg=None):
    lines = ["# 组织切片年龄差", "", opening(rows, age_arg), ""]
    lines.extend(method_lines(rows, age_arg))
    lines.extend(["", *medication_lines(meds, known_names(rows))])
    lines.extend(["", *lab_lines(labs)])
    return finish(lines)


def report(out, meds, labs, measurements, age=None):
    return write_report(out, render(load_meds(meds), labs, read_rows(measurements), age))


def main():
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
