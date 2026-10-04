#!/usr/bin/env python3
"""Compare one person's CT biomarkers with Table 2 medians.

The numbered list is biomarkers closer to the died-within-5-years median
than to the alive median, ordered by Table 1 IPA drop. Checkup labs are
not inputs. Survival probability is not computed.
"""

from __future__ import annotations

from paper_card import lines as paper_card_lines


import argparse
import csv
import sys
from pathlib import Path

from presets import BOUNDARY, DISPLAY, IPA_DROP, TABLE2, UNIT

LAB_NAMES = ("谷丙转氨酶", "谷草转氨酶", "肌酐", "肾小球滤过率", "血红蛋白", "血小板")
ALIASES = {
    "骨骼肌密度": "muscle_density",
    "肌密度": "muscle_density",
    "muscle": "muscle_density",
    "腹主动脉钙化": "aortic_calcium",
    "腹主动脉钙化积分": "aortic_calcium",
    "腹主动脉agatston": "aortic_calcium",
    "abdominal_aortic_calcium": "aortic_calcium",
    "abdominal_aorta_calcium": "aortic_calcium",
    "aac": "aortic_calcium",
    "主动脉钙化": "aortic_calcium",
    "内脏脂肪密度": "visceral_fat_density",
    "骨密度": "bone_density",
    "骨小梁密度": "bone_density",
    "vsr": "vsr",
    "肾体积": "kidney_volume",
    "肾脏体积": "kidney_volume",
    "皮下脂肪面积": "sat_area",
    "骨骼肌面积": "muscle_area",
    "肌面积": "muscle_area",
}


def age_band(age: float) -> str | None:
    if age < 18:
        return None
    if age <= 39:
        return "18-39"
    if age <= 59:
        return "40-59"
    if age <= 79:
        return "60-79"
    return "80+"


def norm_sex(value: str) -> str | None:
    text = value.strip().lower()
    if text in {"m", "male", "man", "男", "男性"}:
        return "male"
    if text in {"f", "female", "woman", "女", "女性"}:
        return "female"
    return None


def load_measurements(path: Path | None) -> dict[str, str]:
    if path is None:
        return {}
    rows: dict[str, str] = {}
    text = path.read_text(encoding="utf-8")
    sample = text.splitlines()[0] if text.splitlines() else ""
    if "," in sample:
        reader = csv.reader(text.splitlines())
        parsed = list(reader)
        start = 1 if parsed and parsed[0] and parsed[0][0].strip().lower() in {"name", "项目", "key"} else 0
        for row in parsed[start:]:
            if len(row) >= 2 and row[0].strip():
                rows[row[0].strip()] = row[1].strip()
    else:
        for line in text.splitlines():
            if not line.strip() or line.strip().startswith("#"):
                continue
            if "," in line:
                key, value = line.split(",", 1)
            elif ":" in line:
                key, value = line.split(":", 1)
            else:
                continue
            rows[key.strip()] = value.strip()
    return rows


def fold(name: str) -> str:
    return name.strip().lower().replace(" ", "_").replace("-", "_")


# A bare Agatston score is a coronary calcium total. This paper's calcium
# column is abdominal aortic calcium from an abdominal CT, scored in Agatston
# units. The unit name is not an alias for the column.
CORONARY_NAMES = {
    "agatston",
    "agatston_score",
    "coronary_agatston",
    "coronary_calcium",
    "coronary_artery_calcium",
    "cac",
    "cac_score",
    "total_agatston",
}


def is_coronary(name: str) -> bool:
    key = fold(name)
    if key in CORONARY_NAMES or key.startswith("coronary_"):
        return True
    return "冠脉" in name or "冠状动脉" in name


def canonical(name: str) -> str | None:
    if is_coronary(name):
        return None
    key = fold(name)
    if key in IPA_DROP:
        return key
    return ALIASES.get(name.strip()) or ALIASES.get(key)


def load_medications(path: Path | None) -> list[str]:
    if path is None:
        return []
    names = []
    for line in path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            names.append(text)
    return names


def parse_labs(path: Path | None) -> list[tuple[str, str, str]]:
    if path is None:
        return []
    text = path.read_text(encoding="utf-8")
    found = []
    if "项目" in text and "," in text:
        reader = csv.DictReader(text.splitlines())
        for row in reader:
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


def closer_to_dead(value: float, alive: float, dead: float) -> str:
    if alive == dead:
        return "same_median"
    if abs(value - dead) < abs(value - alive):
        return "dead"
    if abs(value - dead) > abs(value - alive):
        return "alive"
    return "tie"


