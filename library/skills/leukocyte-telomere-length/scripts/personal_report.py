#!/usr/bin/env python3
"""Place a z-standardised log leukocyte telomere length into the published quartiles.

A raw T/S ratio is recorded and not binned. Labs and medicines do not change the bin.
"""

from __future__ import annotations

import skillkit
from paper_card import lines as paper_card_lines


import argparse
import csv
import sys
from pathlib import Path

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from presets import AGE_SD_PER_YEAR, BOUNDARY, Q1_BELOW, Q2_BELOW, Q4_AT


def load_lines(path: Path | None) -> list[str]:
    if path is None:
        return []
    return [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip() and not line.startswith("#")]


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
    "谷丙转氨酶": "alt", "谷丙": "alt", "alt": "alt",
    "谷草转氨酶": "ast", "谷草": "ast", "ast": "ast",
    "肌酐": "creatinine", "creatinine": "creatinine",
    "肾小球滤过率": "egfr", "egfr": "egfr",
    "血红蛋白": "hemoglobin", "血小板": "platelets",
}


def parse_labs(path: Path | None) -> list[str]:
    if path is None:
        return []
    text = path.read_text(encoding="utf-8", errors="replace")
    lines = [line for line in text.splitlines() if line.strip()]
    parsed: list[str] = []

    def one(item: str, value_text: str) -> None:
        compact = item.casefold().replace(" ", "")
        key = next((panel for alias, panel in LAB_ALIASES.items() if alias.casefold() in compact), None)
        if key is None:
            return
        digits = "".join(ch if ch.isdigit() or ch == "." else " " for ch in value_text).split()
        if not digits:
            return
        value = float(digits[0])
        label, low, high = LAB_PANELS[key]
        if low is not None and value < low:
            bound = f"，低于常见下限 {low:g}"
        elif high is not None and value > high:
            bound = f"，高于常见上限 {high:g}"
        else:
            bound = "，在常见范围内"
        parsed.append(f"- {label} {value:g}{bound}")

    if lines and ("," in lines[0] or "\t" in lines[0]):
        dialect = csv.excel_tab if "\t" in lines[0] else csv.excel
        table = list(csv.DictReader(lines, dialect=dialect))
        fields = {name.strip().lower(): name for name in table[0]} if table else {}
        item_key = fields.get("项目") or fields.get("item") or fields.get("name")
        value_key = fields.get("结果") or fields.get("value") or fields.get("result")
        if item_key and value_key:
            for row in table:
                one(row.get(item_key, ""), row.get(value_key, ""))
    if not parsed:
        for line in lines:
            one(line, line)
    if not parsed:
        return ["没有从体检文件里读到可识别的项目。体检不增删方法算出的名单。"]
    parsed.append("超出常见范围的项目只写在这里。体检不增删方法算出的名单。")
    return parsed


def quartile_name(z: Decimal) -> str:
    if z < Q1_BELOW:
        return "最短"
    if z < Q2_BELOW:
        return "次短"
    if z < Q4_AT:
        return "次长"
    return "最长"


def shortening_years(z: Decimal) -> Decimal:
    return (z / AGE_SD_PER_YEAR).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)


def render(z: Decimal | None, ltl: float | None, meds: list[str], labs: list[str]) -> str:
    if z is None and ltl is None:
        intro = "这次没有给出 z 标准化后的对数端粒，所以没有分档。"
        items = ["- 端粒分档：这次没有分档。"]
    elif z is None:
        intro = (
            f"你给出的未标准化端粒测量是 {ltl:g}。"
            "论文先取对数再做 z 标准化，对数的队列均值和标准差没有印出来，所以这次不分档。"
        )
        items = ["- 端粒分档：这次没有分档。"]
    else:
        name = quartile_name(z)
        years = shortening_years(z)
        if years >= 0:
            slope = f"相当于横断面缩短 {years} 年"
        else:
            slope = f"相当于横断面少缩短 {abs(years)} 年"
        raw = ""
        if ltl is not None:
            raw = f"另外给出的未标准化测量是 {ltl:g}，没有拿来分档。"
        intro = (
            f"这次把 z 标准化后的对数端粒 {z} 放进论文表 2 的分档，结果是{name}。"
            f"按表 3，年龄每增加一年这个 z 下降 0.024，{slope}。"
            "那是队列斜率对照，不是年龄。"
            + raw
        )
        items = [
            f"- 端粒分档：{name}。z 是 {z}。",
            f"- 年龄斜率对照：{slope}。",
        ]
    lines = ["# 白细胞端粒", "", intro, "", "## 方法算出的名单", ""]
    lines.extend(items)
    lines.extend(["", *medication_lines(meds)])
    lines.extend(["", *exam_section(labs)])
    lines.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def collect_inputs(z: Decimal | None, ltl: float | None) -> list:
    """Range-check --z and --ltl through skill.json.

    Returns the problems that stop the binning (a value outside its range,
    such as a telomere length in kb). A missing z is not a problem here; the
    report says no z was given, as before. A raw T/S ratio passed as --z stays
    inside the z range and cannot be caught here.
    """
    manifest = skillkit.load_manifest(__file__)
    problems = skillkit.check_scalar(manifest, "z", None if z is None else float(z))
    problems += skillkit.check_scalar(manifest, "ltl", ltl)
    return [item for item in problems if item.kind != "missing"]


def report(
    out: Path,
    ltl: float | None = None,
    medications: Path | None = None,
    labs: Path | None = None,
    z: Decimal | float | None = None,
) -> Path:
    z_value = None if z is None else Decimal(str(z))
    out.mkdir(parents=True, exist_ok=True)
    stale = out / "problems.json"
    if stale.exists():
        stale.unlink()
    manifest = skillkit.load_manifest(__file__)
    problems = collect_inputs(z_value, ltl)
    if problems:
        path = skillkit.write_problems(out, problems, "白细胞端粒", BOUNDARY)
        text = path.read_text(encoding="utf-8").replace(
            "这次没有计算。原因如下：", "输入没有通过检查，所以这次没有分档。原因如下："
        )
        path.write_text(_with_paper_card(text), encoding="utf-8")
        skillkit.write_result(out, manifest, {"ltl_quartile": None})
        return path
    text = render(z_value, ltl, load_lines(medications), parse_labs(labs))
    destination = out / "report.md"
    destination.write_text(_with_paper_card(text), encoding="utf-8")
    skillkit.write_result(out, manifest, {
        "ltl_quartile": quartile_name(z_value) if z_value is not None else None,
    })
    return destination


def decimal_arg(text: str) -> Decimal:
    """--z as a Decimal. Text that is not a number is an argparse error, as for --ltl."""
    try:
        value = Decimal(text)
        float(value)  # a signalling NaN parses as a Decimal but cannot be range-checked
    except (InvalidOperation, ValueError):
        raise argparse.ArgumentTypeError(f"invalid number: {text!r}") from None
    return value


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Bin a z-standardised log leukocyte telomere length")
    parser.add_argument("--z", type=decimal_arg, default=None)
    parser.add_argument("--ltl", type=float, default=None)
    parser.add_argument("--medications", type=Path, default=None)
    parser.add_argument("--labs", type=Path, default=None)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    print(report(args.out, args.ltl, args.medications, args.labs, args.z))
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
