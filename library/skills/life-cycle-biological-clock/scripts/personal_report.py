#!/usr/bin/env python3
"""Write one personal readout. Labs are printed and do not enter the method list."""

from __future__ import annotations

import skillkit
from paper_card import lines as paper_card_lines


import argparse
import csv
import re
import sys
from pathlib import Path

from presets import ADULT, AGE_SPLIT, BOUNDARY, PEDIATRIC, _adult_band, render_body


def read_table(path: Path) -> list[dict[str, str]]:
    raw = path.read_text(encoding="utf-8-sig")
    lines = [line for line in raw.splitlines() if line.strip()]
    if not lines:
        return []
    delimiter = "\t" if "\t" in lines[0] else ","
    reader = csv.DictReader(lines, delimiter=delimiter)
    rows = []
    for row in reader:
        cleaned = {}
        for key, value in row.items():
            if key is None:
                continue
            cleaned[key.strip().lower()] = (value or "").strip()
        if any(cleaned.values()):
            rows.append(cleaned)
    return rows


def read_lines(path: Path | None) -> list[str]:
    if path is None:
        return []
    names = []
    for line in path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            names.append(text)
    return names


def _norm(text: str) -> str:
    return "".join(text.casefold().split())


def medication_lines(items: list[dict], medications: list[str]) -> list[str]:
    keys = set()
    for item in items:
        keys.add(_norm(item["name"]))
        for alias in item.get("aliases") or []:
            keys.add(_norm(str(alias)))
    lines = []
    for name in medications:
        if _norm(name) in keys:
            lines.append(
                f"- {name}：这个名字在名单上。名单只说明方法登记了它，不能据此开始或停止。"
            )
        else:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def render_report(rows: list[dict[str, str]], medications: list[str], labs: list[str]) -> str:
    paragraphs, items = render_body(rows)
    lines = list(paragraphs)
    lines.append("")
    lines.append("## 方法算出的名单")
    if not items:
        lines.append("名单是空的。")
    else:
        for item in items:
            lines.append(f"- {item['name']}：{item['detail']}")
    lines.append("")
    lines.append("## 你正在使用的药")
    if not medications:
        lines.append("没有提供现用药。")
    else:
        lines.extend(medication_lines(items, medications))
    lines.append("")
    lines.append("## 体检")
    if not labs:
        lines.append("没有提供体检。体检不增删方法算出的名单。")
    else:
        lines.append("下面照录体检。体检不增删方法算出的名单。")
        for lab in labs:
            lines.append(f"- {lab}")
    lines.append("")
    lines.append(BOUNDARY)
    return "\n".join(lines) + "\n"


TITLE = "临床时钟对照"
DIFFERENCE_KEY = "standardized_age_difference"


def has_header(line: str) -> bool:
    """True when the line names a name column and a value column, as skillkit reads them."""
    cells = {skillkit.fold_name(cell.strip().strip('"')) for cell in re.split(r"[,\t]", line)}
    names = {skillkit.fold_name(name) for name in skillkit.NAME_COLUMNS}
    values = {skillkit.fold_name(name) for name in skillkit.VALUE_COLUMNS}
    return bool(cells & names) and bool(cells & values)


def _cell(row: dict[str, str], columns) -> str:
    folded = {skillkit.fold_name(key): value for key, value in row.items()}
    for name in columns:
        value = folded.get(skillkit.fold_name(name))
        if value is not None:
            return value
    return ""


def measurement_rows(path: Path | None) -> list[dict[str, str]]:
    """Measurement rows as item/value/unit dicts.

    A file whose first line is a header (indicator,value as documented, or
    indicator,value,unit as skill.json declares) is read by skillkit. A file
    without one is read line by line: name,value with an optional unit. A path
    that does not exist counts as no measurements.
    """
    if path is None or not path.exists():
        return []
    text = path.read_text(encoding="utf-8-sig", errors="replace")
    first = next((line for line in text.splitlines() if line.strip()), "")
    if has_header(first):
        return [
            {
                "item": _cell(row, skillkit.NAME_COLUMNS),
                "value": _cell(row, skillkit.VALUE_COLUMNS),
                "unit": _cell(row, skillkit.UNIT_COLUMNS),
            }
            for row in skillkit.read_rows(path)
        ]
    rows = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = [part.strip() for part in re.split(r"[,\t，]", line)]
        if len(parts) >= 2:
            rows.append({"item": parts[0], "value": parts[1], "unit": parts[2] if len(parts) > 2 else ""})
    return rows


