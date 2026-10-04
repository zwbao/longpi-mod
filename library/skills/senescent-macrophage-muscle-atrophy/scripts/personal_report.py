#!/usr/bin/env python3
"""Personal readout for the senescent-macrophage muscle atrophy paper.

Assay formulas run only when every named input is present.
Mouse doses are not printed.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import BOUNDARY, COMPOUNDS, TITLE


def load_measurements(path: Path | None) -> list[tuple[str, str]]:
    if path is None:
        return []
    text = path.read_text(encoding="utf-8", errors="replace")
    lines = [line.strip() for line in text.splitlines() if line.strip() and not line.strip().startswith("#")]
    if not lines:
        return []
    start = 1 if lines[0].split(",")[0].strip().casefold() in {"name", "项目", "指标"} else 0
    rows = []
    for line in lines[start:]:
        if "," in line:
            name, value = line.split(",", 1)
            rows.append((name.strip(), value.strip()))
        else:
            rows.append((line.strip(), ""))
    return rows


def load_lines(path: Path | None) -> list[str]:
    if path is None:
        return []
    names = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            names.append(text)
    return names


def load_labs(path: Path | None) -> list[tuple[str, str, str]]:
    if path is None:
        return []
    text = path.read_text(encoding="utf-8", errors="replace").strip()
    if not text:
        return []
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    start = 1 if lines and lines[0].split(",")[0].strip() in {"项目", "item", "name"} else 0
    rows = []
    for line in lines[start:]:
        parts = [part.strip() for part in line.split(",")]
        if len(parts) >= 2 and parts[0] not in {"项目", "item"}:
            unit = parts[2] if len(parts) > 2 else ""
            rows.append((parts[0], parts[1], unit))
    return rows


def fold(text: str) -> str:
    return text.casefold().replace(" ", "").replace("_", "").replace("-", "")


def lookup(measurements, aliases):
    keys = {fold(alias) for alias in aliases}
    for name, value in measurements:
        if fold(name) in keys:
            try:
                return float(value)
            except ValueError:
                return "bad"
    return None


def num(value):
    return f"{value:g}"


def compound_display(medication: str):
    folded = fold(medication)
    for display, aliases in COMPOUNDS:
        tokens = {fold(display), *(fold(alias) for alias in aliases)}
        if folded in tokens:
            return display
    return None


def medication_lines(medications: list[str]) -> list[str]:
    lines = ["## 你正在使用的药", ""]
    if not medications:
        lines.append("没有提供现用药。")
        return lines
    for name in medications:
        display = compound_display(name)
        if display is None:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
        else:
            lines.append(f"- {name}：对应名单上的 {display}。名次不是继续或停用的理由。")
    return lines


def lab_section(labs: list[tuple[str, str, str]]) -> list[str]:
    lines = ["## 体检", ""]
    if not labs:
        lines.append("没有提供体检。体检不增删方法算出的名单。")
        return lines
    lines.append("下面照录体检。体检不增删方法算出的名单。")
    for item, value, unit in labs:
        suffix = f" {unit}" if unit else ""
        lines.append(f"- {item} {value}{suffix}")
    return lines


def assay_lines(measurements):
    computed = []
    missing = []
    total = lookup(measurements, ("total_iron", "总铁"))
    ferrous = lookup(measurements, ("ferrous_iron", "亚铁"))
    mass = lookup(measurements, ("quadriceps_mass", "股四头肌质量", "muscle_mass"))
    if total == "bad" or ferrous == "bad":
        missing.append("总铁或亚铁这一列不是数字。")
    elif total is None or ferrous is None:
        missing.append("三价铁缺总铁列或亚铁列。")
    else:
        ferric = total - ferrous
        computed.append(f"三价铁等于总铁减去亚铁，结果是 {num(ferric)}。")
        if mass == "bad":
            missing.append("股四头肌质量这一列不是数字，没有写成每克含量。")
        elif mass is None:
            missing.append("缺股四头肌质量列，没有写成每克含量。")
        elif mass == 0:
            missing.append("股四头肌质量是 0，没有除。")
        else:
            computed.append(f"三价铁除以股四头肌质量，每克含量是 {num(ferric / mass)}。")

    sample = lookup(measurements, ("sample_od", "样本吸光度"))
    blank = lookup(measurements, ("blank_od", "空白吸光度"))
    standard = lookup(measurements, ("standard_od", "标准吸光度"))
    standard_conc = lookup(measurements, ("standard_concentration", "标准浓度"))
    protein = lookup(measurements, ("protein_concentration", "蛋白浓度"))
    lpo_inputs = (sample, blank, standard, standard_conc, protein)
    if any(item == "bad" for item in lpo_inputs):
        missing.append("脂质过氧化物有一列不是数字。")
    elif any(item is None for item in lpo_inputs):
        missing.append("脂质过氧化物缺样本吸光度、空白吸光度、标准吸光度、标准浓度或蛋白浓度。")
    elif standard == blank:
        missing.append("标准吸光度等于空白吸光度，分母不能用。")
    elif protein == 0:
        missing.append("蛋白浓度是 0，没有除。")
    else:
        lpo = (sample - blank) / (standard - blank) * standard_conc / protein
        computed.append(f"脂质过氧化物按吸光度和蛋白浓度算出，结果是 {num(lpo)}。")

    amount = lookup(measurements, ("b", "B"))
    volume = lookup(measurements, ("v", "V"))
    dilution = lookup(measurements, ("d", "D", "稀释倍数"))
    asn = (amount, volume, dilution)
    if any(item == "bad" for item in asn):
        missing.append("L-天冬酰胺的 B、V 或 D 不是数字。")
    elif amount is None or volume is None or dilution is None:
        missing.append("L-天冬酰胺缺 B、V 或稀释倍数 D。")
    elif volume == 0:
        missing.append("V 是 0，没有除。")
    else:
        computed.append(f"L-天冬酰胺等于 B 除以 V 再乘 D，结果是 {num(amount / volume * dilution)}。")

    initial = lookup(measurements, ("initial_dual_stance", "初始双足支撑"))
    terminal = lookup(measurements, ("terminal_dual_stance", "终末双足支撑"))
    if initial == "bad" or terminal == "bad":
        missing.append("双足支撑有一列不是数字。")
    elif initial is None or terminal is None:
        missing.append("双足支撑缺初始双足支撑或终末双足支撑。")
    else:
        computed.append(f"双足支撑等于初始加终末，结果是 {num(initial + terminal)}。")

    csa_sum = lookup(measurements, ("csa_sum", "横截面积之和"))
    n_fibers = lookup(measurements, ("n_fibers", "肌纤维数"))
    if csa_sum == "bad" or n_fibers == "bad":
        missing.append("平均横截面积有一列不是数字。")
    elif csa_sum is None or n_fibers is None:
        missing.append("平均横截面积缺横截面积之和或肌纤维数。")
    elif n_fibers == 0:
        missing.append("肌纤维数是 0，没有除。")
    else:
        computed.append(f"平均横截面积等于横截面积之和除以肌纤维数，结果是 {num(csa_sum / n_fibers)}。")

    missing.append("肌球蛋白重链 IIa 与 IIb 的比值没有算。印刷式把 MyHC-IIa 写在分子和分母，缺 IIb 计数列。")
    return computed, missing


def render_report(measurements, medications, labs, age) -> str:
    computed, missing = assay_lines(measurements)
    lines = [f"# {TITLE}", "", "## 方法算出的名单", ""]
    index = 1
    for display, _aliases in COMPOUNDS:
        lines.append(f"{index}. {display}：小鼠实验里出现过这个名字，没有个人剂量。")
        index += 1
    for sentence in computed:
        lines.append(f"{index}. {sentence}")
        index += 1
    lines.extend(["", "## 不能算的", ""])
    for sentence in missing:
        lines.append(f"- {sentence}")
    if age is not None:
        lines.append("提供了年龄。年龄不进入这些测定式。")
    lines.append("")
    lines.extend(medication_lines(medications))
    lines.extend(["", *lab_section(labs), "", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def method_section(text: str) -> str:
    start = text.index("## 方法算出的名单\n")
    end = text.index("\n## 不能算的")
    return text[start:end]


def write_report(out_dir, measurements, medications, labs, age=None) -> Path:
    text = render_report(
        load_measurements(measurements),
        load_lines(medications),
        load_labs(labs),
        age,
    )
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "report.md"
    path.write_text(_with_paper_card(text), encoding="utf-8")
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Senescent macrophage muscle atrophy readout")
    parser.add_argument("--measurements", type=Path)
    parser.add_argument("--medications", type=Path)
    parser.add_argument("--labs", type=Path)
    parser.add_argument("--age", type=float)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    path = write_report(args.out, args.measurements, args.medications, args.labs, args.age)
    sys.stdout.write(str(path) + "\n")
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
