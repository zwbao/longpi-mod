#!/usr/bin/env python3
"""epiTOC2 total stem-cell divisions (tnsc) from the coefficients in Duzhaozhen/OmniAge.

Measurements are ``name,value`` rows, comma or tab separated (the delimiter
rule of skillkit.read_rows), header optional. Probe names match without regard
to case. A blank, NA or nan value for a formula probe is skipped, as
OmniAgePy's ``EpiTOC2.predict`` skips NaN in its mean. A value that is not a
number, a beta outside 0 to 1, a probe listed twice, a row with no value
column, or an age that is not above zero stops the computation (exit code 3).
"""
from __future__ import annotations

import skillkit
from paper_card import lines as paper_card_lines


import argparse
import csv
import math
import sys
import unicodedata
from pathlib import Path

from presets import BOUNDARY

LAB_NAMES = ("谷丙转氨酶", "谷草转氨酶", "肌酐", "肾小球滤过率", "血红蛋白", "血小板")
TITLE = "干细胞分裂次数"

# Written-out missing values, compared after casefold. pandas reads these as NaN.
MISSING = {"", "na", "nan", "-nan", "n/a", "#n/a", "null", "none", "<na>"}
EXTRA_NAME_COLUMNS = ("probe", "cpg", "key", "id")
EXTRA_VALUE_COLUMNS = ("beta", "β")
SHOW = 5


def probe_key(name):
    return unicodedata.normalize("NFKC", str(name)).strip().casefold()


def _examples(items):
    shown = "、".join(items[:SHOW])
    return f"{shown} 等" if len(items) > SHOW else shown


def load_measurements(path):
    """(name, raw value, line number) rows and layout problems.

    The delimiter is a tab when the file has more tabs than commas, as in
    skillkit.read_rows. A first row whose first cell is not a cg probe is a
    header; its name and value columns are found by name, else columns 1 and 2.
    """
    if path is None:
        return [], []
    text = Path(path).read_text(encoding="utf-8-sig", errors="replace")
    numbered = [
        (number, line) for number, line in enumerate(text.splitlines(), 1)
        if line.strip() and not line.strip().startswith("#")
    ]
    if not numbered:
        return [], []
    sample = "\n".join(line for _number, line in numbered)[:2048]
    delimiter = "\t" if sample.count("\t") > sample.count(",") else ","
    table = list(csv.reader([line for _number, line in numbered], delimiter=delimiter))
    table = [[cell.strip() for cell in row] for row in table]
    name_col, value_col, start = 0, 1, 0
    first = table[0]
    if not first or not probe_key(first[0]).startswith("cg"):
        start = 1
        folded = [skillkit.fold_name(cell) for cell in first]
        names = {skillkit.fold_name(item) for item in skillkit.NAME_COLUMNS + EXTRA_NAME_COLUMNS}
        values = {skillkit.fold_name(item) for item in skillkit.VALUE_COLUMNS + EXTRA_VALUE_COLUMNS}
        name_col = next((i for i, cell in enumerate(folded) if cell in names), 0)
        value_col = next((i for i, cell in enumerate(folded) if cell in values), 1)
    rows = []
    single = []
    for (number, _line), row in zip(numbered[start:], table[start:]):
        name = row[name_col] if len(row) > name_col else ""
        if len(row) <= value_col:
            if probe_key(name).startswith("cg"):
                single.append(str(number))
            continue
        rows.append((name, row[value_col], number))
    problems = []
    if single:
        problems.append(skillkit.Problem(
            "measurements", "探针", "layout",
            f"第 {_examples(single)} 行只有一列，读不出 β 值。探针名和数值之间请用逗号或制表符分开。",
        ))
    return rows, problems


