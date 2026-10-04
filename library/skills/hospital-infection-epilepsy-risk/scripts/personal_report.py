#!/usr/bin/env python3
from __future__ import annotations

import skillkit
from paper_card import lines as paper_card_lines


import argparse
import re
import sys
from pathlib import Path

from presets import BOUNDARY

LAB_NAMES = ("谷丙转氨酶", "谷草转氨酶", "肌酐", "肾小球滤过率", "血红蛋白", "血小板")


def load_measurements(path):
    if path is None:
        return {}
    text = path.read_text(encoding="utf-8")
    rows = {}
    lines = [line for line in text.splitlines() if line.strip() and not line.strip().startswith("#")]
    if not lines:
        return rows
    start = 1 if "," in lines[0] and lines[0].split(",")[0].strip().lower() in {"name", "项目", "key"} else 0
    for line in lines[start:]:
        if "," not in line:
            continue
        key, value = line.split(",", 1)
        rows[key.strip()] = value.strip()
    return rows


def load_medications(path):
    if path is None:
        return []
    names = []
    for line in path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            names.append(text)
    return names


def parse_labs(path):
    if path is None:
        return []
    text = path.read_text(encoding="utf-8")
    found = []
    lines = text.splitlines()
    if lines and "项目" in lines[0] and "," in lines[0]:
        import csv
        for row in csv.DictReader(lines):
            name = (row.get("项目") or row.get("name") or "").strip()
            value = (row.get("结果") or row.get("value") or "").strip()
            unit = (row.get("单位") or row.get("unit") or "").strip()
            if name:
                found.append((name, value, unit))
        return found
    for marker in LAB_NAMES:
        if marker in text:
            found.append((marker, "", ""))
    return found


def medication_lines(medications, list_lines):
    lines = ["## 你正在使用的药", ""]
    if not medications:
        lines.append("没有提供现用药。")
        return lines
    blob = "\n".join(list_lines)
    for name in medications:
        if name and name in blob:
            lines.append(f"- {name}：这个名字出现在方法名单里。不能据此停。")
        else:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def lab_block(labs):
    rows = ["## 体检", ""]
    if not labs:
        rows.append("没有提供体检。体检不增删方法算出的名单。")
        return rows
    rows.append("下面照录体检数值。体检不增删方法算出的名单。")
    for name, value, unit in labs:
        shown = " ".join(part for part in (name, value, unit) if part)
        rows.append(f"- {shown}")
    return rows

from presets import JOINT_CVD_HISTORY, JOINT_CVD_PRS, JOINT_CVD_SCORE, SITES, WINDOWS


def window_key(years: float) -> str:
    if years < 1:
        return "<1"
    if years <= 3:
        return ">1-3"
    if years <= 5:
        return ">3-5"
    if years <= 10:
        return ">5-10"
    return ">10"


def build(values, age):
    del age
    cohort = values.get("cohort", "ukb").strip().lower()
    if cohort not in WINDOWS:
        cohort = "ukb"
    lines = []
    if "years" in values:
        years = float(values["years"])
        key = window_key(years)
        point, low, high = WINDOWS[cohort][key]
        label = "英国生物银行" if cohort == "ukb" else "瑞典登记"
        lines.append(
            f"{len(lines)+1}. {label}，感染距指数日 {key} 年。Fig. 1 的比值比是 {point:.2f}（95% CI {low:.2f}–{high:.2f}）。这是队列比值比，不是个人发病概率。"
        )
    site = values.get("site", "").strip().lower()
    if site in SITES.get(cohort, {}):
        point, low, high, name = SITES[cohort][site]
        lines.append(
            f"{len(lines)+1}. {name}。结果段的比值比是 {point:.2f}（95% CI {low:.2f}–{high:.2f}）。这不按时间窗分层。"
        )
    flag = values.get("cvd_prs", "").strip().lower()
    if flag in {"high", "高"} and cohort == "ukb":
        point, low, high = JOINT_CVD_PRS
        lines.append(
            f"{len(lines)+1}. 感染并且心血管多基因风险为高。英国生物银行的联合比值比是 {point:.2f}（95% CI {low:.2f}–{high:.2f}）。"
        )
    if values.get("cvd_score", "").strip().lower() in {"high", "高"} and cohort == "ukb":
        point, low, high = JOINT_CVD_SCORE
        lines.append(
            f"{len(lines)+1}. 感染并且心血管风险评分为高。英国生物银行的联合比值比是 {point:.2f}（95% CI {low:.2f}–{high:.2f}）。"
        )
    if values.get("cvd_history", "").strip().lower() in {"yes", "y", "1", "有"} and cohort == "sweden":
        point, low, high = JOINT_CVD_HISTORY
        lines.append(
            f"{len(lines)+1}. 感染并且有心血管病史。瑞典登记的联合比值比是 {point:.2f}（95% CI {low:.2f}–{high:.2f}）。"
        )
    if lines:
        intro_text = "这次按你给出的时间窗或部位，对照论文里对应的一条队列比值比。几条比值比没有相乘。"
    else:
        intro_text = "这次没有给出感染距指数日的年数或可对照的部位，所以没有队列比值比可放在你的记录旁边。"
    if site and site not in SITES.get(cohort, {}):
        intro_text += "这个部位在所选队列里没有单独的比值比，所以没有写入名单。"
    intro = ("# 感染与晚年癫痫", intro_text)
    return lines, [], intro


