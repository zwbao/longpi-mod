#!/usr/bin/env python3
"""Personal readout of the DrugAge ranking and the eight-intervention vector field.

The compound list comes from the frozen DrugAge snapshot. Checkup labs and
current medicines do not add or remove names. The vector-field order is not
an instruction to start or stop anything.
"""

from __future__ import annotations

from paper_card import lines as paper_card_lines


import argparse
import sys
from pathlib import Path

from control_laws import control_law_analysis, known_interventions
from drugage import count_compounds, count_itp_compounds, load_drugage, rank_compounds
from labs import lab_lines, parse_labs
from names import display_name, match_drugage, match_interventions
from presets import (
    AGE_50_CONTROL_COST,
    BOUNDARY,
    DEFAULT_AGE,
    DRUGAGE_COMPOUNDS,
    DRUGAGE_DATA_ROWS,
    DRUGAGE_ITP_COMPOUNDS,
    DRUGAGE_RANKED_MIN2,
    RANK_MIN_STUDIES,
)


def bundled_drugage() -> Path:
    return Path(__file__).resolve().parents[1] / "data" / "drugage.csv"


def load_medications(path: Path | None) -> list[str]:
    if path is None:
        return []
    names = []
    for line in path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            names.append(text)
    return names


def medication_lines(medications: list[str], ranked: list, sequence: list[str]) -> list[str]:
    by_name = {item.compound: item for item in ranked}
    interventions = known_interventions()
    lines = []
    for name in medications:
        row = match_drugage(name, by_name)
        if row is None:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停药。")
        else:
            lines.append(
                f"- {name}：对应名单上的 {display_name(row.compound)}，排在第 {row.rank} 位。"
                "名次不是继续或停用的理由。"
            )
        for key in match_interventions(name):
            shown = interventions[key].display
            if key in sequence:
                place = sequence.index(key) + 1
                where = f"贪心顺序排在第 {place} 位"
            else:
                where = "贪心顺序没有排到它"
            lines.append(f"- {name}：也出现在向量场的「{shown}」里，{where}。这不是停用的理由。")
    return lines


def render_report(
    ranked: list,
    n_rows: int,
    n_compounds: int,
    n_itp: int,
    analysis: dict,
    medication_lines_out: list[str],
    lab_report: list[str],
    top_n: int,
) -> str:
    interventions = known_interventions()
    lines = [
        "# 已发表寿命实验与向量场顺序",
        "",
        (
            f"化合物名单来自 Longevity Claw 冻存的 DrugAge 表：{n_rows} 行实验，"
            f"{n_compounds} 个化合物名，其中 {n_itp} 个在 ITP 记录里出现过。"
            f"下面只排至少 {RANK_MIN_STUDIES} 项实验的 {len(ranked)} 个名字。"
            "综合分只用来排序，不放在标题里。体检数值不改变这个名单。"
        ),
        "",
        "## 综合分较高的化合物",
    ]
    for item in ranked[:top_n]:
        title = display_name(item.compound)
        itp = "ITP 里有记录" if item.itp_validated else "ITP 里没有记录"
        species = "、".join(item.species_list[:4])
        lines.append(
            f"{item.rank}. {title}。{item.n_studies} 项实验，{item.n_species} 个物种（{species}），"
            f"平均寿命变化 {item.mean_lifespan_change:+.2f}%，{itp}。"
        )
    if medication_lines_out:
        lines.extend(["", "## 你正在使用的药", *medication_lines_out])
    lines.extend(
        [
            "",
            "## 向量场排出的顺序",
            (
                f"按 {analysis['chronological_age']:g} 岁生成一套典型标志物状态，"
                f"控制代价是 {analysis['initial_biological_age']:.2f}。"
                "这个数是仓库函数 biological_age 的控制代价，不是临床生物年龄。"
                "体检不参与这一节。"
            ),
            "模型按每一步还能下降的控制代价，排出下面的顺序。顺序在下降不超过 0 时停住。停住不是叫人停药。",
        ]
    )
    sequence = analysis["optimal_sequence"]
    if not sequence:
        lines.append("- 这套状态下没有排出顺序。")
    for index, key in enumerate(sequence, start=1):
        item = interventions[key]
        lines.append(f"{index}. {item.display}。仓库里的证据标记是 {item.evidence_level}。")
    missing = [key for key in interventions if key not in sequence]
    if missing:
        names = "、".join(interventions[key].display for key in missing)
        lines.append(f"没有排到的是 {names}。没有排到不是停用的理由。")
    lines.append("同一套状态下，八个干预按下降幅度乘置信度排列：")
    for index, row in enumerate(analysis["intervention_rankings"], start=1):
        item = interventions[row["key"]]
        lines.append(
            f"{index}. {item.display}。模型下降 {row['bio_age_reduction']:.2f}，置信度 {row['confidence']:g}。"
        )
    if lab_report:
        lines.extend(["", "## 体检里读到的项目", *lab_report])
    lines.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def report(
    out: Path,
    age: float,
    medications: Path | None,
    labs: Path | None,
    drugage: Path | None,
    top_n: int,
) -> Path:
    path = drugage or bundled_drugage()
    studies = load_drugage(path)
    n_compounds = count_compounds(studies)
    n_itp = count_itp_compounds(studies)
    if len(studies) != DRUGAGE_DATA_ROWS or n_compounds != DRUGAGE_COMPOUNDS or n_itp != DRUGAGE_ITP_COMPOUNDS:
        raise ValueError("DrugAge snapshot counts do not match the locked preset")
    ranked = rank_compounds(studies)
    if len(ranked) != DRUGAGE_RANKED_MIN2:
        raise ValueError("Ranked compound count does not match the locked preset")
    analysis = control_law_analysis(age)
    if age == DEFAULT_AGE and abs(analysis["initial_biological_age"] - AGE_50_CONTROL_COST) > 1e-4:
        raise ValueError("Age-50 control cost does not match the locked preset")
    meds = load_medications(medications)
    lab_rows = parse_labs(labs) if labs else []
    text = render_report(
        ranked,
        len(studies),
        n_compounds,
        n_itp,
        analysis,
        medication_lines(meds, ranked, analysis["optimal_sequence"]),
        lab_lines(lab_rows) if labs else [],
        top_n,
    )
    out.mkdir(parents=True, exist_ok=True)
    destination = out / "report.md"
    destination.write_text(_with_paper_card(text), encoding="utf-8")
    return destination


def main() -> int:
    parser = argparse.ArgumentParser(description="DrugAge ranking and vector-field order for one person")
    parser.add_argument("--medications", type=Path, default=None)
    parser.add_argument("--labs", type=Path, default=None)
    parser.add_argument("--age", type=float, default=DEFAULT_AGE)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--top", type=int, default=10)
    parser.add_argument("--drugage", type=Path, default=None)
    args = parser.parse_args()
    path = report(args.out, args.age, args.medications, args.labs, args.drugage, args.top)
    print(path)
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
