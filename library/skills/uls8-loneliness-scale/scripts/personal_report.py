#!/usr/bin/env python3
"""Personal ULS-8 loneliness score (Hays & DiMatteo 1987).

Reads the eight answers as marked (1 never to 4 often/always), reverses items
3 and 6, and adds them up (8-32). No category is given: no published cut-point
was found. Writes out/report.md and out/result.json, or out/problems.json and
exit code 3 when an answer is missing, out of range or unreadable.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import skillkit
from paper_card import lines as paper_card_lines
from presets import (
    ANSWER_WORDS,
    BOUNDARY,
    FREQUENT,
    HOTLINE,
    ITEMS,
    KEYS,
    TITLE,
    TOTAL_MAX,
    TOTAL_MIN,
    item_score,
    total,
)

SCORE_UNITS = {"分", "points", "point", "pts"}


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


def normalize(rows: list[dict]) -> list[dict]:
    """Answer words become their 1-4 code; a unit written as 分 or points is the score unit."""
    out = []
    for row in rows:
        row = dict(row)
        word = row["value"].strip().lower()
        if word in ANSWER_WORDS:
            row["value"] = str(ANSWER_WORDS[word])
        if row["unit"].strip().lower() in SCORE_UNITS:
            row["unit"] = "score"
        out.append(row)
    return out


def collect(measurements: Path | None, age: float | None):
    """The eight answers as integers, and the problems that stop the computation."""
    manifest = skillkit.load_manifest(__file__)
    collected = skillkit.collect_measurements(normalize(measurement_rows(measurements)), manifest)
    problems = list(collected.problems)
    problems += [item for item in skillkit.check_scalar(manifest, "age", age) if item.kind != "missing"]
    answers = {}
    for key, number, _topic, _rev in ITEMS:
        value = collected.values.get(key)
        if value is None:
            continue
        if value != int(value):
            label = skillkit.spec_by_key(manifest, key)["label_zh"]
            problems.append(skillkit.Problem(key, label, "range",
                                             f"第 {number} 题读成 {value:g}。每题只能是 1、2、3、4 中的一个整数。"))
            continue
        answers[key] = int(value)
    return answers, problems


def _with_paper_card(text: str) -> str:
    rows = text.splitlines()
    return "\n".join([rows[0], "", *paper_card_lines(), "", *rows[1:]]) + "\n"


def render(answers: dict) -> str:
    score = total(answers)
    scored = {key: item_score(key, answers[key]) for key in KEYS}
    lonely_side = [number for key, number, _t, _r in ITEMS if scored[key] >= FREQUENT]
    top = max(scored.values())
    top_items = [f"第 {number} 题（{topic}）" for key, number, topic, _r in ITEMS if scored[key] == top]
    lines = [f"# {TITLE}", "", "## 你的得分", ""]
    lines.append("谢谢你认真填完。感到孤独不是你的错，很多人都有过这种感受。")
    lines.append(f"你的 ULS-8 得分是 **{score}**。可能的范围是 {TOTAL_MIN} 到 {TOTAL_MAX}，分越高，表示最近越常感到孤独。")
    lines.append("第 3 题和第 6 题是反着问的（问的是外向、能不能找到陪伴），已经按量表规则反向计分：原答 1 记 4 分，原答 4 记 1 分。")
    if score == TOTAL_MIN:
        lines.append(f"{TOTAL_MIN} 分是量表的最低分：8 道题都落在最不孤独的一端。这是很好的状态，你身边的联系值得继续保持。")
    else:
        lines.append(f"8 道题里有 {len(lonely_side)} 道落在更孤独的一侧（计分 3 或 4）。"
                     f"计分最高的是{'、'.join(top_items)}。")
    lines.append("我们没有找到这个量表公认的分档切点（原作者和中文版验证研究里都没有找到），所以这里不说「轻度」「中度」「重度」。"
                 "隔几周再做一次，看分数往哪个方向走，比一次的分数更有用。")
    lines += ["", "## 为什么值得在意", ""]
    lines.append("研究发现，长期的孤独和社交隔绝与更高的死亡风险有关，也和冠心病、脑卒中风险升高有关"
                 "（Holt-Lunstad 等 2015；Valtorta 等 2016）。孤独感是可以改变的，下面这些小步骤都算数。")
    lines += ["", "## 可以试试的小步骤", ""]
    lines += [
        "- 这周主动联系一个你想念的人：打个电话、发条语音，或者约一次见面。",
        "- 把每周固定要做的一件事改成和别人一起做：散步、买菜、下棋、跳广场舞、打太极。",
        "- 找一个有固定时间的团体：社区活动、老年大学、兴趣班、志愿服务。每周同一时间见到同一群人，比偶尔一次聚会更容易坚持。",
        "- 如果听不清、看不清让你不想和人说话，去医院查一查听力和视力。",
        "- 身边的人帮不上时，也可以和社区医生、社工或心理咨询师聊一聊。",
    ]
    if "uls8_item2" in answers and scored["uls8_item2"] >= FREQUENT:
        lines.append("- 你在第 2 题（有没有可以求助的人）答得偏孤独：先想好一个遇到事可以打电话的人，把号码存在手机里显眼的地方。")
    lines += ["", "## 需要更多帮助时", "", HOTLINE,
              "如果孤独、低落已经持续好几周，影响到吃饭、睡觉或做事，可以去看心理门诊或精神科，或者先和社区医生聊聊。"]
    lines += ["", "## 说明", "",
              "- 题目原文受版权保护，这里只按题号和主题描述。请用正式问卷作答，再照原样填每题的答案。",
              "- 这是你最近状态的一次快照，不是诊断。",
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
        skillkit.write_result(out_dir, manifest, {"uls8_score": None})
        return path
    path = out_dir / "report.md"
    path.write_text(render(answers), encoding="utf-8")
    skillkit.write_result(out_dir, manifest, {"uls8_score": total(answers)})
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=TITLE)
    parser.add_argument("--measurements", type=Path, help="item,value,unit: uls8_item1 ... uls8_item8, answers as marked (1-4)")
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