def score(measurements: dict[str, str], age: float | None) -> tuple[list[str], list[str]]:
    if age is None:
        return [], []
    sex = norm_sex(measurements.get("sex", ""))
    band = age_band(age)
    notes = []
    if sex is None or band is None:
        return [], []
    sex_zh = "男性" if sex == "male" else "女性"
    ranked = []
    for name, raw in measurements.items():
        if not is_coronary(name):
            continue
        notes.append(
            f"{name} 的值 {raw} 是冠状动脉钙化（Agatston）积分。"
            "这个方法只比较腹部 CT 的腹主动脉钙化，没有把冠状动脉积分放进名单。"
        )
    for key, drop in IPA_DROP.items():
        raw = None
        for name, value in measurements.items():
            if canonical(name) == key:
                raw = value
                break
        if raw is None:
            continue
        try:
            value = float(raw)
        except ValueError:
            notes.append(f"{DISPLAY[key]}不是数值，没有进入名单。")
            continue
        alive, dead = TABLE2[sex][band][key]
        side = closer_to_dead(value, alive, dead)
        unit = UNIT[key]
        unit_txt = f" {unit}" if unit else ""
        detail = (
            f"{DISPLAY[key]}。测量值 {value:g}{unit_txt}，"
            f"Table 2 中{sex_zh} {band} 岁存活中位数 {alive:g}，5 年内死亡中位数 {dead:g}。"
            f"Table 1 的 IPA drop 是 {drop:g}。"
        )
        if side == "dead":
            ranked.append((drop, detail))
    ranked.sort(key=lambda item: item[0], reverse=True)
    lines = [f"{index}. {text}" for index, (_, text) in enumerate(ranked, start=1)]
    return lines, notes


def medication_lines(medications: list[str], list_text: str) -> list[str]:
    lines = ["## 你正在使用的药", ""]
    if not medications:
        lines.append("没有提供现用药。")
        return lines
    for name in medications:
        if name and name in list_text:
            lines.append(f"- {name}：这个名字出现在方法名单里。不能据此停。")
        else:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def exam_section(labs: list[tuple[str, str, str]]) -> list[str]:
    lines = ["## 体检", ""]
    if not labs:
        lines.append("没有提供体检。体检不增删方法算出的名单。")
        return lines
    lines.append("下面照录体检数值。体检不增删方法算出的名单。")
    for name, value, unit in labs:
        shown = " ".join(part for part in (name, value, unit) if part)
        lines.append(f"- {shown}")
    return lines


def render(list_lines: list[str], notes: list[str], meds: list[str], labs: list[tuple[str, str, str]], age: float | None) -> str:
    if age is None and not list_lines:
        intro = "这次没有提供年龄和影像测量，所以没有对照中位数。"
    elif not list_lines:
        intro = "这次没有标志比存活中位数更靠近死亡中位数，所以名单是空的。"
    else:
        intro = "这次把更靠近死亡中位数的影像标志，按论文的贡献从大到小排列。更靠近存活中位数的项目不进入名单。没有计算生存概率。"
    body = ["# 腹部影像生物标志", "", intro, ""]
    if notes:
        body.extend(notes)
        body.append("")
    body.extend(["## 方法算出的名单", ""])
    body.extend(list_lines or ["没有标志进入名单。"])
    body.extend(["", *medication_lines(meds, "\n".join(list_lines))])
    body.extend(["", *exam_section(labs)])
    body.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(body) + "\n"


def report(out: Path, measurements: Path | None = None, medications: Path | None = None, labs: Path | None = None, age: float | None = None) -> Path:
    values = load_measurements(measurements)
    if "age" in values and measurements is not None:
        pass
    lines, notes = score(values, age)
    text = render(lines, notes, load_medications(medications), parse_labs(labs), age)
    out.mkdir(parents=True, exist_ok=True)
    destination = out / "report.md"
    destination.write_text(_with_paper_card(text), encoding="utf-8")
    return destination


def main() -> int:
    parser = argparse.ArgumentParser(description="CT biomarker readout against published 5-year medians")
    parser.add_argument("--measurements", type=Path, default=None)
    parser.add_argument("--medications", type=Path, default=None)
    parser.add_argument("--labs", type=Path, default=None)
    parser.add_argument("--age", type=float, default=None)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    path = report(args.out, args.measurements, args.medications, args.labs, args.age)
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
