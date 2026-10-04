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



from presets import code_residual


def items(rows):
    out = {}
    for row in rows:
        low = {(k or "").strip().lower(): (v or "").strip() for k, v in row.items() if k}
        name = (low.get("item") or low.get("marker") or low.get("name") or "").lower()
        if name:
            out[name] = low.get("value") or ""
    return out


def pair(rows, age_arg=None):
    got = items(rows)
    predicted = as_float(got.get("predicted") or got.get("predicted_lung_age"))
    age = as_float(got.get("age") or got.get("chronological_age"))
    if age is None and age_arg is not None:
        age = float(age_arg)
    return predicted, age


def opening(rows, age_arg=None):
    predicted, age = pair(rows, age_arg)
    if predicted is None or age is None:
        return "配套仓库里没有保存好的预测模型。这次也没有同时提供预测年龄和实足年龄，所以没有算出残差。"
    residual = code_residual(age, predicted)
    return (
        f"这次算出实足年龄减去预测年龄是 {residual:.1f} 年。"
        "预测模型本身没有套用，这次用的是你给出的预测年龄。"
    )


def method_lines(rows, age_arg=None):
    predicted, age = pair(rows, age_arg)
    lines = ["## 方法算出的名单", ""]
    if predicted is None or age is None:
        lines.append("- 肺实质年龄残差：这次没有算出。")
    else:
        lines.append(f"- 肺实质年龄残差：{code_residual(age, predicted):.1f} 年。")
    return lines


def known_names(rows):
    return set()


def render(meds, labs, rows, age_arg=None):
    lines = ["# 肺实质年龄残差", "", opening(rows, age_arg), ""]
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
