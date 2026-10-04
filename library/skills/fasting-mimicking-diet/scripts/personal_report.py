#!/usr/bin/env python3
"""FMD trial biological-age difference."""

from __future__ import annotations

import skillkit
from paper_card import lines as paper_card_lines


import argparse
import csv
from pathlib import Path

from presets import *

TITLE = "临床生物年龄的前后差"
OUTPUT_KEYS = ("bioage_change", "bioage_change_predicted")


def read_rows(path: Path | None) -> list[dict[str, str]]:
    if path is None:
        return []
    with path.open(encoding="utf-8-sig", newline="") as handle:
        sample = handle.read(4096)
        handle.seek(0)
        if not sample.strip():
            return []
        dialect = csv.Sniffer().sniff(sample, delimiters=",\t")
        return list(csv.DictReader(handle, dialect=dialect))


def collect_inputs(measurements: Path | None, age: float | None) -> tuple[dict[str, float], list]:
    """Read the item,value,unit rows through skill.json: names, units, and ranges.

    Returns the values under their declared keys, in the declared units, and
    the problems that stop the report (unparsable, unknown unit, out of range,
    duplicated, or an age out of range). A missing row is not a problem here;
    the report says what it could not compute, as before.
    """
    manifest = skillkit.load_manifest(__file__)
    collected = skillkit.collect_file(measurements, manifest)
    problems = [item for item in collected.problems if item.kind != "missing"]
    problems += [item for item in skillkit.check_scalar(manifest, "age", age) if item.kind != "missing"]
    return collected.values, problems


def compute(values: dict[str, float], age: float | None) -> dict[str, float | None]:
    """The two numbers the report prints, None when an input is missing."""
    base = values.get("biological_age_baseline")
    follow = values.get("biological_age_followup")
    change = follow - base if base is not None and follow is not None else None
    predicted = None
    if base is not None and age is not None:
        predicted = CHANGE_INTERCEPT + CHANGE_ON_BIOAGE * base + CHANGE_ON_AGE * age
    return {"bioage_change": change, "bioage_change_predicted": predicted}


def load_meds(path: Path | None) -> list[str]:
    if path is None:
        return []
    names = []
    for line in path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            names.append(text)
    return names


def lab_lines(path: Path | None) -> list[str]:
    rows = read_rows(path)
    lines = ["## 体检", ""]
    if not rows:
        lines.append("没有提供体检。体检不增删方法算出的名单。")
        return lines
    lines.append("下面照录体检数值。体检不增删方法算出的名单。")
    for row in rows:
        lowered = { (k or "").strip(): (v or "").strip() for k, v in row.items() }
        item = lowered.get("项目") or lowered.get("item") or lowered.get("name")
        value = lowered.get("结果") or lowered.get("value") or lowered.get("result")
        unit = lowered.get("单位") or lowered.get("unit") or ""
        if item and value:
            suffix = f" {unit}" if unit else ""
            lines.append(f"- {item} {value}{suffix}")
        else:
            bits = [f"{key} {value}".strip() for key, value in lowered.items() if key and value]
            if bits:
                lines.append("- " + "，".join(bits))
    return lines


def write_report(out: Path, text: str) -> Path:
    out.mkdir(parents=True, exist_ok=True)
    path = out / "report.md"
    if not text.endswith("\n"):
        text += "\n"
    path.write_text(_with_paper_card(text), encoding="utf-8")
    return path


def finish(lines: list[str]) -> str:
    lines.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def miss(name: str) -> str:
    return f"- {name}：名单里没有这个名字。不能据此停。"



def opening(values, age):
    computed = compute(values, age)
    extra = []
    glucose = values.get("glucose_mg_dl")
    bmi = values.get("bmi")
    if glucose is not None:
        extra.append(f"你提供的空腹血糖是 {glucose:.0f} mg/dL。")
    if bmi is not None:
        extra.append(f"你提供的 BMI 是 {bmi:.1f}。")
    tail = "".join(extra)
    bits = []
    matched = []
    delta = computed["bioage_change"]
    if delta is not None:
        bits.append(
            f"后一次减去前一次是 {delta:.1f} 年。"
            f"论文完成者的中位数下降接近 {MEDIAN_DECREASE_NEARLY} 年。"
        )
        matched.append((f"前后差 {delta:.1f} 年",))
    change = computed["bioage_change_predicted"]
    if change is not None:
        bits.append(f"按补充说明里的变化公式，预计变化是 {change:.4f} 年。")
        matched.append((f"预计变化 {change:.4f} 年",))
    if not bits:
        text = "补充表有七项化验的斜率、截距和残差，但生物年龄公式还要年龄差方差，这个数没有印出来，所以这次没有算出生物年龄。"
    else:
        text = "".join(bits)
    return text + tail, matched


def method_lines(matched):
    lines = ["## 方法算出的名单", ""]
    if matched:
        lines.append(f"对上了 {len(matched)} 个。")
        for item in matched:
            lines.append("- " + item[0])
    else:
        lines.append("对上了 0 个。")
    return lines


def medication_lines(meds):
    lines = ["## 你正在使用的药", ""]
    if not meds:
        lines.append("没有提供现用药。")
        return lines
    for name in meds:
        lines.append(miss(name))
    return lines


def render(age, meds, labs, values):
    paragraph, matched = opening(values, age)
    lines = [f"# {TITLE}", "", paragraph, ""]
    lines.extend(method_lines(matched))
    lines.extend(["", *medication_lines(meds)])
    lines.extend(["", *lab_lines(labs)])
    return finish(lines)


def report(out, meds, labs, measurements, age=None):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    stale = out / "problems.json"
    if stale.exists():
        stale.unlink()
    manifest = skillkit.load_manifest(__file__)
    values, problems = collect_inputs(measurements, age)
    if problems:
        path = skillkit.write_problems(out, problems, TITLE, BOUNDARY)
        path.write_text(_with_paper_card(path.read_text(encoding="utf-8")), encoding="utf-8")
        skillkit.write_result(out, manifest, {key: None for key in OUTPUT_KEYS})
        return path
    path = write_report(out, render(age, load_meds(meds), labs, values))
    skillkit.write_result(out, manifest, compute(values, age))
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--measurements", type=Path)
    parser.add_argument("--medications", type=Path)
    parser.add_argument("--labs", type=Path)
    parser.add_argument("--age", type=float)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    path = report(args.out, args.medications, args.labs, args.measurements, args.age)
    print(path)
    if (args.out / "problems.json").exists():
        return skillkit.EXIT_INPUT_PROBLEM
    return 0



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
    raise SystemExit(main())
