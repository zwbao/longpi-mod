#!/usr/bin/env python3
from __future__ import annotations

import skillkit
from paper_card import lines as paper_card_lines


import argparse
import sys
from pathlib import Path

from presets import BOUNDARY

def load_medications(path):
    if path is None:
        return []
    names = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            names.append(text)
    return names


def parse_labs(path):
    text = Path(path).read_text(encoding="utf-8")
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return []
    rows = []
    header = lines[0].replace(" ", "")
    start = 1 if "项目" in header else 0
    if any("," in line for line in lines):
        for line in lines[start:]:
            parts = [part.strip() for part in line.split(",")]
            if len(parts) >= 2 and parts[0] != "项目":
                unit = parts[2] if len(parts) > 2 else ""
                rows.append((parts[0], parts[1], unit))
        return rows
    return [("体检原文", " ".join(lines), "")]


def lab_lines(rows):
    lines = []
    for name, value, unit in rows:
        unit_text = f" {unit}" if unit else ""
        lines.append(f"- {name} {value}{unit_text}")
    return lines


def match_medication(name, aliases):
    folded = name.lower().replace(" ", "")
    ordered = sorted(aliases, key=lambda item: len(item[0]), reverse=True)
    for alias, display in ordered:
        if alias.lower().replace(" ", "") in folded:
            return display
    return None


def medication_lines(medications, aliases, listed):
    names = {name for name, _detail in listed}
    lines = []
    for name in medications:
        display = match_medication(name, aliases)
        if display is None or display not in names:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
        else:
            lines.append(f"- {name}：对应名单上的 {display}。名次不是继续或停用的理由。")
    return lines


def render(title, intro, items, medications, lab_rows, aliases):
    lines = [f"# {title}", "", intro, "", "## 方法算出的名单"]
    if not items:
        lines.append("名单是空的。")
    else:
        for name, detail in items:
            lines.append(f"- {name}：{detail}")
    med_lines = medication_lines(medications, aliases, items)
    lines.extend(["", "## 你正在使用的药"])
    if med_lines:
        lines.extend(med_lines)
    else:
        lines.append("没有提供现用药。")
    lines.extend(["", "## 体检"])
    if lab_rows:
        lines.append("下面照录体检。体检不增删方法算出的名单。")
        lines.extend(lab_lines(lab_rows))
    else:
        lines.append("没有提供体检。体检不增删方法算出的名单。")
    lines.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"

from presets import (
    COHORTS,
    MEMORY_REFERENCE_AGE_HIGH,
    MEMORY_REFERENCE_AGE_LOW,
    SA_IMMATURE_FOLD_AFTER_OUTLIER,
    SA_VS_AD_NEUROBLAST_Q,
    SUPERAGER_MIN_AGE,
    TOTAL_NUCLEI,
)


TITLE = "情景记忆对照"
# The words --memory accepts. unknown is a value: the report then does not judge.
MEMORY_CHOICES = ("equal_or_better", "below", "unknown")


def collect_inputs(age, memory):
    """Check --age and --memory through skill.json.

    Both are required. Age must be in the declared range; --memory must be one
    of MEMORY_CHOICES (a word, so it is checked here, not by skillkit).
    """
    manifest = skillkit.load_manifest(__file__)
    problems = skillkit.check_scalar(manifest, "age", age)
    if memory is None:
        problems += skillkit.check_scalar(manifest, "memory", None)
    elif memory not in MEMORY_CHOICES:
        label = skillkit.spec_by_key(manifest, "memory")["label_zh"]
        problems.append(skillkit.Problem(
            "memory", label, "parse",
            f"--memory 写成「{memory}」。只收 {'、'.join(MEMORY_CHOICES)}。",
        ))
    return problems


def report(args):
    args.out.mkdir(parents=True, exist_ok=True)
    stale = args.out / "problems.json"
    if stale.exists():
        stale.unlink()
    manifest = skillkit.load_manifest(__file__)
    problems = collect_inputs(args.age, args.memory)
    if problems:
        destination = skillkit.write_problems(args.out, problems, TITLE, BOUNDARY)
        text = destination.read_text(encoding="utf-8").replace(
            "这次没有计算。原因如下：", "输入没有通过检查，所以这次没有核对 SuperAger 的定义。原因如下："
        )
        destination.write_text(_with_paper_card(text), encoding="utf-8")
        skillkit.write_result(args.out, manifest, {"superager": None})
        return destination
    if args.memory not in (None, "equal_or_better", "below", "unknown"):
        raise ValueError("memory flag is not one of the paper comparisons")
    items = []
    if args.age is None or args.memory in (None, "unknown"):
        intro = "年龄或情景记忆比较没有给全，这次没有判断是否符合 SuperAger。"
    elif args.age >= SUPERAGER_MIN_AGE and args.memory == "equal_or_better":
        intro = f"{args.age:g} 岁，情景记忆不低于 {MEMORY_REFERENCE_AGE_LOW}–{MEMORY_REFERENCE_AGE_HIGH} 岁，符合 SuperAger 的入组写法。"
        items = [(
            "SuperAger",
            f"{args.age:g} 岁，情景记忆不低于 {MEMORY_REFERENCE_AGE_LOW}–{MEMORY_REFERENCE_AGE_HIGH} 岁，符合 SuperAger 的入组写法。",
        )]
    else:
        intro = "按年龄和情景记忆核对，这次的记录不满足该定义。"
    meds = load_medications(args.medications)
    labs = parse_labs(args.labs) if args.labs else []
    text = render("情景记忆对照", intro, items, meds, labs, [])
    args.out.mkdir(parents=True, exist_ok=True)
    destination = args.out / "report.md"
    destination.write_text(_with_paper_card(text), encoding="utf-8")
    judged = args.age is not None and args.memory not in (None, "unknown")
    skillkit.write_result(args.out, manifest, {"superager": ("符合" if items else "不满足") if judged else None})
    return destination


def add_args(parser):
    parser.add_argument("--age", type=float, default=None)
    parser.add_argument("--memory", default=None)

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--medications", type=Path, default=None)
    parser.add_argument("--labs", type=Path, default=None)
    parser.add_argument("--out", type=Path, required=True)
    add_args(parser)
    args = parser.parse_args(argv)
    path = report(args)
    print(path)
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
