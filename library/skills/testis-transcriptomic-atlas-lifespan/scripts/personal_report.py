#!/usr/bin/env python3
"""Personal readout. Published numbers live in presets.py."""

from __future__ import annotations

import skillkit
from paper_card import lines as paper_card_lines


import csv
import re
from pathlib import Path

from presets import BOUNDARY


def read_rows(path):
    if path is None:
        return []
    with path.open(encoding="utf-8-sig", newline="") as handle:
        sample = handle.read(4096)
        handle.seek(0)
        if not sample.strip():
            return []
        dialect = csv.Sniffer().sniff(sample, delimiters=",\t")
        return list(csv.DictReader(handle, dialect=dialect))


def load_kv(path):
    rows = read_rows(path)
    out = {}
    if not rows:
        return out
    fields = {name.strip().lower(): name for name in rows[0].keys() if name}
    if "item" in fields and "value" in fields:
        for row in rows:
            key = (row.get(fields["item"]) or "").strip()
            if key:
                out[key] = (row.get(fields["value"]) or "").strip()
        return out
    if "gene" in fields:
        value_key = "value" if "value" in fields else ("expression" if "expression" in fields else None)
        for row in rows:
            key = (row.get(fields["gene"]) or "").strip()
            if key and value_key:
                out[key] = (row.get(fields[value_key]) or "").strip()
        return out
    if len(rows) == 1:
        return {key.strip(): (value or "").strip() for key, value in rows[0].items() if key}
    return out


def load_meds(path):
    if path is None:
        return []
    names = []
    for line in path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            names.append(text)
    return names


def lab_lines(path):
    rows = read_rows(path)
    lines = ["## 体检", ""]
    if not rows:
        lines.append("没有提供体检。体检不增删方法算出的名单。")
        return lines
    lines.append("下面照录体检数值。体检不增删方法算出的名单。")
    for row in rows:
        lowered = { (k or "").strip(): (v or "").strip() for k, v in row.items() }
        item = lowered.get("项目") or lowered.get("item") or ""
        value = lowered.get("结果") or lowered.get("value") or lowered.get("result") or ""
        unit = lowered.get("单位") or lowered.get("unit") or ""
        if item and value:
            suffix = f" {unit}" if unit else ""
            lines.append(f"- {item} {value}{suffix}")
        else:
            bits = [f"{key} {value}".strip() for key, value in lowered.items() if key and value]
            if bits:
                lines.append("- " + "，".join(bits))
    return lines


def medication_lines(meds, names):
    lines = ["## 你正在使用的药", ""]
    if not meds:
        lines.append("没有提供现用药。不能据此停。")
        return lines
    known = {name.casefold() for name in names}
    for name in meds:
        if name.casefold() in known:
            lines.append(f"- {name}：这个名字出现在名单里。不能据此停。")
        else:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def write_report(out, text):
    out.mkdir(parents=True, exist_ok=True)
    path = out / "report.md"
    if not text.endswith("\n"):
        text += "\n"
    path.write_text(_with_paper_card(text), encoding="utf-8")
    return path


def finish(lines):
    lines.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def as_float(text):
    if text is None:
        return None
    raw = str(text).strip().replace("＋", "+").replace("－", "-")
    if raw == "":
        return None
    try:
        return float(raw)
    except ValueError:
        return None



SAMPLE_MEASUREMENTS = """item,value
bmi,31
"""

TITLE = "# 睾丸衰老阶段"

def decade_label(age):
    if age is None:
        return None
    if 21 <= age <= 29:
        return "20多岁"
    if 30 <= age <= 39:
        return "30多岁"
    if 40 <= age <= 49:
        return "40多岁"
    if 50 <= age <= 59:
        return "50多岁"
    if 60 <= age <= 69:
        return "60多岁"
    return None


def list_names(kv):
    return ["管周细胞", "莱迪希细胞", "巨噬细胞"]


