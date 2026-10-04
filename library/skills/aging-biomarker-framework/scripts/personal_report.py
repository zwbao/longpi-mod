#!/usr/bin/env python3
"""Age deviation for clocks the user already computed, annotated with published benchmarks.

Biolearn's CpG models are not executed. Labs and medicines do not change deviations.
Clock names, units and ranges come from skill.json and are checked by skillkit.
DunedinPoAm38 and DunedinPACE are paces of aging, not ages; no deviation is taken from them.
"""

from __future__ import annotations

import skillkit
from paper_card import lines as paper_card_lines


import argparse
import csv
import sys
from functools import lru_cache
from pathlib import Path

from presets import BOUNDARY, CLOCKS, GRIMAGE2_MORTALITY_HR, HORVATH_SKIN_R2, PACE_CLOCKS

# result.json key for the deviation of each age input declared in skill.json.
DEVIATION_OUTPUTS = {
    "HorvathSkinBlood": "horvath_skin_blood_age_deviation",
    "GrimAge2": "grimage2_age_deviation",
    "GrimAge": "grimage_age_deviation",
    "PhenoAge": "dnam_phenoage_age_deviation",
    "blood_phenoage": "blood_phenoage_age_deviation",
}
# The documented clocks.csv: name,predicted,age (or 时钟,预测,年龄).
WIDE_NAME_COLUMNS = ("name", "时钟")
WIDE_PREDICTED_COLUMNS = ("predicted", "预测")
AGE_COLUMNS = ("age", "年龄")
OTHER_CLOCK_NOTE = "表里没有这个时钟名字，按预测年龄（岁）读。不要填年龄加速值或衰老速度。"


def age_deviation(predicted: float, chronological: float) -> float:
    return predicted - chronological


@lru_cache(maxsize=None)
def _name_index(source: str) -> dict:
    return skillkit.alias_index(skillkit.input_specs(skillkit.load_manifest(__file__), source))


def input_key(name: str, source: str = "measurements") -> str | None:
    """Key of the skill.json input a row name matches (key, label or alias), or None."""
    index = _name_index(source)
    for variant in skillkit.name_variants(name):
        if variant in index:
            return index[variant][0]["key"]
    return None


def _column(fields, names) -> str | None:
    lookup = {skillkit.fold_name(field): field for field in fields}
    for name in names:
        found = lookup.get(skillkit.fold_name(name))
        if found is not None:
            return found
    return None


def _read_age(spec: dict, name: str, cell: str):
    """A chronological age from a table cell: (value, None) or (None, problem)."""
    try:
        value = skillkit.parse_number(cell)
    except ValueError:
        return None, skillkit.Problem("age", spec["label_zh"], "parse", f"{name} 这一行的实足年龄「{cell}」不是一个可以计算的数。")
    return value, skillkit.range_problem(spec, value, f"{name} 这一行", raw=value)


def _other_clock(manifest: dict, name: str, raw: str):
    """A clock skill.json does not list, read as a predicted age with the range of the listed age clocks."""
    ranges = [spec["range"] for spec in skillkit.input_specs(manifest) if spec.get("unit") == "a" and spec.get("range")]
    spec = {
        "key": "",
        "label_zh": name,
        "unit": "a",
        "range": [min(low for low, _high in ranges), max(high for _low, high in ranges)],
        "note_zh": OTHER_CLOCK_NOTE,
    }
    try:
        value = skillkit.parse_number(raw)
    except ValueError:
        return None, skillkit.Problem("", name, "parse", f"{name} 的结果「{raw}」不是一个可以计算的数。")
    return value, skillkit.range_problem(spec, value, "按 a 读", raw=value)


