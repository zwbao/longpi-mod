#!/usr/bin/env python3
"""Nearest Table 2 frailty-subtype mean for one person's 11 NMR metabolites.

The call uses the published subtype means. It is not the unpublished
K-means model. Checkup labs and current medicines do not change the call.
"""

from __future__ import annotations

from paper_card import lines as paper_card_lines


import argparse
import csv
import math
import sys
from pathlib import Path

from presets import (
    BOUNDARY,
    DIET_HEALTHY_MIN,
    DIET_RULES,
    FI_FRAIL_MIN,
    FI_ITEMS,
    FI_NONFRAIL_MAX,
    FRAIL_N,
    GROUP_INDEX,
    HIGH_RISK,
    HR_VS_I,
    INCLUDED_N,
    METABOLITES,
    SUBTYPE_N,
    SUBTYPE_NAME,
    ALIASES,
)


def load_lines(path: Path | None) -> list[str]:
    if path is None:
        return []
    names = []
    for line in path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            names.append(text)
    return names


def load_metabolites(path: Path) -> dict[str, float]:
    text = path.read_text(encoding="utf-8")
    rows = list(csv.DictReader(text.splitlines()))
    if not rows:
        raise ValueError("代谢物表是空的")
    fields = {name.strip().lower(): name for name in rows[0] if name}
    name_key = fields.get("name") or fields.get("代谢物") or fields.get("项目")
    value_key = fields.get("value") or fields.get("结果") or fields.get("值")
    if not name_key or not value_key:
        raise ValueError("代谢物表需要 name,value 两列")
    found: dict[str, float] = {}
    for row in rows:
        raw = (row.get(name_key) or "").strip()
        key = ALIASES.get(raw.casefold(), ALIASES.get(raw, raw))
        if key not in METABOLITES:
            continue
        found[key] = float(row[value_key])
    return found


def z_value(key: str, value: float) -> float:
    mean = METABOLITES[key]["mean"][GROUP_INDEX["overall"]]
    sd = METABOLITES[key]["sd"][GROUP_INDEX["overall"]]
    return (value - mean) / sd


def nearest_subtype(values: dict[str, float]) -> tuple[str, dict[str, float]]:
    missing = [key for key in METABOLITES if key not in values]
    if missing:
        raise ValueError("缺少代谢物: " + ", ".join(missing))
    user_z = {key: z_value(key, values[key]) for key in METABOLITES}
    distances = {}
    for subtype in ("I", "II", "III", "IV"):
        index = GROUP_INDEX[subtype]
        total = 0.0
        for key in METABOLITES:
            center = METABOLITES[key]["mean"][index]
            center_z = z_value(key, center)
            total += (user_z[key] - center_z) ** 2
        distances[subtype] = math.sqrt(total)
    nearest = min(distances, key=lambda name: (distances[name], name))
    return nearest, distances


def frailty_label(fi: float | None) -> str | None:
    if fi is None:
        return None
    if fi <= FI_NONFRAIL_MAX:
        return f"FI {fi:g} 落在论文的非衰弱界（≤ {FI_NONFRAIL_MAX:g}，分母 {FI_ITEMS} 项）。这不改变代谢物亚型。"
    if fi > FI_FRAIL_MIN:
        return f"FI {fi:g} 落在论文的衰弱界（> {FI_FRAIL_MIN:g}）。亚型仍只由 11 个代谢物到 Table 2 均值的距离决定。"
    return f"FI {fi:g} 落在论文的衰弱前期。原文把衰弱前期排除在聚类之外。这不改变代谢物亚型。"


def diet_score(path: Path | None) -> tuple[int, list[str]] | None:
    if path is None:
        return None
    rows = list(csv.DictReader(path.read_text(encoding="utf-8").splitlines()))
    if not rows:
        return None
    fields = {name.strip().lower(): name for name in rows[0] if name}
    name_key = fields.get("name") or fields.get("食物")
    value_key = fields.get("value") or fields.get("结果")
    if not name_key or not value_key:
        raise ValueError("饮食表需要 name,value 两列")
    supplied = {row[name_key].strip().casefold(): float(row[value_key]) for row in rows}
    points = []
    score = 0
    for key, label, op, cut, unit in DIET_RULES:
        if key not in supplied:
            points.append(f"- {label}：表里没有，这一项不计分。")
            continue
        value = supplied[key]
        ok = value >= cut if op == "ge" else value <= cut
        score += int(ok)
        mark = "符合" if ok else "不符合"
        points.append(f"- {label} {value:g} {unit}，论文切点是 {op} {cut:g}，{mark}。")
    return score, points


def medication_lines(names: list[str]) -> list[str]:
    lines = ["## 你正在使用的药", ""]
    if not names:
        lines.append("没有提供现用药。")
        return lines
    for name in names:
        lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def exam_section(labs: list[str]) -> list[str]:
    lines = ["## 体检", ""]
    if not labs:
        lines.append("没有提供体检。体检不增删方法算出的名单。")
        return lines
    lines.append("下面照录体检数值。体检不增删方法算出的名单。")
    lines.extend(labs)
    return lines


LAB_PANELS = {
    "alt": ("谷丙转氨酶", None, 40),
    "ast": ("谷草转氨酶", None, 40),
    "creatinine": ("肌酐", None, 115),
    "egfr": ("肾小球滤过率", 60, None),
    "hemoglobin": ("血红蛋白", 110, None),
    "platelets": ("血小板", 100, None),
}
LAB_ALIASES = {
    "谷丙转氨酶": "alt",
    "谷丙": "alt",
    "alt": "alt",
    "谷草转氨酶": "ast",
    "谷草": "ast",
    "ast": "ast",
    "肌酐": "creatinine",
    "creatinine": "creatinine",
    "肾小球滤过率": "egfr",
    "egfr": "egfr",
    "血红蛋白": "hemoglobin",
    "血小板": "platelets",
}


