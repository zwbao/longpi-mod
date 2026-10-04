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



from presets import DEMENTIA_CODES, hfrs_bin, match_condition


def conditions(rows):
    found = {}
    order = []
    supplied = None
    for row in rows:
        low = {(k or "").strip().lower(): (v or "").strip() for k, v in row.items() if k}
        name = low.get("item") or low.get("name") or low.get("code") or ""
        value = low.get("value") if "value" in low else ""
        if not name:
            continue
        if name.casefold() in {"hfrs", "医院衰弱风险分"}:
            supplied = as_float(value)
            continue
        number = as_float(value)
        if number is not None and number == 0:
            continue
        hit = match_condition(name)
        if hit is None:
            continue
        code, weight, zh = hit
        if code in found:
            continue
        found[code] = (weight, zh)
        order.append(code)
    hits = [(code, found[code][0], found[code][1]) for code in order]
    return hits, supplied


def opening(rows):
    hits, supplied = conditions(rows)
    if hits:
        total = sum(weight for _code, weight, _zh in hits)
        text = f"这次按诊断权重加成 {total:.1f}，落在「{hfrs_bin(total)}」组。"
        dementia = sum(weight for code, weight, _zh in hits if code in DEMENTIA_CODES)
        if dementia:
            rest = total - dementia
            text += f"去掉痴呆相关编码后是 {rest:.1f}，落在「{hfrs_bin(rest)}」组。"
        return text
    if supplied is None:
        return "没有对上诊断编码，也没有现成的医院衰弱风险分，所以这次没有分组。"
    return f"这次没有对上诊断编码，所以按你给出的医院衰弱风险分放到「{hfrs_bin(supplied)}」组。"


def method_lines(rows):
    hits, supplied = conditions(rows)
    lines = ["## 方法算出的名单", ""]
    if hits:
        for _code, weight, zh in hits:
            lines.append(f"- {zh}：{weight:.1f}。")
        return lines
    label = hfrs_bin(supplied) if supplied is not None else None
    for name in ("低", "中间", "高"):
        if name == label:
            lines.append(f"- {name}：这次落在这里。")
        else:
            lines.append(f"- {name}")
    return lines


def known_names(rows):
    hits, _supplied = conditions(rows)
    return {zh for _code, _weight, zh in hits}


def render(meds, labs, rows):
    lines = ["# 医院衰弱风险分组", "", opening(rows), ""]
    lines.extend(method_lines(rows))
    lines.extend(["", *medication_lines(meds, known_names(rows))])
    lines.extend(["", *lab_lines(labs)])
    return finish(lines)


TITLE = "医院衰弱风险分组"
SCORE_KEY = "hfrs"
# Words in the value column of a diagnosis row. Before the kit any value but
# 0 counted as present, "否" included; an explicit no now counts as absent.
NO_WORDS = {"no", "n", "false", "否", "无", "没有"}


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
    by skillkit. A code,value table is read as conditions() read it. A path
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
    try:
        table = read_rows(path)
    except csv.Error:
        # One column (a list of codes) defeats the sniffer; read it line by line.
        lines = [line.strip() for line in text.splitlines() if line.strip() and not line.strip().startswith("#")]
        return [
            {"item": parts[0], "value": parts[1] if len(parts) > 1 else "", "unit": parts[2] if len(parts) > 2 else ""}
            for parts in ([part.strip() for part in re.split(r"[,\t，]", line)] for line in lines)
        ]
    for row in table:
        low = {(k or "").strip().lower(): (v or "").strip() for k, v in row.items() if k}
        rows.append({"item": low.get("item") or low.get("name") or low.get("code") or "", "value": low.get("value", ""), "unit": ""})
    return rows


def _is_score_row(name, manifest):
    spec = skillkit.spec_by_key(manifest, SCORE_KEY)
    names = {skillkit.fold_name(item) for item in [spec["key"], spec.get("label_zh", ""), *spec.get("aliases", [])] if item}
    return any(variant in names for variant in skillkit.name_variants(name))


def _presence(value):
    """The value of a diagnosis row as skillkit reads it: a number stays a number."""
    text = value.strip()
    if text.lower() in NO_WORDS:
        return "0"
    try:
        skillkit.parse_number(text)
    except ValueError:
        return "1"
    return text


def collect_inputs(measurements):
    """Read diagnosis rows and a ready-made score through skill.json.

    A row whose name match_condition() recognizes (a Supplementary Table 18
    code such as F00.1, or its name) is read as that three-character code
    with a 0 or 1 value; an empty value or a yes-word means present, as
    before. Returns the rows conditions() reads, rebuilt from the checked
    values, and the problems that stop the grouping: a unit, a value outside
    its range, a score that is not a number, a row given twice with
    different values. Nothing is required: without codes or a score the
    report says there is no group, as before.
    """
    manifest = skillkit.load_manifest(__file__)
    rows = []
    for row in measurement_rows(measurements):
        if not _is_score_row(row["item"], manifest):
            hit = match_condition(row["item"])
            if hit is not None:
                row = {**row, "item": hit[0], "value": _presence(row["value"])}
        rows.append(row)
    collected = skillkit.collect_measurements(rows, manifest)
    rebuilt = [{"item": key, "value": "1"} for key, value in collected.values.items() if key != SCORE_KEY and value != 0]
    if SCORE_KEY in collected.values:
        rebuilt.append({"item": SCORE_KEY, "value": repr(collected.values[SCORE_KEY])})
    return rebuilt, list(collected.problems)


def scores(rows):
    """The sums and groups opening() prints, from the unchanged conditions()."""
    hits, supplied = conditions(rows)
    found = {"hfrs_score": None, "hfrs_group": None, "hfrs_score_without_dementia": None, "hfrs_group_without_dementia": None}
    if hits:
        total = sum(weight for _code, weight, _zh in hits)
        found.update(hfrs_score=total, hfrs_group=hfrs_bin(total))
        dementia = sum(weight for code, weight, _zh in hits if code in DEMENTIA_CODES)
        if dementia:
            found.update(hfrs_score_without_dementia=total - dementia, hfrs_group_without_dementia=hfrs_bin(total - dementia))
    elif supplied is not None:
        found.update(hfrs_score=supplied, hfrs_group=hfrs_bin(supplied))
    return found


def report(out, meds, labs, measurements):
    out.mkdir(parents=True, exist_ok=True)
    stale = out / "problems.json"
    if stale.exists():
        stale.unlink()
    manifest = skillkit.load_manifest(__file__)
    rows, problems = collect_inputs(measurements)
    if problems:
        path = skillkit.write_problems(out, problems, TITLE, BOUNDARY)
        text = path.read_text(encoding="utf-8").replace(
            "这次没有计算。原因如下：", "输入没有通过检查，所以这次没有分组。原因如下："
        )
        path.write_text(_with_paper_card(text), encoding="utf-8")
        skillkit.write_result(out, manifest, {item["key"]: None for item in manifest["outputs"]})
        return path
    path = write_report(out, render(load_meds(meds), labs, rows))
    skillkit.write_result(out, manifest, scores(rows))
    return path


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--measurements", type=Path)
    parser.add_argument("--medications", type=Path)
    parser.add_argument("--labs", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    print(report(args.out, args.medications, args.labs, args.measurements))
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