def collect_inputs(clocks: Path | None, age: float | None) -> tuple[list[tuple[str, float, float | None]], list]:
    """Read the clock table through skill.json: clock names, units and ranges.

    Two layouts: the documented name,predicted,age (a chronological age on each
    row), and name,value,unit (entry.measurements_header) with the chronological
    age from --age or from a row named age. Returns (name, predicted value,
    chronological age or None) in table order, and the problems that stop the
    computation. A clock the table leaves out is not a problem.
    """
    manifest = skillkit.load_manifest(__file__)
    problems = [item for item in skillkit.check_scalar(manifest, "age", age) if item.kind != "missing"]
    if clocks is None:
        return [], problems
    table = skillkit.read_rows(clocks)
    fields = list(table[0]) if table else []
    value_col = _column(fields, WIDE_PREDICTED_COLUMNS)
    if value_col is None:
        collected = skillkit.collect_file(clocks, manifest)
        name_col = _column(fields, skillkit.NAME_COLUMNS)
        value_col = _column(fields, skillkit.VALUE_COLUMNS)
    else:
        name_col = _column(fields, WIDE_NAME_COLUMNS + skillkit.NAME_COLUMNS)
        if name_col is None:
            problems.append(skillkit.Problem("", "", "header", "时钟表需要 name,predicted,age 三列，或者 name,value,unit 三列再加 --age。"))
            return [], problems
        unit_col = _column(fields, skillkit.UNIT_COLUMNS)
        collected = skillkit.collect_measurements(
            [{"name": row.get(name_col, ""), "value": row.get(value_col, ""), "unit": row.get(unit_col, "") if unit_col else ""} for row in table],
            manifest,
        )
    problems += [item for item in collected.problems if item.kind != "missing"]
    if name_col is None or value_col is None:
        return [], problems
    age_spec = skillkit.spec_by_key(manifest, "age")
    age_col = _column(fields, AGE_COLUMNS)
    fallback = age
    clock_rows = []
    for row in table:
        name, raw = row.get(name_col, ""), row.get(value_col, "")
        if not name or raw == "":
            continue
        if input_key(name) is None and input_key(name, "profile") == "age":
            value, problem = _read_age(age_spec, name, raw)
            if problem is not None:
                problems.append(problem)
            elif fallback is None:
                fallback = value
            continue
        clock_rows.append((name, raw, row.get(age_col, "") if age_col else ""))
    rows = []
    for name, raw, cell in clock_rows:
        key = input_key(name)
        if key is None:
            predicted, problem = _other_clock(manifest, name, raw)
            if problem is not None:
                problems.append(problem)
                continue
        elif key in collected.values:
            predicted = collected.values[key]
        else:
            continue
        chronological = fallback
        if cell:
            chronological, problem = _read_age(age_spec, name, cell)
            if problem is not None:
                problems.append(problem)
                continue
        rows.append((name, predicted, chronological))
    return rows, problems


def load_clocks(path: Path | None) -> list[tuple[str, float, float | None]]:
    """Rows (name, predicted, chronological age) of the clock table (problems dropped)."""
    rows, _problems = collect_inputs(path, None)
    return rows


def canonical(name: str) -> str | None:
    key = input_key(name)
    return key if key in CLOCKS else None


ONE = {
    "HorvathSkinBlood": f"论文写这个时钟的年龄决定系数是 {HORVATH_SKIN_R2:.2f}。",
    "GrimAge2": f"论文在一个队列里报告的死亡风险比是 {GRIMAGE2_MORTALITY_HR:.2f}。",
}


def clock_lines(rows: list[tuple[str, float, float | None]]) -> list[str]:
    if not rows:
        return ["没有给出时钟。"]
    lines = []
    for name, predicted, age in rows:
        key = canonical(name)
        if key in PACE_CLOCKS:
            lines.append(f"- {key}：衰老速度 {predicted:g}。这是速度，不是年龄，不算年龄偏差。队列里的其余风险比不逐条抄在这里。")
            continue
        if age is None:
            lines.append(f"- {key or name}：没有实足年龄，不算年龄偏差。")
            continue
        deviation = age_deviation(predicted, age)
        if key is None:
            lines.append(f"- {name}：年龄偏差 {deviation:.2f}。基准表里没有这个时钟名字。")
            continue
        extra = ONE.get(key, "队列里的其余风险比不逐条抄在这里。")
        lines.append(f"- {key}：年龄偏差 {deviation:.2f}。{extra}这是队列结果，不乘到你的偏差上。")
    return lines


def load_lines(path: Path | None) -> list[str]:
    if path is None:
        return []
    return [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip() and not line.startswith("#")]


def medication_lines(names: list[str]) -> list[str]:
    lines = ["## 你正在使用的药", ""]
    if not names:
        lines.append("没有提供现用药。")
        return lines
    for name in names:
        lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def exam_section(labs: list[str]) -> list[str]:
    lines = ["## 体检", ""]
    if not labs:
        lines.append("没有提供体检。体检不增删方法算出的名单。")
        return lines
    lines.append("下面照录体检数值。体检不增删方法算出的名单。")
    lines.extend(labs)
    return lines


LAB_PANELS = {
    "alt": ("谷丙转氨酶", None, 40),
    "ast": ("谷草转氨酶", None, 40),
    "creatinine": ("肌酐", None, 115),
    "egfr": ("肾小球滤过率", 60, None),
    "hemoglobin": ("血红蛋白", 110, None),
    "platelets": ("血小板", 100, None),
}
LAB_ALIASES = {
    "谷丙转氨酶": "alt", "谷丙": "alt", "alt": "alt",
    "谷草转氨酶": "ast", "谷草": "ast", "ast": "ast",
    "肌酐": "creatinine", "creatinine": "creatinine",
    "肾小球滤过率": "egfr", "egfr": "egfr",
    "血红蛋白": "hemoglobin", "血小板": "platelets",
}


