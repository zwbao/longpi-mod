#!/usr/bin/env python3
"""Personal rMEQ score and chronotype category (Adan & Almirall 1991).

Reads the five item scores, checks each against the scores its options can
take, adds them (4-25) and names the published category. Writes out/report.md
and out/result.json, or out/problems.json and exit code 3.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import skillkit
from paper_card import lines as paper_card_lines
from presets import BOUNDARY, ITEMS, TITLE, TOTAL_MAX, TOTAL_MIN, category, total

SCORE_UNITS = {"分", "points", "point", "pts"}
MEANING = {
    "明确夜型": "你明显偏向晚睡晚起，状态最好的时段在一天的后半段。",
    "中度夜型": "你偏向晚睡晚起，状态更好的时段在下午和晚上。",
    "中间型": "你没有明显偏早或偏晚。",
    "中度晨型": "你偏向早睡早起，上午的状态更好。",
    "明确晨型": "你明显偏向早睡早起，状态最好的时段在一天的前半段。",
}


def has_header(line: str) -> bool:
    """True when the first line names a name column and a value column."""
    cells = {skillkit.fold_name(cell.strip().strip('"')) for cell in re.split(r"[,\t]", line)}
    names = {skillkit.fold_name(name) for name in skillkit.NAME_COLUMNS}
    values = {skillkit.fold_name(name) for name in skillkit.VALUE_COLUMNS}
    return bool(cells & names) and bool(cells & values)


def _cell(row: dict, columns) -> str:
    folded = {skillkit.fold_name(key): value for key, value in row.items()}
    for name in columns:
        value = folded.get(skillkit.fold_name(name))
        if value is not None:
            return value
    return ""


def measurement_rows(path: Path | None) -> list[dict]:
    """Rows as item/value/unit: a file with an item,value,unit header, or name,value lines."""
    if path is None:
        return []
    text = Path(path).read_text(encoding="utf-8-sig", errors="replace")
    lines = [line.strip() for line in text.splitlines() if line.strip() and not line.strip().startswith("#")]
    if lines and has_header(lines[0]):
        return [{"item": _cell(row, skillkit.NAME_COLUMNS), "value": _cell(row, skillkit.VALUE_COLUMNS),
                 "unit": _cell(row, skillkit.UNIT_COLUMNS)} for row in skillkit.read_rows(path)]
    rows = []
    for line in lines:
        parts = [part.strip() for part in line.replace("，", ",").split(",")]
        if len(parts) < 2:
            parts = line.split()
        rows.append({"item": parts[0], "value": parts[1] if len(parts) > 1 else "",
                     "unit": parts[2] if len(parts) > 2 else ""})
    return rows


def collect(measurements: Path | None, age: float | None):
    """The five item scores as integers, and the problems that stop the computation."""
    manifest = skillkit.load_manifest(__file__)
    rows = measurement_rows(measurements)
    for row in rows:
        if row["unit"].strip().lower() in SCORE_UNITS:
            row["unit"] = "score"
    collected = skillkit.collect_measurements(rows, manifest)
    problems = list(collected.problems)
    problems += [item for item in skillkit.check_scalar(manifest, "age", age) if item.kind != "missing"]
    answers = {}
    for key, number, meq, _topic, allowed in ITEMS:
        value = collected.values.get(key)
        if value is None:
            continue
        if value != int(value) or int(value) not in allowed:
            label = skillkit.spec_by_key(manifest, key)["label_zh"]
            shown = "、".join(str(item) for item in allowed)
            problems.append(skillkit.Problem(key, label, "range",
                                             f"第 {number} 题（原 MEQ 第 {meq} 题）读成 {value:g}。这一题的选项只能记 {shown} 分。"))
            continue
        answers[key] = int(value)
    return answers, problems


def _with_paper_card(text: str) -> str:
    rows = text.splitlines()
    return "\n".join([rows[0], "", *paper_card_lines(), "", *rows[1:]]) + "\n"


def render(answers: dict) -> str:
    score = total(answers)
    label, low, high = category(score)
    lines = [f"# {TITLE}", "", "## 你的得分", ""]
    lines.append(f"你的 rMEQ 得分是 **{score}**。可能的范围是 {TOTAL_MIN} 到 {TOTAL_MAX}，分越高越偏晨型，分越低越偏夜型。")
    lines.append(f"按 Adan 和 Almirall 1991 年发表的五档，{score} 分属于「{label}」（{low}–{high} 分）。{MEANING[label]}")
    lines += ["", "## 怎么用这个结果", ""]
    lines += [
        "- 这是你偏好的作息时段，没有好坏之分。晨型、夜型本身都不是病。",
        "- 安排需要专注的事情时，可以参考自己状态更好的时段。",
        "- 这份问卷只问偏好，不测量你实际几点睡、睡得好不好。如果你戴手环或手表，助手还可以用几天的活动记录看实际的休息和活动节律；"
        "那测的是实际作息，和这里的偏好不是一回事。",
        "- 如果长期入睡困难、白天总是很困，或者作息和上班时间冲突得厉害、影响了生活，请看睡眠专科。",
    ]
    lines += ["", "## 说明", "",
              "- 题目原文受版权保护（MEQ © 1976 Gordon and Breach），这里只按题号和主题描述。",
              "- 五档切点是原作者定的；已有研究指出，晨型夜型问卷的切点会受年龄、性别和文化影响，所以分档只是粗分。",
              "", f"边界: {BOUNDARY}"]
    return _with_paper_card("\n".join(lines) + "\n")


def write_report(out_dir: Path, measurements: Path | None, age: float | None) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    stale = out_dir / "problems.json"
    if stale.exists():
        stale.unlink()
    manifest = skillkit.load_manifest(__file__)
    answers, problems = collect(measurements, age)
    if problems:
        path = skillkit.write_problems(out_dir, problems, TITLE, BOUNDARY)
        path.write_text(_with_paper_card(path.read_text(encoding="utf-8")), encoding="utf-8")
        skillkit.write_result(out_dir, manifest, {"rmeq_score": None, "rmeq_chronotype": None})
        return path
    score = total(answers)
    path = out_dir / "report.md"
    path.write_text(render(answers), encoding="utf-8")
    skillkit.write_result(out_dir, manifest, {"rmeq_score": score, "rmeq_chronotype": category(score)[0]})
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=TITLE)
    parser.add_argument("--measurements", type=Path, help="item,value,unit: rmeq_item1 ... rmeq_item5, option scores")
    parser.add_argument("--age", type=float, help="accepted and range-checked; not used in the score")
    parser.add_argument("--medications", type=Path, help="accepted and ignored: medicines do not change the score")
    parser.add_argument("--labs", type=Path, help="accepted and ignored: checkup labs do not change the score")
    parser.add_argument("--sex", help="accepted and ignored: the score is the same for men and women")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    path = write_report(args.out, args.measurements, args.age)
    sys.stdout.write(str(path) + "\n")
    return skillkit.EXIT_INPUT_PROBLEM if (args.out / "problems.json").exists() else 0


if __name__ == "__main__":
    raise SystemExit(main())
