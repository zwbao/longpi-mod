#!/usr/bin/env python3
"""Personal readout of published mtDNA QC cuts and the ten Figure 3 variants."""

from __future__ import annotations

import argparse
import csv
import sys
from decimal import Decimal, InvalidOperation
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import (
    AGE_SNV_AFTER,
    BOUNDARY,
    CHR302_ALLELES,
    CONTAMINATION_EXCLUDE_ABOVE,
    COVERAGE_MIN,
    HET_REFERENCE_BELOW,
    HET_REMOVE_BELOW,
    HOMOPLASMY_AT,
    MTCN_EXCLUDE_BELOW,
    PATHOGENIC,
    TITLE,
)


def load_measurements(path):
    if path is None:
        return {}
    text = path.read_text(encoding="utf-8")
    rows = {}
    lines = [line for line in text.splitlines() if line.strip() and not line.strip().startswith("#")]
    if not lines:
        return rows
    start = 1 if "," in lines[0] and lines[0].split(",")[0].strip().lower() in {"name", "项目", "key", "item"} else 0
    for line in lines[start:]:
        if "," not in line:
            continue
        key, value = line.rsplit(",", 1)
        rows[key.strip().strip('"')] = value.strip().strip('"')
    return rows


def load_medications(path):
    if path is None:
        return []
    names = []
    for line in path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            names.append(text)
    return names


def parse_labs(path):
    if path is None:
        return []
    text = path.read_text(encoding="utf-8")
    lines = [line for line in text.splitlines() if line.strip()]
    if not lines:
        return []
    if "项目" in lines[0] and "," in lines[0]:
        found = []
        for row in csv.DictReader(lines):
            name = (row.get("项目") or row.get("name") or "").strip()
            value = (row.get("结果") or row.get("value") or "").strip()
            unit = (row.get("单位") or row.get("unit") or "").strip()
            if name:
                found.append((name, value, unit))
        return found
    return [(line.strip(), "", "") for line in lines]


def medication_lines(medications, list_lines):
    lines = ["## 你正在使用的药", ""]
    if not medications:
        lines.append("没有提供现用药。")
        return lines
    blob = "\n".join(list_lines)
    for name in medications:
        if name and name in blob:
            lines.append(f"- {name}：这个名字出现在方法名单里。不能据此停。")
        else:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def lab_block(labs):
    rows = ["## 体检", ""]
    if not labs:
        rows.append("没有提供体检。体检不增删方法算出的名单。")
        return rows
    rows.append("下面照录体检数值。体检不增删方法算出的名单。")
    for name, value, unit in labs:
        shown = " ".join(part for part in (name, value, unit) if part)
        rows.append(f"- {shown}")
    return rows


def variant_key(name):
    text = name.strip().lower().replace("chrm:", "").replace("m.", "")
    for token in (">", ",", ":", " ", "-"):
        text = text.replace(token, "")
    return text


def as_fraction(value):
    number = Decimal(str(value).strip())
    if number < 0:
        raise ValueError("negative")
    if number > 1:
        if number <= 100:
            return number / Decimal("100")
        raise ValueError("scale")
    return number


