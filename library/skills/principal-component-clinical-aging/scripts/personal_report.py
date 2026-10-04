#!/usr/bin/env python3
from __future__ import annotations

import skillkit
from paper_card import lines as paper_card_lines


import argparse
import re
from pathlib import Path

from presets import BOUNDARY


def load_lines(path):
    if path is None:
        return []
    rows = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            rows.append(text)
    return rows


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
            parts = text.split()
        if len(parts) < 2:
            continue
        name, raw = parts[0], parts[1]
        unit = parts[2] if len(parts) > 2 else ""
        try:
            value = float(raw)
        except ValueError:
            continue
        found.append((name, value, unit))
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
        lines.append(f"- {name} {value:g}{unit_bit}")
    return lines

from presets import (
    ACR_MICROALBUMINURIA,
    COMORBIDITIES,
    comorbidity_index,
    self_health_index,
    smoking_score,
)


def parse_measurements(path):
    data = {"comorbidities": []}
    if path is None:
        return data
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if not text or text.startswith("#"):
            continue
        if text.lower().startswith("comorbidity=") or text.startswith("并存病="):
            data["comorbidities"].append(text.split("=", 1)[1].strip())
            continue
        if "=" not in text:
            continue
        key, raw = text.split("=", 1)
        data[key.strip()] = raw.strip()
    return data


def as_float(data, key):
    if key not in data:
        return None
    return float(data[key])


def medication_lines(names, present_labels):
    lines = ["## 你正在使用的药", ""]
    if not names:
        lines.append("没有提供现用药。")
        return lines
    for name in names:
        if name in present_labels:
            lines.append(f"- {name}：这个名字出现在方法名单里。不能据此停。")
        else:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def render(age, meds, labs, measurements):
    return render_data(age, meds, labs, parse_measurements(measurements))


def render_data(age, meds, labs, data):
    del age
    labels = {key: label for key, label in COMORBIDITIES}
    index, present = comorbidity_index(data["comorbidities"])
    present_labels = [labels[key] for key in present]
    cotinine = as_float(data, "cotinine_ng_ml")
    acr = as_float(data, "acr_mg_g")
    keys = ("fair_general_health", "poor_general_health", "better_current_health", "worse_current_health")
    health = self_health_index(*(float(data[k]) for k in keys)) if all(k in data for k in keys) else None
    if present_labels:
        lead = f"按你点名的并存病算出了指数，是 {index:.4f}。"
    else:
        lead = "没有给出这二十二种并存病里的名字，所以没有指数。"
    lines = ["# 临床指数", "", lead, "", "## 方法算出的名单", ""]
    if present_labels:
        for label in present_labels:
            lines.append(f"- {label}")
        lines.append(f"- 并存病指数：{index:.4f}")
    else:
        lines.append("名单是空的。")
    if cotinine is not None:
        score, label = smoking_score(cotinine)
        lines.append(f"- 可替宁 {cotinine:g} ng/ml，吸烟分档 {score}（{label}）。")
    if health is not None:
        lines.append(f"- 自评健康指数：{health:g}。")
    if acr is not None:
        flag = "达到" if acr >= ACR_MICROALBUMINURIA else "没有达到"
        lines.append(f"- 尿白蛋白肌酐比 {acr:g} mg/g，{flag} {ACR_MICROALBUMINURIA:g} mg/g。")
    huq = as_float(data, "huq050")
    if huq is None:
        huq = as_float(data, "healthcare_use")
    if huq is not None:
        lines.append(f"- 就医使用指数：{huq:g}。这是 HUQ050 的编码，没有再换算。")
    lines.extend(["", *medication_lines(load_lines(meds), present_labels)])
    lines.extend(["", *lab_lines(labs), "", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


TITLE = "临床指数"
SELF_HEALTH_KEYS = ("fair_general_health", "poor_general_health", "better_current_health", "worse_current_health")
NUMBER_KEYS = ("cotinine_ng_ml", "acr_mg_g", *SELF_HEALTH_KEYS, "huq050")


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
    declares) is read by skillkit; a comorbidity row carries 1 when present
    and 0 when not. The documented key=value lines are read as
    parse_measurements() read them: comorbidity=X (or 并存病=X) is a row for X
    with the value 1, key=value is a row for key, and other lines are left out.
    A path that does not exist counts as no measurements.
    """
    if path is None or not Path(path).exists():
        return []
    path = Path(path)
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
        if line.lower().startswith("comorbidity=") or line.startswith("并存病="):
            rows.append({"item": line.split("=", 1)[1].strip(), "value": "1", "unit": ""})
            continue
        if "=" not in line:
            continue
        key, raw = line.split("=", 1)
        rows.append({"item": key.strip(), "value": raw.strip(), "unit": ""})
    return rows


def comorbidity_names(manifest):
    """skill.json key -> the name comorbidity_index() reads, for the 22 comorbidities."""
    index = skillkit.alias_index(skillkit.input_specs(manifest))
    return {index[skillkit.fold_name(key)][0]["key"]: key for key, _label in COMORBIDITIES}


def collect_inputs(measurements, age):
    """Read the measurement rows and --age through skill.json: names, units, ranges.

    Returns the mapping render_data() reads (the comorbidity list and the
    numbers as text) and the problems that stop the report: a unit that
    cannot be converted, an ACR row without a unit, a value out of range, a
    value that is not a number, a duplicated row, an age out of range.
    Everything is optional, as before: an index whose inputs are missing is
    not computed and the report says so.
    """
    manifest = skillkit.load_manifest(__file__)
    collected = skillkit.collect_measurements(measurement_rows(measurements), manifest)
    problems = list(collected.problems) + skillkit.check_scalar(manifest, "age", age)
    names = comorbidity_names(manifest)
    data = {"comorbidities": [name for key, name in names.items() if collected.values.get(key)]}
    for key in NUMBER_KEYS:
        if key in collected.values:
            data[key] = repr(collected.values[key])
    return data, problems


def indices(data):
    """The numbers render_data() prints, computed by the unchanged preset functions."""
    index, present = comorbidity_index(data["comorbidities"])
    cotinine = as_float(data, "cotinine_ng_ml")
    acr = as_float(data, "acr_mg_g")
    health = None
    if all(key in data for key in SELF_HEALTH_KEYS):
        health = self_health_index(*(float(data[key]) for key in SELF_HEALTH_KEYS))
    return {
        "comorbidity_index": index if present else None,
        "smoking_score": smoking_score(cotinine)[0] if cotinine is not None else None,
        "self_health_index": health,
        "acr_at_least_30": None if acr is None else ("达到" if acr >= ACR_MICROALBUMINURIA else "没有达到"),
    }


def report(out, age, medications, labs, measurements=None):
    out.mkdir(parents=True, exist_ok=True)
    stale = out / "problems.json"
    if stale.exists():
        stale.unlink()
    manifest = skillkit.load_manifest(__file__)
    data, problems = collect_inputs(measurements, age)
    if problems:
        path = skillkit.write_problems(out, problems, TITLE, BOUNDARY)
        text = path.read_text(encoding="utf-8").replace(
            "这次没有计算。原因如下：", "输入没有通过检查，所以这次没有算指数。原因如下："
        )
        path.write_text(_with_paper_card(text), encoding="utf-8")
        skillkit.write_result(out, manifest, {item["key"]: None for item in manifest["outputs"]})
        return path
    path = out / "report.md"
    path.write_text(_with_paper_card(render_data(age, medications, labs, data)), encoding="utf-8")
    skillkit.write_result(out, manifest, indices(data))
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