def parse_labs(path: Path | None) -> list[str]:
    if path is None:
        return []
    text = path.read_text(encoding="utf-8", errors="replace")
    lines = [line for line in text.splitlines() if line.strip()]
    parsed = []
    if lines and ("," in lines[0] or "\t" in lines[0]):
        dialect = csv.excel_tab if "\t" in lines[0] else csv.excel
        table = list(csv.DictReader(lines, dialect=dialect))
        if table:
            fields = {name.strip().lower(): name for name in table[0] if name}
            item_key = fields.get("项目") or fields.get("item") or fields.get("name")
            value_key = fields.get("结果") or fields.get("value") or fields.get("result")
            if item_key and value_key:
                for row in table:
                    parsed.extend(_lab_line(row.get(item_key, ""), row.get(value_key, "")))
    if not parsed:
        for line in lines:
            parsed.extend(_lab_line(line, line))
    if not parsed:
        return ["没有从体检文件里读到可识别的项目。体检不增删方法算出的名单。"]
    parsed.append("超出常见范围的项目只写在这里。体检不增删方法算出的名单。")
    return parsed


def _lab_line(item: str, value_text: str) -> list[str]:
    compact = item.casefold().replace(" ", "")
    key = None
    for alias, panel in LAB_ALIASES.items():
        if alias.casefold() in compact:
            key = panel
            break
    if key is None:
        return []
    digits = "".join(ch if ch.isdigit() or ch == "." else " " for ch in value_text)
    parts = digits.split()
    if not parts:
        return []
    value = float(parts[0])
    label, low, high = LAB_PANELS[key]
    if low is not None and value < low:
        bound = f"，低于常见下限 {low:g}"
    elif high is not None and value > high:
        bound = f"，高于常见上限 {high:g}"
    else:
        bound = "，在常见范围内"
    return [f"- {label} {value:g}{bound}"]


def render_report(
    nearest: str | None,
    distances: dict[str, float] | None,
    fi: float | None,
    diet: tuple[int, list[str]] | None,
    meds: list[str],
    labs: list[str],
) -> str:
    if nearest is None or distances is None:
        intro = "这次没有给出全部十一个核磁共振代谢物，所以不算到四个亚型均值的距离。"
        items = ["没有算出亚型。"]
    else:
        intro = (
            f"你最近的是亚型 {nearest}，{SUBTYPE_NAME[nearest]}，"
            f"距离 {distances[nearest]:.4f}。"
        )
        if fi is not None:
            intro += (
                f"你的衰弱指数是 {fi:g}。论文把大于 {FI_FRAIL_MIN:g} 写成衰弱。"
                "这不改变亚型。"
            )
        if diet is not None:
            score, _points = diet
            intro += (
                f"饮食记分是 {score}。论文把不少于 {DIET_HEALTHY_MIN} 分写成健康饮食。"
                "这不改变亚型。"
            )
        items = []
        for subtype in ("I", "II", "III", "IV"):
            if subtype == nearest:
                line = (
                    f"- 最近的是亚型 {subtype}，{SUBTYPE_NAME[subtype]}。"
                    f"到这个均值的距离是 {distances[subtype]:.4f}。"
                )
                hr = HR_VS_I["全因死亡"].get(subtype)
                if hr:
                    line += (
                        f"论文相对亚型 I 的全因死亡风险比是 {hr[0]:.2f}。"
                        "这是队列比较，不是你的风险。"
                    )
                else:
                    band = "高风险组" if subtype in HIGH_RISK else "低风险组"
                    line += f"论文把这一组放在{band}。"
            else:
                line = f"- 亚型 {subtype}，{SUBTYPE_NAME[subtype]}。距离 {distances[subtype]:.4f}。"
            items.append(line)
    lines = ["# 代谢衰弱亚型", "", intro, "", "## 方法算出的名单", "", *items]
    lines.extend(["", *medication_lines(meds)])
    lines.extend(["", *exam_section(labs)])
    lines.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def report(
    out: Path,
    metabolites: Path | None = None,
    medications: Path | None = None,
    labs: Path | None = None,
    fi: float | None = None,
    diet: Path | None = None,
) -> Path:
    nearest = None
    distances = None
    if metabolites is not None:
        values = load_metabolites(metabolites)
        if all(key in values for key in METABOLITES):
            nearest, distances = nearest_subtype(values)
    text = render_report(
        nearest,
        distances,
        fi,
        diet_score(diet),
        load_lines(medications),
        parse_labs(labs),
    )
    out.mkdir(parents=True, exist_ok=True)
    destination = out / "report.md"
    destination.write_text(_with_paper_card(text), encoding="utf-8")
    return destination


def main() -> int:
    parser = argparse.ArgumentParser(description="Table 2 frailty subtype readout for one person")
    parser.add_argument("--metabolites", type=Path, default=None)
    parser.add_argument("--medications", type=Path, default=None)
    parser.add_argument("--labs", type=Path, default=None)
    parser.add_argument("--fi", type=float, default=None)
    parser.add_argument("--diet", type=Path, default=None)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    path = report(args.out, args.metabolites, args.medications, args.labs, args.fi, args.diet)
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
