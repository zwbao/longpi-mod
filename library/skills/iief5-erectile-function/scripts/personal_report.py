#!/usr/bin/env python3
"""Personal IIEF-5 score and published severity band (Rosen et al. 1999).

Reads five item scores (1-5), adds them (5-25) and names the band printed by
Rosen 1999 / Rhoden 2002. Men only; applies to men who attempted intercourse
in the past 6 months. A score of 21 or less is sent to a doctor, with a
cardiovascular risk check (Princeton III consensus). Writes out/report.md and
out/result.json, or out/problems.json and exit code 3.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import skillkit
from paper_card import lines as paper_card_lines
from presets import (
    BOUNDARY,
    CHINA_PAR_AGES,
    CUTOFF,
    ITEMS,
    RECALL,
    TITLE,
    TOTAL_MAX,
    TOTAL_MIN,
    band,
    total,
)

SCORE_UNITS = {"分", "points", "point", "pts"}
YES = {"1", "yes", "y", "true", "是", "有"}
NO = {"0", "no", "n", "false", "否", "无", "没有"}
MALE = {"male", "m", "man", "男", "男性"}
FEMALE = {"female", "f", "woman", "女", "女性"}
SCOPE = f"IIEF-5 只适用于{RECALL}尝试过性交的男性。"


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


def parse_sex(raw: str | None) -> str | None:
    text = (raw or "").strip().lower()
    if text in MALE:
        return "male"
    if text in FEMALE:
        return "female"
    return None


def collect(measurements: Path | None, age: float | None, sex: str | None, attempted: str | None):
    """The five item scores as integers, and the problems that stop the computation."""
    manifest = skillkit.load_manifest(__file__)
    rows = measurement_rows(measurements)
    for row in rows:
        if row["unit"].strip().lower() in SCORE_UNITS:
            row["unit"] = "score"
    index = skillkit.alias_index(skillkit.input_specs(manifest))
    zeros = set()
    for row in rows:
        hit = next((index[name] for name in skillkit.name_variants(row["item"]) if name in index), None)
        if hit and row["value"].strip() in {"0", "0.0"}:
            zeros.add(hit[0]["key"])
    collected = skillkit.collect_measurements(rows, manifest)
    problems = []
    for item in collected.problems:
        if item.key in zeros and item.kind == "range":
            number = int(item.key[-1])
            item = skillkit.Problem(item.key, item.label, "scope",
                                    f"第 {number} 题填了 0。0 分是完整版 IIEF 里「没有性活动」或「没有尝试性交」的选项，"
                                    f"不在 IIEF-5 的 {TOTAL_MIN}–{TOTAL_MAX} 分计分里。{SCOPE}这种情况不计算，可以直接和医生谈。")
        problems.append(item)
    problems += [item for item in skillkit.check_scalar(manifest, "age", age) if item.kind != "missing"]
    person = parse_sex(sex)
    if person is None:
        problems.append(skillkit.Problem("sex", "性别", "missing", "需要性别（--sex male）：IIEF-5 是男性问卷。"))
    elif person == "female":
        problems.append(skillkit.Problem("sex", "性别", "scope", "IIEF-5 是男性勃起功能问卷，不适用于女性，这次不计算。"))
    if attempted is not None:
        token = attempted.strip().lower()
        if token in NO:
            problems.append(skillkit.Problem("attempted", "过去 6 个月是否尝试过性交", "scope",
                                             f"{SCOPE}没有尝试过时，这份问卷的分数没有意义，这次不计算。"
                                             "如果是因为勃起困难才没有尝试，这本身就值得和男科或泌尿外科医生谈。"))
        elif token not in YES:
            problems.append(skillkit.Problem("attempted", "过去 6 个月是否尝试过性交", "parse",
                                             f"--attempted 只接受 yes 或 no（是/否），收到「{attempted}」。"))
    answers = {}
    for key, number, _topic in ITEMS:
        value = collected.values.get(key)
        if value is None:
            continue
        if value != int(value):
            label = skillkit.spec_by_key(manifest, key)["label_zh"]
            problems.append(skillkit.Problem(key, label, "range", f"第 {number} 题读成 {value:g}。每题只能是 1 到 5 的整数。"))
            continue
        answers[key] = int(value)
    return answers, problems


def _with_paper_card(text: str) -> str:
    rows = text.splitlines()
    return "\n".join([rows[0], "", *paper_card_lines(), "", *rows[1:]]) + "\n"


def render(answers: dict, age: float | None) -> str:
    score = total(answers)
    label, low, high = band(score)
    lines = [f"# {TITLE}", "", "## 你的得分", ""]
    lines.append(f"你的 IIEF-5 得分是 **{score}**。可能的范围是 {TOTAL_MIN} 到 {TOTAL_MAX}，分越高，勃起功能越好。问卷问的是{RECALL}。")
    lines.append(f"按 Rosen 等 1999 年发表的分档，{score} 分落在「{label}」这一档（{low}–{high} 分）。")
    if score > CUTOFF:
        lines.append("这一档表示没有勃起功能障碍，这是好消息。规律运动、不吸烟、管好体重、血压和血糖，也是在保护血管。"
                     "以后如果感到有变化，可以再做一次。")
    else:
        lines.append(f"论文用 {CUTOFF} 分及以下区分有勃起功能障碍。你的分数提示可能存在{label}勃起功能障碍，请男科或泌尿外科医生评估。")
        lines += ["", "## 为什么也要查心血管", ""]
        lines.append("勃起靠的是阴茎里很细的血管，血管出问题时，这里常常先有表现。专家共识指出，勃起功能障碍常和没有症状的冠心病同时存在，"
                     "从出现勃起问题到发生冠心病事件常隔 2 到 5 年（Princeton III 共识，Nehra 等 2012）。"
                     "所以看医生时，也请量血压、查血脂和血糖，做一次心血管风险评估。40 岁以上尤其要做；年轻男性也不要忽视。")
        low_age, high_age = CHINA_PAR_AGES
        if age is not None and low_age <= age <= high_age:
            lines.append("有了血压、血脂和腰围，也可以请助手用 China-PAR（中国人群的 10 年心血管病风险方程）估算一下，把结果带给医生。")
        else:
            lines.append(f"助手可以用 China-PAR（中国人群的 10 年心血管病风险方程）估算心血管病风险，它由 {low_age}–{high_age} 岁的人推导；"
                         "年龄不在这个范围或没有提供时，请医生评估。")
        lines += ["", "## 看医生之前", ""]
        lines += [
            "- 如果你正在吃降压药、抗抑郁药或其他长期用药，不要因为这个结果自己停药或换药。有些药会影响勃起，要不要调整由开药的医生或药师判断。",
            "- 不要自己在网上买「壮阳药」。要不要用药、用什么药，由医生决定。",
            "- 这件事很常见，医生每天都在处理。可以把这份报告带给医生看。",
        ]
    lines += ["", "## 说明", "",
              "- 题目原文受版权保护（Pfizer 所有，Mapi Research Trust 发放），这里只按题号和主题描述。",
              f"- {SCOPE}",
              "- 分档只说明可能性和大致轻重，确诊要医生问诊和检查。",
              "", f"边界: {BOUNDARY}"]
    return _with_paper_card("\n".join(lines) + "\n")


def write_report(out_dir: Path, measurements: Path | None, age: float | None, sex: str | None,
                 attempted: str | None = None) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    stale = out_dir / "problems.json"
    if stale.exists():
        stale.unlink()
    manifest = skillkit.load_manifest(__file__)
    answers, problems = collect(measurements, age, sex, attempted)
    if problems:
        path = skillkit.write_problems(out_dir, problems, TITLE, BOUNDARY)
        path.write_text(_with_paper_card(path.read_text(encoding="utf-8")), encoding="utf-8")
        skillkit.write_result(out_dir, manifest, {"iief5_score": None, "iief5_band": None})
        return path
    score = total(answers)
    path = out_dir / "report.md"
    path.write_text(render(answers, age), encoding="utf-8")
    skillkit.write_result(out_dir, manifest, {"iief5_score": score, "iief5_band": band(score)[0]})
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=TITLE)
    parser.add_argument("--measurements", type=Path, help="item,value,unit: iief5_item1 ... iief5_item5, each 1-5")
    parser.add_argument("--age", type=float)
    parser.add_argument("--sex", help="male; the questionnaire is for men")
    parser.add_argument("--attempted", help="yes or no: attempted intercourse in the past 6 months")
    parser.add_argument("--medications", type=Path, help="accepted and ignored: medicines do not change the score")
    parser.add_argument("--labs", type=Path, help="accepted and ignored: checkup labs do not change the score")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    path = write_report(args.out, args.measurements, args.age, args.sex, args.attempted)
    sys.stdout.write(str(path) + "\n")
    return skillkit.EXIT_INPUT_PROBLEM if (args.out / "problems.json").exists() else 0


if __name__ == "__main__":
    raise SystemExit(main())
