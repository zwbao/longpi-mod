#!/usr/bin/env python3
"""Personal readout. Cohort counts stay in presets and claims."""

from __future__ import annotations

import argparse
import re
from pathlib import Path

import skillkit
from paper_card import lines as paper_card_lines
from presets import ALIASES, BOUNDARY, TITLE, assess, estimate


def load_lines(path):
    if path is None:
        return []
    rows = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            rows.append(text)
    return rows


def split_line(line):
    parts = [p.strip() for p in line.replace("，", ",").split(",")]
    if len(parts) < 2:
        parts = line.split()
    return parts


def has_header(line):
    """True when the line names a name column and a value column, as skillkit reads them."""
    cells = {skillkit.fold_name(cell.strip().strip('"')) for cell in re.split(r"[,\t]", line)}
    names = {skillkit.fold_name(name) for name in skillkit.NAME_COLUMNS}
    values = {skillkit.fold_name(name) for name in skillkit.VALUE_COLUMNS}
    return bool(cells & names) and bool(cells & values)


def _cell(row, columns):
    folded = {skillkit.fold_name(key): value for key, value in row.items()}
    for name in columns:
        value = folded.get(skillkit.fold_name(name))
        if value is not None:
            return value
    return ""


def measurement_rows(path):
    """Measurement rows as item/value/unit dicts, and the lines that could not be read.

    A file whose first line is a header (item,value,unit, as skill.json declares)
    is read by skillkit. A file without one is read line by line as before:
    name,value, with an optional unit after the value.
    """
    if path is None:
        return [], []
    text = Path(path).read_text(encoding="utf-8-sig", errors="replace")
    lines = [line.strip() for line in text.splitlines()]
    lines = [line for line in lines if line and not line.startswith("#")]
    bad = [line for line in lines if len(split_line(line)) < 2]
    first = text.splitlines()[0] if text else ""
    if has_header(first):
        rows = [
            {
                "item": _cell(row, skillkit.NAME_COLUMNS),
                "value": _cell(row, skillkit.VALUE_COLUMNS),
                "unit": _cell(row, skillkit.UNIT_COLUMNS),
            }
            for row in skillkit.read_rows(path)
        ]
        return rows, bad
    rows = []
    for line in lines:
        parts = split_line(line)
        if len(parts) >= 2:
            rows.append({"item": parts[0], "value": parts[1], "unit": parts[2] if len(parts) > 2 else ""})
    return rows, bad


def collect_inputs(measurements, age):
    """Read the measurement rows and --age through skill.json: names, units, ranges.

    Returns the values assess() reads, the unreadable lines, and the problems
    that stop the computation (unknown unit, out of range, not a number,
    duplicated). A missing input is not a problem here; the report says what
    is missing, as before.
    """
    manifest = skillkit.load_manifest(__file__)
    rows, bad = measurement_rows(measurements)
    collected = skillkit.collect_measurements(rows, manifest)
    problems = [item for item in collected.problems if item.kind != "missing"]
    problems += [item for item in skillkit.check_scalar(manifest, "age", age) if item.kind != "missing"]
    values = {key: repr(value) for key, value in collected.values.items()}
    # A sex row is not a skill.json input; assess() only uses it to pick a note.
    for row in rows:
        if row["item"] in collected.unmatched:
            values.setdefault(row["item"], row["value"])
    return values, bad, problems


def parse_labs(path):
    if path is None:
        return []
    found = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if not text or text.startswith("#") or text.startswith("项目"):
            continue
        parts = [p.strip() for p in text.replace("，", ",").split(",")]
        if len(parts) < 2:
            continue
        unit = parts[2] if len(parts) > 2 else ""
        found.append((parts[0], parts[1], unit))
    return found


def lab_lines(path):
    rows = parse_labs(path)
    lines = ["## 体检", ""]
    if not rows:
        lines.append("没有提供体检。体检不增删方法算出的名单。")
        return lines
    lines.append("下面照录体检数值。体检不增删方法算出的名单。")
    for name, value, unit in rows:
        unit_bit = f" {unit}" if unit else ""
        lines.append(f"- {name} {value}{unit_bit}")
    return lines


def norm(text):
    return text.lower().replace(" ", "").replace("-", "").replace("_", "")


def match_item(name, items):
    folded = norm(name)
    for item_name, _detail in items:
        token = norm(item_name)
        if len(token) >= 4 and token in folded:
            return item_name
    for alias, display in ALIASES:
        if norm(alias) and norm(alias) in folded:
            return display
    return None


def medication_lines(path, items):
    names = load_lines(path)
    lines = ["## 你正在使用的药", ""]
    if not names:
        lines.append("没有提供现用药。不能据此停。")
        return lines
    listed = {name for name, _detail in items}
    for name in names:
        display = match_item(name, items)
        if display is None or display not in listed:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
        else:
            lines.append(f"- {name}：这个名字出现在方法名单里。不能据此停。")
    return lines


def render(age, meds, labs, values, bad):
    computed, missing, items = assess(age, values, bad)
    lines = [f"# {TITLE}", "", *paper_card_lines(), "", "## 能算的", ""]
    if computed:
        lines.extend(computed)
    else:
        lines.append("这次没有可算的结果。")
    lines.extend(["", "## 不能算的", ""])
    lines.extend(missing or ["没有单独列出的缺列。"])
    lines.extend(["", "## 方法算出的名单", ""])
    if not items:
        lines.append("名单是空的。")
    else:
        for name, detail in items:
            lines.append(f"- {name}：{detail}")
    lines.extend(["", *medication_lines(meds, items), "", *lab_lines(labs), "", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def with_paper_card(text):
    """Put the paper card under the title line, where render() puts it."""
    title, _newline, rest = text.partition("\n")
    return "\n".join([title, "", *paper_card_lines(), "", rest.lstrip("\n")])


def report(out, age, medications, labs, measurements=None):
    out.mkdir(parents=True, exist_ok=True)
    stale = out / "problems.json"
    if stale.exists():
        stale.unlink()
    manifest = skillkit.load_manifest(__file__)
    values, bad, problems = collect_inputs(measurements, age)
    if problems:
        path = skillkit.write_problems(out, problems, TITLE, BOUNDARY)
        path.write_text(with_paper_card(path.read_text(encoding="utf-8")), encoding="utf-8")
        skillkit.write_result(out, manifest, {"cosinorage": None, "cosinorage_advance": None})
        return path
    path = out / "report.md"
    path.write_text(render(age, medications, labs, values, bad), encoding="utf-8")
    hat, advance = estimate(age, values)
    skillkit.write_result(out, manifest, {"cosinorage": hat, "cosinorage_advance": advance})
    return path


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--medications", type=Path)
    parser.add_argument("--labs", type=Path)
    parser.add_argument("--age", type=float)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--measurements", type=Path)
    args = parser.parse_args(argv)
    report(args.out, args.age, args.medications, args.labs, args.measurements)
    if (args.out / "problems.json").exists():
        return skillkit.EXIT_INPUT_PROBLEM
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