def _is_age_row(name: str, age_spec: dict) -> bool:
    names = {skillkit.fold_name(item) for item in [age_spec["key"], age_spec.get("label_zh", ""), *age_spec.get("aliases", [])] if item}
    return any(variant in names for variant in skillkit.name_variants(name))


def driver_names(manifest: dict) -> dict[str, str]:
    """skill.json key -> the name render_body() matches, for each Fig. 2 driver."""
    index = skillkit.alias_index(skillkit.input_specs(manifest))
    found = {}
    for _display, aliases, _direction in [*PEDIATRIC, *ADULT]:
        found[index[skillkit.fold_name(aliases[0])][0]["key"]] = aliases[0]
    return found


def collect_inputs(measurements: Path | None, age: float | None) -> tuple[dict[str, float], list]:
    """Read age, the standardized age difference and the Fig. 2 labs through skill.json.

    Returns the values in the method's units and the problems that stop the
    report: no age, a unit that cannot be converted, a value out of range, a
    value that is not a number, a duplicated row. Age comes from --age; a row
    named age in the measurement file is still read, as before, and is used
    when --age is not given. Rows the method does not name (glucose, say) are
    left out, as before.
    """
    manifest = skillkit.load_manifest(__file__)
    age_spec = skillkit.spec_by_key(manifest, "age")
    rows, age_rows = [], []
    for row in measurement_rows(measurements):
        (age_rows if _is_age_row(row["item"], age_spec) else rows).append(row)
    collected = skillkit.collect_measurements(rows, manifest)
    problems = list(collected.problems)
    table_spec = {**age_spec, "from": "measurements", "required": False}
    from_table = skillkit.collect_measurements(age_rows, {"inputs": [table_spec]})
    problems += from_table.problems
    chronological = age if age is not None else from_table.values.get("age")
    if age is not None or not any(item.key == "age" for item in problems):
        problems += skillkit.check_scalar(manifest, "age", chronological)
    values = dict(collected.values)
    if chronological is not None:
        values["age"] = chronological
    return values, problems


def method_rows(values: dict[str, float], manifest: dict) -> list[dict[str, str]]:
    """The indicator,value rows render_body() reads, rebuilt from checked values."""
    rows = [{"indicator": "age", "value": repr(values["age"])}]
    if DIFFERENCE_KEY in values:
        rows.append({"indicator": DIFFERENCE_KEY, "value": repr(values[DIFFERENCE_KEY])})
    for key, name in driver_names(manifest).items():
        if key in values:
            rows.append({"indicator": name, "value": f"{values[key]:g}"})
    return rows


def adult_band(values: dict[str, float]) -> str | None:
    """The adult band render_body() puts in the list, or None when it puts none."""
    if values["age"] <= AGE_SPLIT or DIFFERENCE_KEY not in values:
        return None
    name, _detail = _adult_band(values[DIFFERENCE_KEY])
    return name if name in {"平均偏离", "过度偏离"} else "两档之外"


def report(
    out: Path,
    measurements: Path | None = None,
    medications: Path | None = None,
    labs: Path | None = None,
    age: float | None = None,
) -> Path:
    out.mkdir(parents=True, exist_ok=True)
    stale = out / "problems.json"
    if stale.exists():
        stale.unlink()
    manifest = skillkit.load_manifest(__file__)
    values, problems = collect_inputs(measurements, age)
    if problems:
        # BOUNDARY already starts with "边界: "; write_problems adds its own.
        path = skillkit.write_problems(out, problems, TITLE, BOUNDARY.removeprefix("边界: "))
        text = path.read_text(encoding="utf-8").replace(
            "这次没有计算。原因如下：", "输入没有通过检查，所以这次没有对照时钟。原因如下："
        )
        path.write_text(_with_paper_card(text), encoding="utf-8")
        skillkit.write_result(out, manifest, {"adult_band": None})
        return path
    text = render_report(method_rows(values, manifest), read_lines(medications), read_lines(labs))
    path = out / "report.md"
    path.write_text(_with_paper_card(text), encoding="utf-8")
    skillkit.write_result(out, manifest, {"adult_band": adult_band(values)})
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--measurements", type=Path, default=None)
    parser.add_argument("--medications", type=Path, default=None)
    parser.add_argument("--labs", type=Path, default=None)
    parser.add_argument("--age", type=float, default=None)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    report(args.out, args.measurements, args.medications, args.labs, args.age)
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