def parse_labs(path: Path | None) -> list[str]:
    if path is None:
        return []
    text = path.read_text(encoding="utf-8", errors="replace")
    lines = [line for line in text.splitlines() if line.strip()]
    parsed: list[str] = []

    def one(item: str, value_text: str) -> None:
        compact = item.casefold().replace(" ", "")
        key = next((panel for alias, panel in LAB_ALIASES.items() if alias.casefold() in compact), None)
        if key is None:
            return
        digits = "".join(ch if ch.isdigit() or ch == "." else " " for ch in value_text).split()
        if not digits:
            return
        value = float(digits[0])
        label, low, high = LAB_PANELS[key]
        if low is not None and value < low:
            bound = f"，低于常见下限 {low:g}"
        elif high is not None and value > high:
            bound = f"，高于常见上限 {high:g}"
        else:
            bound = "，在常见范围内"
        parsed.append(f"- {label} {value:g}{bound}")

    if lines and ("," in lines[0] or "\t" in lines[0]):
        dialect = csv.excel_tab if "\t" in lines[0] else csv.excel
        table = list(csv.DictReader(lines, dialect=dialect))
        fields = {name.strip().lower(): name for name in table[0]} if table else {}
        item_key = fields.get("项目") or fields.get("item") or fields.get("name")
        value_key = fields.get("结果") or fields.get("value") or fields.get("result")
        if item_key and value_key:
            for row in table:
                one(row.get(item_key, ""), row.get(value_key, ""))
    if not parsed:
        for line in lines:
            one(line, line)
    if not parsed:
        return ["没有从体检文件里读到可识别的项目。体检不增删方法算出的名单。"]
    parsed.append("超出常见范围的项目只写在这里。体检不增删方法算出的名单。")
    return parsed


def intro_bit(name: str, predicted: float, age: float | None) -> str:
    if canonical(name) in PACE_CLOCKS:
        return f"{name} 是衰老速度，不算年龄偏差"
    if age is None:
        return f"{name} 没有实足年龄，不算年龄偏差"
    return f"{name} 的年龄偏差是 {age_deviation(predicted, age):.2f}"


def deviations(rows: list[tuple[str, float, float | None]], manifest: dict) -> dict:
    """Every declared output: the first deviation per declared age clock, else None."""
    found = {item["key"]: None for item in manifest["outputs"]}
    for name, predicted, age in rows:
        output = DEVIATION_OUTPUTS.get(input_key(name))
        if output in found and found[output] is None and age is not None:
            found[output] = age_deviation(predicted, age)
    return found


def render(rows: list[tuple[str, float, float | None]], meds: list[str], labs: list[str]) -> str:
    if rows:
        bits = [intro_bit(name, predicted, age) for name, predicted, age in rows]
        intro = "，".join(bits) + "。"
    else:
        intro = "这次没有给出预测年龄和实足年龄，所以不算年龄偏差。"
    lines = ["# 衰老标志物对照", "", intro, "", "## 方法算出的名单", "", *clock_lines(rows)]
    lines.extend(["", *medication_lines(meds)])
    lines.extend(["", *exam_section(labs)])
    lines.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def report(
    out: Path,
    clocks: Path | None = None,
    medications: Path | None = None,
    labs: Path | None = None,
    age: float | None = None,
) -> Path:
    out.mkdir(parents=True, exist_ok=True)
    stale = out / "problems.json"
    if stale.exists():
        stale.unlink()
    manifest = skillkit.load_manifest(__file__)
    rows, problems = collect_inputs(clocks, age)
    if problems:
        destination = skillkit.write_problems(out, problems, "衰老标志物对照", BOUNDARY)
        text = destination.read_text(encoding="utf-8").replace(
            "这次没有计算。原因如下：", "输入没有通过检查，所以不算年龄偏差。原因如下："
        )
        destination.write_text(_with_paper_card(text), encoding="utf-8")
        skillkit.write_result(out, manifest, {item["key"]: None for item in manifest["outputs"]})
        return destination
    text = render(rows, load_lines(medications), parse_labs(labs))
    destination = out / "report.md"
    destination.write_text(_with_paper_card(text), encoding="utf-8")
    skillkit.write_result(out, manifest, deviations(rows, manifest))
    return destination


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Aging-biomarker benchmark readout")
    parser.add_argument("--clocks", type=Path, default=None)
    parser.add_argument("--age", type=float, default=None)
    parser.add_argument("--medications", type=Path, default=None)
    parser.add_argument("--labs", type=Path, default=None)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    print(report(args.out, args.clocks, args.medications, args.labs, args.age))
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
    sys.exit(main())
