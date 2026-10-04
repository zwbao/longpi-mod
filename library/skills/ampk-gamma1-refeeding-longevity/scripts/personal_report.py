#!/usr/bin/env python3
"""MPI from eight supplied domain points. Expression is not regressed."""

from __future__ import annotations

import argparse
import csv
import re
import unicodedata
from decimal import Decimal, InvalidOperation
from pathlib import Path

import skillkit
from paper_card import lines as paper_card_lines
from presets import BOUNDARY, DOMAINS, mpi_group

TITLE = "# 再喂食时的调节亚基与预后指数"
LABELS = {
    "MPI-1": "MPI-1（稳健）",
    "MPI-2": "MPI-2（衰弱前期）",
    "MPI-3": "MPI-3（衰弱）",
}
ALIASES = {
    "adl": "adl",
    "日常生活活动": "adl",
    "iadl": "iadl",
    "工具性日常生活活动": "iadl",
    "spmsq": "spmsq",
    "简易智力状态": "spmsq",
    "cirs_ci": "cirs_ci",
    "cirs": "cirs_ci",
    "累积疾病指数": "cirs_ci",
    "mna_sf": "mna_sf",
    "mna": "mna_sf",
    "简易营养评定": "mna_sf",
    "ess": "ess",
    "extonsmith": "ess",
    "nm": "nm",
    "用药种数": "nm",
    "social": "social",
    "社会支持": "social",
}


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
    name_key = fields.get("name") or fields.get("item") or fields.get("项目")
    value_key = fields.get("value") or fields.get("结果")
    if name_key and value_key:
        for row in rows:
            key = (row.get(name_key) or "").strip()
            if key:
                out[key] = (row.get(value_key) or "").strip()
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
        lowered = {(k or "").strip(): (v or "").strip() for k, v in row.items()}
        item = lowered.get("项目") or lowered.get("item") or ""
        value = lowered.get("结果") or lowered.get("value") or lowered.get("result") or ""
        unit = lowered.get("单位") or lowered.get("unit") or ""
        if item and value:
            suffix = f" {unit}" if unit else ""
            lines.append(f"- {item} {value}{suffix}")
    return lines


def medication_lines(meds):
    lines = ["## 你正在使用的药", ""]
    if not meds:
        lines.append("没有提供现用药。不能据此停。")
        return lines
    for name in meds:
        lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def as_decimal(text):
    raw = str(text).strip().replace("＋", "+").replace("－", "-")
    if raw == "":
        return None
    try:
        return Decimal(raw)
    except InvalidOperation:
        return None


