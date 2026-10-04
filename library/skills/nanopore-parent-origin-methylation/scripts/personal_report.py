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



from presets import TEST_MEDAE, absolute_error, clock_age


def items(rows):
    out = {}
    for row in rows:
        low = {(k or "").strip().lower(): (v or "").strip() for k, v in row.items() if k}
        name = (low.get("item") or "").lower()
        if name:
            out[name] = low.get("value") or ""
    return out


def loci(rows):
    found = []
    for row in rows:
        low = {(k or "").strip().lower(): (v or "").strip() for k, v in row.items() if k}
        locus = low.get("locus")
        paternal = as_float(low.get("paternal"))
        maternal = as_float(low.get("maternal"))
        if locus and paternal is not None and maternal is not None:
            found.append((locus, paternal - maternal))
    return found


def ages(rows):
    got = items(rows)
    return as_float(got.get("methylation_age")), as_float(got.get("age"))


SKIP_ITEMS = {"methylation_age", "age", "locus", "paternal", "maternal"}


def cpg_values(rows):
    values = {}
    for row in rows:
        low = {(k or "").strip().lower(): (v or "").strip() for k, v in row.items() if k}
        name = low.get("cpg") or low.get("site") or low.get("item") or ""
        if not name or name.lower() in SKIP_ITEMS:
            continue
        number = as_float(low.get("value"))
        if number is None:
            continue
        if name not in values:
            values[name] = number
    return values


def opening(rows):
    predicted, age = ages(rows)
    found = loci(rows)
    clock = clock_age(cpg_values(rows))
    parts = []
    if clock is not None:
        total, _used = clock
        parts.append(
            f"这次按标准化甲基化算出甲基化年龄是 {total:.2f} 岁。"
            "没测到的位点按 0 代入。原始比例没有重缩放。"
        )
    if predicted is None or age is None:
        if not found and clock is None:
            return "套索系数是给标准化甲基化用的，训练均值和标准差不在表里。这次没有对上时钟位点，也没有成对的父本与母本甲基化，所以没有算出甲基化年龄。"
        if clock is None:
            parts.append("没有同时提供甲基化年龄和实足年龄，所以没有算出绝对误差。")
    else:
        err = absolute_error(predicted, age)
        parts.append(
            f"这次算出绝对误差是 {err:.2f} 年。"
            f"论文测试集的中位绝对误差是 {TEST_MEDAE} 年，那是队列中位数，不是给你画的线。"
        )
        if clock is None:
            parts.append("时钟位点没有对上，所以没有另算甲基化年龄。")
    for locus, delta in found:
        sentence = f"{locus} 的父本甲基化减去母本甲基化是 {delta:.4f}。"
        if locus.upper().startswith("DIRAS3"):
            sentence += "论文把这个位点描述为父本等位基因随年龄升高甲基化，没有给这个差值切点。"
        else:
            sentence += "论文没有给这个差值切点。"
        parts.append(sentence)
    return "".join(parts)


def method_lines(rows):
    predicted, age = ages(rows)
    found = loci(rows)
    clock = clock_age(cpg_values(rows))
    lines = ["## 方法算出的名单", ""]
    if clock is None:
        lines.append("- 甲基化年龄：这次没有算出。")
    else:
        lines.append(f"- 甲基化年龄：{clock[0]:.2f} 岁。")
    if predicted is None or age is None:
        lines.append("- 绝对误差：这次没有算出。")
    else:
        lines.append(f"- 绝对误差：{absolute_error(predicted, age):.2f} 年。")
    if not found:
        lines.append("- 没有可以列出的位点。")
    for locus, delta in found:
        lines.append(f"- {locus}：父本减去母本是 {delta:.4f}。")
    return lines


def known_names(rows):
    return {locus for locus, _delta in loci(rows)}


def render(meds, labs, rows):
    lines = ["# 印记位点甲基化读出", "", opening(rows), ""]
    lines.extend(method_lines(rows))
    lines.extend(["", *medication_lines(meds, known_names(rows))])
    lines.extend(["", *lab_lines(labs)])
    return finish(lines)


def report(out, meds, labs, measurements):
    return write_report(out, render(load_meds(meds), labs, read_rows(measurements)))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--measurements", type=Path)
    parser.add_argument("--medications", type=Path)
    parser.add_argument("--labs", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    print(report(args.out, args.medications, args.labs, args.measurements))



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
