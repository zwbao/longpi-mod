#!/usr/bin/env python3
from __future__ import annotations

import skillkit
from paper_card import lines as paper_card_lines


import argparse
import csv
import re
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


from presets import MAE_POOLED, ppg_gap


def items(rows):
    out = {}
    for row in rows:
        keys = {(k or "").strip().lower(): (v or "").strip() for k, v in row.items() if k}
        name = (keys.get("item") or keys.get("name") or "").lower()
        if name:
            out[name] = keys.get("value") or ""
    return out


def pair(rows):
    got = items(rows)
    return as_float(got.get("ppgage") or got.get("ppg_age")), as_float(got.get("age"))


def opening(rows):
    ppg, age = pair(rows)
    if ppg is None or age is None:
        return "公开材料里没有脉搏波波形的岭回归系数。这次也没有同时提供脉搏波年龄和实足年龄，所以没有算出年龄差。"
    gap = ppg_gap(ppg, age)
    return (
        f"这次算出脉搏波年龄减去实足年龄是 {gap:.1f} 年。"
        f"论文健康队列的平均绝对误差是 {MAE_POOLED} 年，那是队列误差，不是给你画的线。"
        "波形的岭回归系数不在公开材料里，这次用的是你给出的脉搏波年龄。"
    )


def method_lines(rows):
    ppg, age = pair(rows)
    lines = ["## 方法算出的名单", ""]
    if ppg is None or age is None:
        lines.append("- 脉搏波年龄差：这次没有算出。")
    else:
        lines.append(f"- 脉搏波年龄差：{ppg_gap(ppg, age):.1f} 年。")
    return lines


def known_names(rows):
    return set()


def render(meds, labs, rows):
    lines = ["# 腕部脉搏波年龄差", "", opening(rows), ""]
    lines.extend(method_lines(rows))
    lines.extend(["", *medication_lines(meds, known_names(rows))])
    lines.extend(["", *lab_lines(labs)])
    return finish(lines)


TITLE = "腕部脉搏波年龄差"


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
    """Measurement rows as item/value/unit dicts.

    A file whose first line is a header (item,value,unit as skill.json
    declares, or the older item,value) is read by skillkit. A file without
    one is read line by line: name,value with an optional unit. A path that
    does not exist counts as no measurements, as before.
    """
    if path is None or not path.exists():
        return []
    text = path.read_text(encoding="utf-8-sig", errors="replace")
    first = text.splitlines()[0] if text.strip() else ""
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


def _is_age_row(name, age_spec):
    names = {skillkit.fold_name(item) for item in [age_spec["key"], age_spec.get("label_zh", ""), *age_spec.get("aliases", [])] if item}
    return any(variant in names for variant in skillkit.name_variants(name))


def collect_inputs(measurements, age):
    """Read PpgAge and age through skill.json: names, units, and ranges.

    Returns (PpgAge, chronological age, problems). Age comes from --age; a
    row named age in the measurement file is still read, as before, and is
    used when --age is not given. Both are required, so a missing one is a
    problem, as is a unit that cannot be converted, a value out of range, a
    value that is not a number, or a duplicated row.
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
    return collected.values.get("ppgage"), chronological, problems


def report(out, meds, labs, measurements, age=None):
    out.mkdir(parents=True, exist_ok=True)
    stale = out / "problems.json"
    if stale.exists():
        stale.unlink()
    manifest = skillkit.load_manifest(__file__)
    ppg, chronological, problems = collect_inputs(measurements, age)
    if problems:
        path = skillkit.write_problems(out, problems, TITLE, BOUNDARY)
        text = path.read_text(encoding="utf-8").replace(
            "这次没有计算。原因如下：", "输入没有通过检查，所以没有算出年龄差。原因如下："
        )
        path.write_text(_with_paper_card(text), encoding="utf-8")
        skillkit.write_result(out, manifest, {"ppgage_gap": None})
        return path
    rows = [{"item": "ppgage", "value": repr(ppg)}, {"item": "age", "value": repr(chronological)}]
    path = write_report(out, render(load_meds(meds), labs, rows))
    skillkit.write_result(out, manifest, {"ppgage_gap": ppg_gap(ppg, chronological)})
    return path


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--measurements", type=Path)
    parser.add_argument("--medications", type=Path)
    parser.add_argument("--labs", type=Path)
    parser.add_argument("--age", type=float)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    print(report(args.out, args.medications, args.labs, args.measurements, args.age))
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