def collect(rows, age):
    """Betas of the formula probes, how many were skipped as missing, and problems."""
    formula = {probe for probe, _delta, _beta0 in EPITOC2}
    problems = []
    seen = set()
    duplicates = []
    unreadable = []
    outside = []
    values = {}
    missing = 0
    for name, raw, _number in rows:
        key = probe_key(name)
        if not key.startswith("cg"):
            continue
        if key in seen:
            if name not in duplicates:
                duplicates.append(name)
            continue
        seen.add(key)
        if key not in formula:
            continue
        if raw.strip().casefold() in MISSING:
            missing += 1
            continue
        try:
            value = skillkit.parse_number(raw)
        except ValueError:
            unreadable.append(f"{name}「{raw}」")
            continue
        if not 0.0 <= value <= 1.0:
            outside.append((name, value))
            continue
        values[key] = value
    if duplicates:
        problems.append(skillkit.Problem(
            "measurements", "探针", "duplicate",
            f"{len(duplicates)} 个探针出现了不止一次（不分大小写），例如 {_examples(duplicates)}。每个探针只保留一行。",
        ))
    if unreadable:
        problems.append(skillkit.Problem(
            "measurements", "探针", "parse",
            f"{len(unreadable)} 个探针的数值不是可以计算的数，例如 {_examples(unreadable)}。空白或 NA 这类缺失写法按缺失跳过，其他写法请改正。",
        ))
    if outside:
        shown = [f"{name}={value:g}" for name, value in outside]
        message = f"{len(outside)} 个探针的 β 值不在 0 到 1 之间，例如 {_examples(shown)}。"
        if any(value < 0 for _name, value in outside):
            message += "有负数，看起来像 M 值。"
        elif all(value <= 100 for _name, value in outside):
            message += "看起来像百分比（0–100）。"
        message += "这里要甲基化 β 值，在 0 到 1 之间。本技能不替你换算百分比或 M 值。"
        problems.append(skillkit.Problem("measurements", "探针", "range", message))
    if age is not None and not (math.isfinite(age) and age > 0):
        shown = f"年龄读成 {age:g}" if math.isfinite(age) else "年龄不是一个有限的数"
        problems.append(skillkit.Problem(
            "age", "年龄", "range",
            f"{shown}。irS 是总分裂数除以年龄，年龄要大于 0。",
        ))
    return values, missing, problems


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

from presets import EPITOC2, tnsc


def build(observed, age, missing=0):
    score, used = tnsc(observed)
    if score is not None and not math.isfinite(score):
        score = None
    lines = []
    if score is not None:
        line = f"1. epiTOC2。{len(EPITOC2)} 个探针里用了 {used} 个"
        if missing:
            line += f"，另有 {missing} 个在文件里是空值或 NA，按缺失跳过"
        line += f"。tnsc 是 {score:.4f}。"
        if used < 0.5 * len(EPITOC2):
            line += " 覆盖不到一半。R 入口在这个覆盖下不返回数值，这里仍按 Python 包用对上的探针取平均。"
        if age is not None and age > 0:
            line += f" irS = tnsc / {age:g} = {score / age:.4f}。"
        line += " 这不是克隆性造血或肿瘤的概率。克隆性造血在个人身上是用 DNMT3A、TET2、ASXL1 等基因的靶向测序测出来的，不由这个分数判断。"
        lines.append(line)
        intro_text = "这次按公式，用对上的探针算出总干细胞分裂数。"
    elif missing:
        intro_text = f"公式用到的探针在文件里有 {missing} 个，都是空值或 NA，所以没有总干细胞分裂数。"
    else:
        intro_text = "这次没有探针落在公式使用的位点上，所以没有总干细胞分裂数。"
    intro = (f"# {TITLE}", intro_text)
    return lines, [], intro


def render(list_lines, notes, meds, labs, intro):
    del notes
    body = [intro[0], "", intro[1], "", "## 方法算出的名单"]
    body.extend(list_lines or ["没有项目进入名单。"])
    body.extend(["", *medication_lines(meds, list_lines)])
    body.extend(["", *lab_block(labs)])
    body.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(body) + "\n"


def run(out, measurements=None, medications=None, labs=None, age=None):
    """Write out/report.md. Returns (path, exit code); 3 when the input was refused."""
    rows, problems = load_measurements(measurements)
    values, missing, more = collect(rows, age)
    problems += more
    if problems:
        path = skillkit.write_problems(out, problems, TITLE, BOUNDARY)
        return path, skillkit.EXIT_INPUT_PROBLEM
    list_lines, notes, intro = build(values, age, missing)
    text = render(list_lines, notes, load_medications(medications), parse_labs(labs), intro)
    out.mkdir(parents=True, exist_ok=True)
    destination = out / "report.md"
    destination.write_text(_with_paper_card(text), encoding="utf-8")
    return destination, 0


def report(out, measurements=None, medications=None, labs=None, age=None):
    return run(out, measurements, medications, labs, age)[0]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--measurements", type=Path, default=None)
    parser.add_argument("--medications", type=Path, default=None)
    parser.add_argument("--labs", type=Path, default=None)
    parser.add_argument("--age", type=float, default=None)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    path, code = run(args.out, args.measurements, args.medications, args.labs, args.age)
    print(path)
    return code



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