def render(list_lines, notes, meds, labs, intro):
    del notes
    body = [intro[0], "", intro[1], "", "## 方法算出的名单"]
    body.extend(list_lines or ["没有项目进入名单。"])
    body.extend(["", *medication_lines(meds, list_lines)])
    body.extend(["", *lab_block(labs)])
    body.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(body) + "\n"


TITLE = "感染与晚年癫痫"
# Inputs build() reads as words, not numbers. skillkit only reads numbers, so
# these rows are matched through skill.json here and passed on as text.
TEXT_KEYS = ("site", "cohort", "cvd_prs", "cvd_score", "cvd_history")


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

    A file whose first line is a header (name,value as documented, or
    name,value,unit as skill.json declares) is read by skillkit. A file
    without one is read line by line, as load_measurements() read it:
    name,value, now with an optional unit. A path that does not exist counts
    as no measurements.
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


def collect_inputs(measurements, age):
    """Read the measurement rows and --age through skill.json.

    Returns the name -> text mapping build() reads and the problems that stop
    the lookup. The years go through skillkit (unit, range, a number, not
    twice). The word inputs are matched by the names skill.json lists; a word
    given twice with different values is a problem, and so is a cohort other
    than the two the paper has. An unknown site is not a problem: the report
    says it has no ratio, as before.
    """
    manifest = skillkit.load_manifest(__file__)
    index = skillkit.alias_index(skillkit.input_specs(manifest))
    numbers, words, problems = [], {}, []
    for row in measurement_rows(measurements):
        hit = next((index[name] for name in skillkit.name_variants(row["item"]) if name in index), None)
        key = hit[0]["key"] if hit else None
        if key not in TEXT_KEYS:
            numbers.append(row)
            continue
        value = row["value"].strip()
        if not value:
            continue
        label = hit[0]["label_zh"]
        if key in words and words[key].strip().lower() != value.lower():
            problems.append(skillkit.Problem(key, label, "duplicate", f"{label} 出现了两次，写法不同（{words[key]} 和 {value}）。请只保留一次。"))
            continue
        words[key] = value
    collected = skillkit.collect_measurements(numbers, manifest)
    problems += collected.problems
    problems += skillkit.check_scalar(manifest, "age", age)
    cohort = words.get("cohort")
    if cohort is not None and cohort.strip().lower() not in WINDOWS:
        label = skillkit.spec_by_key(manifest, "cohort")["label_zh"]
        problems.append(skillkit.Problem("cohort", label, "parse", f"{label} 写成「{cohort}」。只收 {'、'.join(WINDOWS)}。"))
    values = dict(words)
    if "years" in collected.values:
        values["years"] = repr(collected.values["years"])
    return values, problems


def report(out, measurements=None, medications=None, labs=None, age=None):
    out.mkdir(parents=True, exist_ok=True)
    stale = out / "problems.json"
    if stale.exists():
        stale.unlink()
    manifest = skillkit.load_manifest(__file__)
    values, problems = collect_inputs(measurements, age)
    if problems:
        destination = skillkit.write_problems(out, problems, TITLE, BOUNDARY)
        text = destination.read_text(encoding="utf-8").replace(
            "这次没有计算。原因如下：", "输入没有通过检查，所以这次没有对照论文里的比值比。原因如下："
        )
        destination.write_text(_with_paper_card(text), encoding="utf-8")
        skillkit.write_result(out, manifest, {"infection_window": None})
        return destination
    list_lines, notes, intro = build(values, age)
    text = render(list_lines, notes, load_medications(medications), parse_labs(labs), intro)
    destination = out / "report.md"
    destination.write_text(_with_paper_card(text), encoding="utf-8")
    window = window_key(float(values["years"])) if "years" in values else None
    skillkit.write_result(out, manifest, {"infection_window": window})
    return destination


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--measurements", type=Path, default=None)
    parser.add_argument("--medications", type=Path, default=None)
    parser.add_argument("--labs", type=Path, default=None)
    parser.add_argument("--age", type=float, default=None)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    print(report(args.out, args.measurements, args.medications, args.labs, args.age))
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