def fmt(number):
    text = format(Decimal(str(number)), "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text


def cut(value):
    return Decimal(str(value))


def heteroplasmy_phrase(fraction):
    if fraction < cut(HET_REFERENCE_BELOW):
        return "低于 0.01，方法把它记为参考、异质性为 0，不算质控后的携带者"
    if fraction < cut(HET_REMOVE_BELOW):
        return "低于 0.05，方法把这种调用剔除，不算质控后的携带者"
    if fraction >= cut(HOMOPLASMY_AT):
        return "不低于 0.95，方法称为纯质，并算作质控后的携带者"
    return "不低于 0.05 且低于 0.95，方法保留该异质性，并算作质控后的携带者"


def build(values, age):
    computed = []
    missing = [
        "校正后拷贝数缺这些系数列：血细胞组成、采血时刻、一年中的月份、空腹时长。它们写在 Supplementary Notes 2 和 3，这次没有打开成可套用的系数。",
        "大约每十年下降的说法不是印出来的斜率，不用来外推拷贝数。",
        "全基因组关联的效应量没有收成个人分数的截距，不算拷贝数多基因分数。",
    ]
    used = set()

    for raw_name, raw_value in values.items():
        key = variant_key(raw_name)
        if key not in PATHOGENIC:
            continue
        label, note = PATHOGENIC[key]
        used.add(raw_name)
        try:
            fraction = as_fraction(raw_value)
        except (ValueError, InvalidOperation):
            missing.append(f"{label} 的值不是 0 到 1 的异质性，也不是不超过 100 的百分数。")
            continue
        computed.append(f"{label}：异质性 {fmt(fraction)}，{heteroplasmy_phrase(fraction)}。{note}")

    coverage_keys = [name for name in values if name.lower().startswith("coverage:")]
    for name in coverage_keys:
        used.add(name)
        site = name.split(":", 1)[1]
        try:
            depth = Decimal(str(values[name]).strip())
        except (ValueError, InvalidOperation):
            missing.append(f"{site} 的覆盖度不是数字。")
            continue
        if depth < COVERAGE_MIN:
            computed.append(f"{site} 的覆盖度 {fmt(depth)} 低于 {COVERAGE_MIN}，不能把它当成纯合参考。")
        else:
            computed.append(f"{site} 的覆盖度 {fmt(depth)} 达到 {COVERAGE_MIN}，可以参与纯合参考的判断。")

    allele_values = []
    allele_ready = True
    for allele in CHR302_ALLELES:
        if allele not in values:
            allele_ready = False
            continue
        used.add(allele)
        try:
            allele_values.append((allele, as_fraction(values[allele])))
        except (ValueError, InvalidOperation):
            allele_ready = False
            missing.append(f"{allele} 的值不是异质性分数。")
    if any(allele in values for allele in CHR302_ALLELES) and not allele_ready:
        missing.append("chrM:302 的参考比例缺列：chrM:302:A,AC、chrM:302:A,ACC、chrM:302:A,ACCC、chrM:302:Other。")
    elif allele_ready and allele_values:
        depth_name = "chrM:302:depth"
        blocked = False
        if depth_name in values:
            used.add(depth_name)
            try:
                depth = Decimal(str(values[depth_name]).strip())
            except (ValueError, InvalidOperation):
                missing.append("chrM:302 覆盖度不是数字，不算参考比例。")
                blocked = True
            else:
                if depth < COVERAGE_MIN:
                    computed.append(f"chrM:302 覆盖度 {fmt(depth)} 低于 {COVERAGE_MIN}，方法排除该样本，不算参考比例。")
                    blocked = True
        else:
            missing.append("没有 chrM:302 覆盖度列，不能按低于 100 的规则排除样本。")
        if not blocked:
            total = sum(item[1] for item in allele_values)
            reference = Decimal("1") - total
            parts = []
            for allele, fraction in allele_values:
                if fraction < cut(HET_REMOVE_BELOW):
                    parts.append(f"{allele} 为 {fmt(fraction)}，低于 0.05，归入 Other")
                else:
                    parts.append(f"{allele} 为 {fmt(fraction)}")
            computed.append(
                "chrM:302 参考比例是 1 减去各等位基因异质性之和，等于 "
                f"{fmt(reference)}。" + "；".join(parts) + "。"
            )

    for name in ("mtCN", "mtCNraw", "线粒体拷贝数"):
        if name not in values:
            continue
        used.add(name)
        try:
            copies = Decimal(str(values[name]).strip())
        except (ValueError, InvalidOperation):
            missing.append("线粒体拷贝数不是数字，不能对照低于 50 的剔除规则。")
            continue
        if copies < MTCN_EXCLUDE_BELOW:
            computed.append(f"线粒体拷贝数 {fmt(copies)} 低于 {MTCN_EXCLUDE_BELOW}，方法会剔除该样本，以免核线粒体假基因污染。这不是校正后拷贝数。")
        else:
            computed.append(f"线粒体拷贝数 {fmt(copies)} 不低于 {MTCN_EXCLUDE_BELOW}，不因这条规则剔除。这不是校正后拷贝数。")

    for name in ("contamination", "污染比例"):
        if name not in values:
            continue
        used.add(name)
        try:
            fraction = as_fraction(values[name])
        except (ValueError, InvalidOperation):
            missing.append("污染比例不是数字。")
            continue
        if fraction > cut(CONTAMINATION_EXCLUDE_ABOVE):
            computed.append(f"污染比例 {fmt(fraction)} 超过 0.02，方法剔除该样本。")
        else:
            computed.append(f"污染比例 {fmt(fraction)} 没有超过 0.02，不因这条规则剔除。")

    if age is not None:
        if age > AGE_SNV_AFTER:
            computed.append(f"年龄已过 {AGE_SNV_AFTER} 岁。正文写异质性单核苷酸变异在这个年龄之后急剧累积。这不是变异计数。")
        else:
            computed.append(f"年龄还没有过 {AGE_SNV_AFTER} 岁。正文写异质性单核苷酸变异在这个年龄之后才急剧累积。这不是变异计数。")

    unknown = [name for name in values if name not in used and not name.lower().startswith("coverage:")]
    if unknown:
        missing.append("这些测量对不上十个致病变异、chrM:302 或拷贝数质控，没有另造权重：" + "、".join(unknown) + "。")
    return computed, missing


def render(computed, missing, meds, labs, age):
    del age
    intro = "这次按方法里的质控切点和图 3 的十个致病变异读测量。校正后拷贝数不在能算的结果里。"
    body = [f"# {TITLE}", "", intro, "", "## 能算的", ""]
    if computed:
        body.append("能算的结果写在方法名单里。")
    else:
        body.append("这次没有可归类的异质性、拷贝数或年龄。")
    body.extend(["", "## 不能算的", ""])
    body.extend(missing)
    body.extend(["", "## 方法算出的名单", ""])
    if computed:
        body.extend(f"{i}. {line}" for i, line in enumerate(computed, start=1))
    else:
        body.append("没有项目进入名单。")
    body.extend(["", *medication_lines(meds, [str(item) for item in computed])])
    body.extend(["", *lab_block(labs)])
    body.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(body) + "\n"


def report(out, measurements=None, medications=None, labs=None, age=None):
    computed, missing = build(load_measurements(measurements), age)
    text = render(computed, missing, load_medications(medications), parse_labs(labs), age)
    out.mkdir(parents=True, exist_ok=True)
    destination = out / "report.md"
    destination.write_text(_with_paper_card(text), encoding="utf-8")
    return destination


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--measurements", type=Path, default=None)
    parser.add_argument("--medications", type=Path, default=None)
    parser.add_argument("--labs", type=Path, default=None)
    parser.add_argument("--age", type=float, default=None)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    print(report(args.out, args.measurements, args.medications, args.labs, args.age))
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
