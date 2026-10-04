#!/usr/bin/env python3
"""Epigenetic frailty risk score from the 20 CpG coefficients in Li et al. Fig. 4.

Rows are read through skill.json by skillkit: a beta outside 0 to 1, a frailty
index outside 0 to 1, a deficit count above 31 or 33, a unit that is not a beta,
or an unparsable or duplicated row stops the computation (exit code 3).
"""
from __future__ import annotations

import skillkit
from paper_card import lines as paper_card_lines


import argparse
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

from presets import ESTHER_DEFICITS, KORA_DEFICITS, EFRS, efrs, frailty_band, frailty_proportion

SITES = [site for site, _coef in EFRS if site != "intercept"]
DEFICIT_TOTALS = {"esther_deficits": ESTHER_DEFICITS, "kora_deficits": KORA_DEFICITS}


def _is_header(line):
    cells = line.split("\t") if "\t" in line else line.split(",")
    folded = {skillkit.fold_name(cell) for cell in cells}
    names = {skillkit.fold_name(name) for name in skillkit.NAME_COLUMNS}
    values = {skillkit.fold_name(name) for name in skillkit.VALUE_COLUMNS}
    return bool(folded & names) and bool(folded & values)


def legacy_rows(path):
    """Rows of the headerless betas.tsv: ``cg位点 β`` lines, ``fi=``, ``esther_deficits=``, ``kora_deficits=``.

    Returns None when the file starts with a header such as marker,value,unit;
    skillkit reads that table itself.
    """
    if path is None:
        return None
    text = Path(path).read_text(encoding="utf-8-sig", errors="replace")
    lines = [line.strip() for line in text.splitlines()]
    lines = [line for line in lines if line and not line.startswith("#")]
    if lines and _is_header(lines[0]):
        return None
    rows = []
    for line in lines:
        if "=" in line:
            parts = [part.strip() for part in line.split("=", 1)]
        else:
            parts = line.split()
            if len(parts) == 1:
                parts = [part.strip() for part in line.split(",")]
        rows.append({"marker": parts[0], "value": parts[1] if len(parts) > 1 else ""})
    return rows


def collect_inputs(measurements, age):
    """Read the measurements through skill.json: names, units and ranges.

    Returns the collected rows (CpG betas, fi, deficit counts) and the problems
    that stop the computation. A missing CpG is not a problem here; the report
    says the sites are not complete, as before.
    """
    manifest = skillkit.load_manifest(__file__)
    rows = legacy_rows(measurements)
    if rows is None:
        collected = skillkit.collect_file(measurements, manifest)
    else:
        collected = skillkit.collect_measurements(rows, manifest)
    problems = [item for item in collected.problems if item.kind != "missing"]
    problems += [item for item in skillkit.check_scalar(manifest, "age", age) if item.kind != "missing"]
    return collected, problems


def frailty_index(values):
    """fi as given; otherwise the last deficit count divided by 31 or 33."""
    if "fi" in values:
        return values["fi"]
    counts = [key for key in values if key in DEFICIT_TOTALS]
    if not counts:
        return None
    return frailty_proportion(int(values[counts[-1]]), DEFICIT_TOTALS[counts[-1]])


def parse_betas(path):
    """CpG betas and the frailty index (problems dropped)."""
    collected, _problems = collect_inputs(path, None)
    betas = {site: collected.values[site] for site in SITES if site in collected.values}
    return betas, frailty_index(collected.values)


def medication_lines(names):
    sites = {site for site, _coef in EFRS if site != "intercept"}
    lines = ["## 你正在使用的药", ""]
    if not names:
        lines.append("没有提供现用药。")
        return lines
    for name in names:
        if name in sites:
            lines.append(f"- {name}：这个名字出现在方法名单里。不能据此停。")
        else:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def render(betas, fi, meds, labs, other_rows=False):
    """other_rows: the file had rows that name none of the 20 sites (other CpGs)."""
    score = efrs(betas) if betas else None
    if not betas and not other_rows:
        lead = "没有甲基化数值，所以没有风险分。"
    elif score is None:
        lead = "位点不全，或数值不在零到一之间，不算 eFRS。"
    else:
        lead = f"用你给的甲基化算出了风险分，是 {score:.4f}。"
    if fi is not None:
        lead += f"你给的衰弱指数是 {fi:.3f}，属于{frailty_band(fi)}。这不是风险分。"
    lines = ["# 衰弱风险分", "", lead, "", "## 方法算出的名单", ""]
    used = [site for site, _coef in EFRS if site != "intercept" and score is not None and site in betas]
    if not used:
        lines.append("这次没有用上位点。")
    else:
        for site in used:
            lines.append(f"- {site}：{betas[site]:g}")
    if score is not None:
        lines.append(f"- 风险分：{score:.4f}")
    lines.extend(["", *medication_lines(load_lines(meds)), "", *lab_lines(labs), "", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def report(out, age, medications, labs, measurements=None):
    out.mkdir(parents=True, exist_ok=True)
    stale = out / "problems.json"
    if stale.exists():
        stale.unlink()
    manifest = skillkit.load_manifest(__file__)
    collected, problems = collect_inputs(measurements, age)
    if problems:
        path = skillkit.write_problems(out, problems, "衰弱风险分", BOUNDARY)
        text = path.read_text(encoding="utf-8").replace(
            "这次没有计算。原因如下：", "输入没有通过检查，所以没有风险分。原因如下："
        )
        path.write_text(_with_paper_card(text), encoding="utf-8")
        skillkit.write_result(out, manifest, {item["key"]: None for item in manifest["outputs"]})
        return path
    betas = {site: collected.values[site] for site in SITES if site in collected.values}
    fi = frailty_index(collected.values)
    path = out / "report.md"
    path.write_text(
        _with_paper_card(render(betas, fi, medications, labs, bool(collected.unmatched))), encoding="utf-8"
    )
    skillkit.write_result(out, manifest, {
        "efrs": efrs(betas) if betas else None,
        "frailty_index": fi,
        "frailty_band": frailty_band(fi) if fi is not None else None,
    })
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
