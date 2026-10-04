#!/usr/bin/env python3
"""Write one personal readout. Labs are printed and do not enter the method list."""

from __future__ import annotations

import skillkit
from paper_card import lines as paper_card_lines


import argparse
import sys
from pathlib import Path

from presets import BLOOD_PHENOAGE, BOUNDARY, known_clock, render_body

TITLE = "时钟稳定度"
HEADER_PROBLEM = (
    "测量表要么是时钟长表（clock,biological_age 两列，可加 time_years、unit，每个时间点一行），"
    "要么是 item,value,unit 表（phenoage_visit1 起，每次血检表型年龄一行）。"
)
# item,value,unit rows the harness writes: the blood phenotypic age at each visit, oldest first.
VISIT_KEYS = ("phenoage_visit1", "phenoage_visit2", "phenoage_visit3", "phenoage_visit4")
# result.json keys: one unscaled stability index per clock render_body can list.
OUTPUT_KEYS = {
    "multi-tissue": "stability_index_multi_tissue",
    "skin & blood": "stability_index_skin_blood",
    "phenoage": "stability_index_dnam_phenoage",
    "grimage2": "stability_index_grimage2",
    "grimage": "stability_index_grimage",
    "methyldetectr": "stability_index_methyldetectr",
    "causage": "stability_index_causage",
    "hannum": "stability_index_hannum",
    "mlr-levine": "stability_index_mlr_levine",
    "pca-levine": "stability_index_pca_levine",
    "kdm-levine": "stability_index_kdm_levine",
    "kdm": "stability_index_kdm",
    "protage-tanaka": "stability_index_protage_tanaka",
    "protage-md": "stability_index_protage_md",
    BLOOD_PHENOAGE: "stability_index_blood_phenoage",
}


def _checked(spec: dict, name: str, raw: str, unit: str = "") -> tuple[float | None, list]:
    """One number of the clock table, checked by skillkit with spec's unit and range."""
    spec = dict(spec, label_zh=name)
    got = skillkit.collect_measurements([{"item": name, "value": raw, "unit": unit}], {"inputs": [spec]})
    return got.values.get(spec["key"]), got.problems


def clock_table(rows: list[dict[str, str]], manifest: dict) -> tuple[list[dict[str, str]], list]:
    """Check a clock,biological_age[,time_years][,unit] table, one time point per row.

    biological_age and time_years are read with the unit and range skill.json
    declares for them. Rows for clocks render_body does not list are skipped
    unchecked, as before.
    """
    columns = {skillkit.fold_name(name): name for name in rows[0]}
    value_col = columns.get(skillkit.fold_name("biological_age")) or columns.get("ba")
    if value_col is None:
        return [], [skillkit.Problem("biological_age", "生物年龄", "header", HEADER_PROBLEM)]
    time_col = columns.get(skillkit.fold_name("time_years"))
    unit_col = next((columns[skillkit.fold_name(name)] for name in skillkit.UNIT_COLUMNS if skillkit.fold_name(name) in columns), None)
    age_spec = skillkit.spec_by_key(manifest, "biological_age")
    time_spec = skillkit.spec_by_key(manifest, "time_years")
    checked, problems = [], []
    for row in rows:
        clock = row.get(columns["clock"], "")
        if not known_clock(clock):
            continue
        age, found = _checked(age_spec, clock, row.get(value_col, ""), row.get(unit_col, "") if unit_col else "")
        time_years, found_time = _checked(time_spec, f"{clock} time_years", row.get(time_col, "")) if time_col else (None, [])
        problems += found + found_time
        if age is not None:
            checked.append({"clock": clock, "biological_age": repr(age), "time_years": "" if time_years is None else repr(time_years)})
    return checked, problems


def collect_inputs(path: Path | None) -> tuple[list[dict[str, str]], list]:
    """Rows for render_body and the problems that stop the report.

    A table with a clock column is the clock table of SKILL.md. Any other table
    is read by skillkit as item,value,unit rows named in skill.json:
    phenoage_visit1 to phenoage_visit4, listed as the blood phenotypic age. A
    missing row is not a problem; the report says what it could not compute.
    """
    if path is None:
        return [], []
    manifest = skillkit.load_manifest(__file__)
    rows = skillkit.read_rows(path)
    if rows and "clock" in {skillkit.fold_name(name) for name in rows[0]}:
        return clock_table(rows, manifest)
    collected = skillkit.collect_file(path, manifest)
    problems = [
        skillkit.Problem("", "", "header", HEADER_PROBLEM) if item.kind == "header" else item
        for item in collected.problems
        if item.kind != "missing"
    ]
    series = [
        {"clock": BLOOD_PHENOAGE, "biological_age": repr(collected.values[key])}
        for key in VISIT_KEYS
        if key in collected.values
    ]
    return series, problems


def stability_outputs(rows: list[dict[str, str]]) -> dict[str, float | None]:
    """Every declared output: the unscaled stability of each clock, None when not computed."""
    found = {item["name"]: item["stability"] for item in render_body(rows)[1]}
    return {key: found.get(clock) for clock, key in OUTPUT_KEYS.items()}


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


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--measurements", default=None)
    parser.add_argument("--medications", default=None)
    parser.add_argument("--labs", default=None)
    parser.add_argument("--out", required=True)
    args = parser.parse_args(argv)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    stale = out / "problems.json"
    if stale.exists():
        stale.unlink()
    manifest = skillkit.load_manifest(__file__)
    rows, problems = collect_inputs(Path(args.measurements) if args.measurements else None)
    if problems:
        path = skillkit.write_problems(out, problems, TITLE, BOUNDARY.removeprefix("边界: "))
        path.write_text(_with_paper_card(path.read_text(encoding="utf-8")), encoding="utf-8")
        skillkit.write_result(out, manifest, {key: None for key in OUTPUT_KEYS.values()})
        return skillkit.EXIT_INPUT_PROBLEM
    medications = read_lines(Path(args.medications) if args.medications else None)
    labs = read_lines(Path(args.labs) if args.labs else None)
    text = render_report(rows, medications, labs)
    (out / "report.md").write_text(_with_paper_card(text), encoding="utf-8")
    skillkit.write_result(out, manifest, stability_outputs(rows))
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