def method_lines(kv, age, rows=None):
    del rows
    from presets import BMI_CUT, FIG6C_AGE
    lines = [
        "## 方法算出的名单",
        "",
        "- 管周细胞。论文写 30多岁出现细胞外基质和 Notch 变化。",
        "- 莱迪希细胞。论文写 50多岁类固醇代谢改变。",
        "- 巨噬细胞。论文写 50多岁免疫反应改变。",
    ]
    label = decade_label(age)
    bmi = as_float(kv.get("bmi"))
    if label is None:
        return "这次没有落在图谱年龄范围内的年龄，所以没有对照衰老阶段。", lines
    intro = f"这次按年龄把你放在{label}这一组。"
    if bmi is not None:
        intro += (
            f"体质指数是 {bmi:g}。论文把大于 {FIG6C_AGE:g} 岁并且体质指数至少 {BMI_CUT:g} 写成生育力的一个风险因素。这不是诊断。"
        )
        if age > FIG6C_AGE and bmi >= BMI_CUT:
            intro += "按这句写法，年龄和体质指数同时落在里面。"
        else:
            intro += "按这句写法，没有同时落在里面。"
    return intro, lines


def extra_checks(text):
    from presets import DONORS, GROUP_N
    assert sum(GROUP_N.values()) == DONORS == 35
    assert "管周细胞" in text and "莱迪希细胞" in text
    assert "30多岁" in text
    assert "50多岁" in text
    assert "8000" not in text


def render(age, meds, labs, measurements):
    return render_values(age, meds, labs, load_kv(measurements))


def render_values(age, meds, labs, kv):
    intro, listed = method_lines(kv, age)
    lines = [TITLE, "", intro, ""]
    lines.extend(listed)
    lines.extend(["", *medication_lines(meds, list_names(kv))])
    lines.extend(["", *lab_lines(labs)])
    return finish(lines)


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

    A file whose first line names a name column and a value column
    (item,value,unit as skill.json declares, or the older item,value) is read
    by skillkit. The other layouts load_kv() reads (a gene column, or one wide
    row) become rows without a unit. A path that does not exist counts as no
    measurements.
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
    return [{"item": key, "value": value, "unit": ""} for key, value in load_kv(path).items()]


def collect_inputs(measurements, age):
    """Read BMI and --age through skill.json: names, units, and ranges.

    Returns (BMI or None, problems). A missing age, a unit that cannot be
    converted, a value out of range, a value that is not a number or a
    duplicated row is a problem. BMI is optional, as before.
    """
    manifest = skillkit.load_manifest(__file__)
    collected = skillkit.collect_measurements(measurement_rows(measurements), manifest)
    problems = list(collected.problems) + skillkit.check_scalar(manifest, "age", age)
    return collected.values.get("bmi"), problems


def age_bmi_statement(age, bmi):
    """是 or 否 for the Fig. 6c sentence method_lines() checks, or None when it does not check it."""
    from presets import BMI_CUT, FIG6C_AGE
    if decade_label(age) is None or bmi is None:
        return None
    return "是" if age > FIG6C_AGE and bmi >= BMI_CUT else "否"


def report(out, meds, labs, measurements, age=None):
    out.mkdir(parents=True, exist_ok=True)
    stale = out / "problems.json"
    if stale.exists():
        stale.unlink()
    manifest = skillkit.load_manifest(__file__)
    bmi, problems = collect_inputs(measurements, age)
    if problems:
        path = skillkit.write_problems(out, problems, TITLE.removeprefix("# "), BOUNDARY)
        text = path.read_text(encoding="utf-8").replace(
            "这次没有计算。原因如下：", "输入没有通过检查，所以没有对照衰老阶段。原因如下："
        )
        path.write_text(_with_paper_card(text), encoding="utf-8")
        skillkit.write_result(out, manifest, {"age_group": None, "age_over_45_and_bmi_30": None})
        return path
    kv = {} if bmi is None else {"bmi": repr(bmi)}
    path = write_report(out, render_values(age, load_meds(meds), labs, kv))
    skillkit.write_result(out, manifest, {
        "age_group": decade_label(age),
        "age_over_45_and_bmi_30": age_bmi_statement(age, bmi),
    })
    return path


def main(argv=None):
    import argparse
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