def show_num(value: Decimal) -> str:
    text = format(value, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text


def collect_points(kv):
    found = {}
    bad = []
    for raw_key, raw_value in kv.items():
        folded = raw_key.strip().lower().replace(" ", "").replace("_", "")
        if raw_key.endswith("_raw") or raw_key.endswith("原始分"):
            continue
        domain = ALIASES.get(raw_key.strip()) or ALIASES.get(raw_key.strip().lower())
        if domain is None and folded in {key.replace("_", "") for key in ALIASES}:
            for alias, name in ALIASES.items():
                if alias.replace("_", "") == folded:
                    domain = name
                    break
        if domain is None:
            continue
        value = as_decimal(raw_value)
        if value is None:
            bad.append(domain)
            continue
        if domain in found and found[domain] != value:
            bad.append(domain)
            continue
        found[domain] = value
    return found, bad


def method_lines(kv):
    lines = ["## 方法算出的名单", ""]
    found, bad = collect_points(kv)
    missing = [label for key, label in DOMAINS if key not in found]
    if bad:
        lines.append("- 预后指数：有分项读不了或互相冲突，这次不算。")
        intro = "分项点数读不了，所以没有预后指数。"
    elif missing:
        lines.append("- 预后指数：缺 " + "、".join(missing) + " 的点数。不填零。")
        intro = "八个分项点数没有到齐，所以没有预后指数。"
    else:
        score = sum(found[key] for key, _label in DOMAINS) / Decimal(8)
        group = mpi_group(score)
        shown = show_num(score)
        if group in LABELS:
            lines.append(f"- 预后指数：{shown}，{LABELS[group]}。")
            intro = f"预后指数是 {shown}，{LABELS[group]}。"
        elif group == "cutoff_conflict":
            lines.append(f"- 预后指数：{shown}。方法段和图上对第三档起点的写法不一致，这次不分档。")
            intro = f"预后指数是 {shown}。第三档起点两处写法不一致，这次不分档。"
        elif group == "gap":
            lines.append(f"- 预后指数：{shown}。这个分数落在方法段相邻两档之间的空档，这次不分档。")
            intro = f"预后指数是 {shown}。它落在相邻两档之间的空档，这次不分档。"
        else:
            lines.append(f"- 预后指数：{shown}。它超出方法段写的零到一，这次不分档。")
            intro = f"预后指数是 {shown}。它超出零到一，这次不分档。"
    prkag1 = kv.get("prkag1") or kv.get("PRKAG1")
    if prkag1:
        lines.append(f"- PRKAG1：记下 {prkag1}。缺斜率和截距，不换成预后指数。")
    else:
        lines.append("- PRKAG1：缺 prkag1。即便有表达，也缺斜率和截距，不换成预后指数。")
    return intro, lines


def cannot_lines(kv):
    raws = [key for key in kv if key.endswith("_raw") or key.endswith("原始分")]
    extra = ""
    if raws:
        extra = "这次看到原始分：" + "、".join(raws) + "。"
    return [
        "## 这次算不了",
        "",
        "- 用 PRKAG1 表达预测指数。缺斜率和截距。补充表只有各年龄段人数。",
        f"- 原始量表分。图上有三档范围，补充表没有每一档的点数。{extra}",
    ]


def render(age, meds, labs, measurements):
    return render_values(age, meds, labs, load_kv(measurements))


def render_values(age, meds, labs, kv):
    intro, listed = method_lines(kv)
    if age is not None:
        intro = f"年龄记下了，不进入指数。{intro}"
    lines = [TITLE, "", intro, ""]
    lines.extend(listed)
    lines.extend(["", *cannot_lines(kv), "", *medication_lines(load_meds(meds)), "", *lab_lines(labs)])
    lines.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def _with_paper_card(text):
    if "## 论文卡片" in text:
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

    A file whose first line names a name column and a value column (name,value
    as documented, or name,value,unit as skill.json declares) is read by
    skillkit. The one wide row load_kv() also reads becomes rows without a
    unit. A path that does not exist counts as no measurements.
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


def _is_raw_score(name):
    """A raw scale score row, which cannot_lines() lists and nothing computes from."""
    name = name.strip()
    return name.endswith("_raw") or name.endswith("原始分") or "原始分" in name


def _typed(text):
    """The number as typed, the way skillkit parses it, for the Decimal arithmetic."""
    return unicodedata.normalize("NFKC", str(text)).strip()


def collect_inputs(measurements):
    """Read the eight domain points and PRKAG1 through skill.json: names, units, ranges.

    Returns the name -> text mapping method_lines() reads, and the problems
    that stop the index: a missing domain, a unit, a point outside 0 to 1, a
    value that is not a number, a domain given twice with different points.
    Raw scale scores (names ending in _raw or 原始分) stay out of the check and
    are only listed, as before.
    """
    manifest = skillkit.load_manifest(__file__)
    rows, raw = [], {}
    for row in measurement_rows(measurements):
        if _is_raw_score(row["item"]):
            raw[row["item"].strip()] = row["value"]
        else:
            rows.append(row)
    collected = skillkit.collect_measurements(rows, manifest)
    kv = {key: _typed(collected.sources[key]["value"]) for key in collected.values}
    kv.update(raw)
    return kv, list(collected.problems)


def mpi_score(kv):
    """The index method_lines() prints, as a Decimal, or None when a domain is missing."""
    found, bad = collect_points(kv)
    if bad or any(key not in found for key, _label in DOMAINS):
        return None
    return sum(found[key] for key, _label in DOMAINS) / Decimal(8)


def report(out, meds, labs, measurements, age=None):
    out.mkdir(parents=True, exist_ok=True)
    stale = out / "problems.json"
    if stale.exists():
        stale.unlink()
    manifest = skillkit.load_manifest(__file__)
    kv, problems = collect_inputs(measurements)
    problems += skillkit.check_scalar(manifest, "age", age)
    if problems:
        path = skillkit.write_problems(out, problems, TITLE.removeprefix("# "), BOUNDARY)
        text = path.read_text(encoding="utf-8").replace(
            "这次没有计算。原因如下：", "输入没有通过检查，所以没有预后指数。原因如下："
        )
        path.write_text(_with_paper_card(text), encoding="utf-8")
        skillkit.write_result(out, manifest, {"mpi": None, "mpi_group": None})
        return path
    path = out / "report.md"
    path.write_text(_with_paper_card(render_values(age, meds, labs, kv)), encoding="utf-8")
    score = mpi_score(kv)
    group = mpi_group(score) if score is not None else None
    skillkit.write_result(out, manifest, {
        "mpi": score,
        "mpi_group": group if group in LABELS else None,
    })
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


if __name__ == "__main__":
    raise SystemExit(main())
