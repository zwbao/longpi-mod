#!/usr/bin/env python3
"""Personal body fat from circumferences (Hodgdon & Beckett 1984, U.S. Navy) and waist cut-offs:
waist-to-height ratio 0.5 (Ashwell & Hsieh 2005; Browning et al. 2010), waist-to-hip ratio
(WHO 2008 Annex Table A1) and Chinese central obesity by waist (WS/T 428-2013 Table 2).

Constants and sources are in presets.py; checks against the reports' own tables are in
references/contract.md.
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import skillkit
from paper_card import lines as paper_card_lines
from presets import (
    BOUNDARY,
    CN_LABELS,
    CN_WAIST,
    DERIVATION,
    MEN,
    SIRI,
    WHR_CUTOFF,
    WHR_LABELS,
    WHTR_BOUNDARY,
    WHTR_LABELS,
    WOMEN,
)

TITLE = "体脂率（海军围度方程）和腰围分档"
MIN_AGE = 18


def density_men(waist_cm: float, neck_cm: float, height_cm: float) -> float:
    """[M] p. 12, all in cm: -0.19077 log10(abdomen - neck) + 0.15456 log10(height) + 1.0324."""
    return -MEN["a"] * math.log10(waist_cm - neck_cm) + MEN["b"] * math.log10(height_cm) + MEN["c"]


def density_women(waist_cm: float, hip_cm: float, neck_cm: float, height_cm: float) -> float:
    """[W] p. 12, all in cm: -0.35004 log10(abdomen I + hip - neck) + 0.22100 log10(height) + 1.29579."""
    return -WOMEN["a"] * math.log10(waist_cm + hip_cm - neck_cm) + WOMEN["b"] * math.log10(height_cm) + WOMEN["c"]


def siri(density: float) -> float:
    """Siri (1961) as printed in [M]/[W] Table 1: %BF = 100[(4.95/BD) - 4.50]."""
    return 100 * (SIRI[0] / density - SIRI[1])


def body_fat(sex: str, waist_cm: float, neck_cm: float, height_cm: float, hip_cm: float | None = None) -> float:
    if sex == "male":
        return siri(density_men(waist_cm, neck_cm, height_cm))
    if hip_cm is None:
        raise ValueError("women need hip circumference")
    return siri(density_women(waist_cm, hip_cm, neck_cm, height_cm))


def whtr_category(ratio: float) -> str:
    return WHTR_LABELS[1] if ratio >= WHTR_BOUNDARY else WHTR_LABELS[0]


def whr_category(ratio: float, sex: str) -> str:
    return WHR_LABELS[1] if ratio >= WHR_CUTOFF[sex] else WHR_LABELS[0]


def central_obesity_cn(waist_cm: float, sex: str) -> str:
    pre, obese = CN_WAIST[sex]
    if waist_cm >= obese:
        return CN_LABELS[2]
    if waist_cm >= pre:
        return CN_LABELS[1]
    return CN_LABELS[0]


def parse_sex(raw: str | None) -> str | None:
    text = (raw or "").strip().lower()
    if text in {"male", "m", "男", "man"}:
        return "male"
    if text in {"female", "f", "女", "woman"}:
        return "female"
    return None


def assess(values: dict, sex: str) -> dict:
    waist = values["waist_cm"]
    hip, neck, height = values.get("hip_cm"), values.get("neck_cm"), values.get("height_cm")
    out = {"body_fat_pct": None, "fat_note": None, "whtr": None, "whr": None}
    needed = ["neck_cm", "height_cm"] + (["hip_cm"] if sex == "female" else [])
    missing = [key for key in needed if values.get(key) is None]
    if missing:
        names = {"neck_cm": "颈围", "height_cm": "身高", "hip_cm": "臀围"}
        out["fat_note"] = f"缺{'、'.join(names[key] for key in missing)}，没有估算体脂率。"
    else:
        composite = waist - neck if sex == "male" else waist + hip - neck
        if composite <= 0:
            out["fat_note"] = "腰围减颈围（女性是腰围加臀围减颈围）不是正数，公式不能用，请核对测量。"
        else:
            fat = body_fat(sex, waist, neck, height, hip)
            if fat < 0:
                out["fat_note"] = f"算出的体脂率是 {fat:.1f}%，低于 0，说明这组测量超出了公式的适用范围，请核对腰围和颈围。"
            else:
                out["body_fat_pct"] = fat
    if height is not None:
        out["whtr"] = waist / height
    if hip is not None:
        out["whr"] = waist / hip
    out["cn"] = central_obesity_cn(waist, sex)
    return out


def _with_paper_card(text: str) -> str:
    rows = text.splitlines()
    return "\n".join([rows[0], "", *paper_card_lines(), "", *rows[1:]]) + "\n"


def report_lines(result: dict, values: dict, sex: str, age: float | None) -> list:
    d = DERIVATION[sex]
    lines = [f"# {TITLE}", "", "## 输入", ""]
    who = "男" if sex == "male" else "女"
    lines.append(f"- {who}" + (f"，{age:g} 岁" if age is not None else ""))
    shown = {"height_cm": "身高", "neck_cm": "颈围", "waist_cm": "腰围", "hip_cm": "臀围"}
    lines.append("- " + "，".join(f"{label} {values[key]:.1f} cm" for key, label in shown.items() if values.get(key) is not None))
    lines += ["", "## 结果", ""]
    flags = []
    if result["body_fat_pct"] is not None:
        lines.append(f"- 体脂率（美国海军围度方程估计）：{result['body_fat_pct']:.1f}%。估计误差（标准误）约 {d['see_pct']} 个百分点，"
                     f"在建立方程的海军人群里，大约三分之二的人真实值落在 {result['body_fat_pct'] - d['see_pct']:.0f}%–{result['body_fat_pct'] + d['see_pct']:.0f}% 之间。"
                     "两份报告没有给体脂率的健康分档，这里只报数字。")
    else:
        lines.append(f"- 体脂率：{result['fat_note']}")
    if result["whtr"] is not None:
        cat = whtr_category(result["whtr"])
        lines.append(f"- 腰围身高比：{result['whtr']:.3f}，{cat}（界值 0.5：腰围最好不超过身高的一半）。")
        if result["whtr"] >= WHTR_BOUNDARY:
            flags.append("腰围身高比达到 0.5")
    else:
        lines.append("- 腰围身高比：缺身高，没有算。")
    if result["whr"] is not None:
        cut = WHR_CUTOFF[sex]
        cat = whr_category(result["whr"], sex)
        lines.append(f"- 腰臀比：{result['whr']:.3f}，{cat}（WHO：{who}性 ≥{cut:.2f} 时代谢并发症风险显著增加）。")
        if result["whr"] >= cut:
            flags.append(f"腰臀比达到 {cut:.2f}")
    else:
        lines.append("- 腰臀比：缺臀围，没有算。")
    pre, obese = CN_WAIST[sex]
    lines.append(f"- 按国家标准 WS/T 428-2013：{result['cn']}（{who}性 {pre:g} cm ≤ 腰围 < {obese:g} cm 为中心型肥胖前期，腰围 ≥{obese:g} cm 为中心型肥胖）。")
    if result["cn"] != CN_LABELS[0]:
        flags.append(f"腰围在国家标准的{result['cn']}")
    lines += ["", "## 这意味着什么", ""]
    if flags:
        who_note = "WHO 把腰臀比达到切点称为代谢并发症风险显著增加。" if any(item.startswith("腰臀比") for item in flags) else ""
        lines.append(f"提示腹部脂肪偏多：{'；'.join(flags)}。{who_note}"
                     "这不是诊断。如果近一年没有查过血压、空腹血糖和血脂，可以在下次体检时一起查，由医生评估。")
        lines.append("以后按同样的位置和姿势再量，前后两次才能比较。")
    else:
        lines.append("算了的几项都在切点以下，腹部脂肪没有超标的迹象，这是好的信号。")
    lines += ["", "## 说明", "",
              f"- 海军方程由美国海军现役人员建立：男性 {DERIVATION['male']['n']} 人（{DERIVATION['male']['ages'][0]}–{DERIVATION['male']['ages'][1]} 岁），"
              f"女性 {DERIVATION['female']['n']} 人（{DERIVATION['female']['ages'][0]}–{DERIVATION['female']['ages'][1]} 岁），以水下称重为标准。"
              "用在中国成人身上，误差可能比上面的数更大。",
              "- 量腰围的位置：海军男性方程在肚脐水平，女性方程在腰最细处；腰臀比（WHO）和国家标准在腋中线肋弓下缘和髂嵴连线中点。"
              "这里只用你给的一个腰围，位置不同会让结果差一些。",
              "- 腰围身高比 0.5 来自 Ashwell 和 Hsieh（2005）的提议和 Browning 等（2010）的系统综述。",
              ]
    if age is not None:
        low, high = d["ages"]
        if not low <= age <= high:
            lines.append(f"- 你的年龄 {age:g} 岁不在{who}性方程的推导年龄（{low}–{high} 岁）内，体脂率的误差更难估计。")
    lines += ["", f"边界: {BOUNDARY}"]
    return lines


def write_report(out_dir: Path, measurements: Path | None, age: float | None, sex: str | None) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    stale = out_dir / "problems.json"
    if stale.exists():
        stale.unlink()
    manifest = skillkit.load_manifest(__file__)
    collected = skillkit.collect_file(measurements, manifest)
    problems = list(collected.problems)
    if age is not None and age < MIN_AGE:
        problems.append(skillkit.Problem("age", "实足年龄", "range",
                                         f"年龄 {age:g} 岁。海军方程和这些腰围切点只用于 18 岁及以上成人。"))
    elif age is not None:
        problems += skillkit.check_scalar(manifest, "age", age)
    person_sex = parse_sex(sex)
    if person_sex is None:
        problems.append(skillkit.Problem("sex", "性别", "missing", "需要性别（男或女）：体脂方程和腰围切点男女不同。"))
    if problems:
        path = skillkit.write_problems(out_dir, problems, TITLE, BOUNDARY)
        path.write_text(_with_paper_card(path.read_text(encoding="utf-8")), encoding="utf-8")
        skillkit.write_result(out_dir, manifest, {spec["key"]: None for spec in manifest["outputs"]})
        return path
    values = dict(collected.values)
    result = assess(values, person_sex)
    path = out_dir / "report.md"
    path.write_text(_with_paper_card("\n".join(report_lines(result, values, person_sex, age)) + "\n"), encoding="utf-8")
    skillkit.write_result(out_dir, manifest, {
        "body_fat_pct": result["body_fat_pct"],
        "waist_height_ratio": result["whtr"],
        "waist_height_category": whtr_category(result["whtr"]) if result["whtr"] is not None else None,
        "waist_hip_ratio": result["whr"],
        "waist_hip_category": whr_category(result["whr"], person_sex) if result["whr"] is not None else None,
        "central_obesity_cn": result["cn"],
    })
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=TITLE)
    parser.add_argument("--measurements", type=Path, help="CSV item,value,unit: 腰围（必填）, 身高, 颈围, 臀围")
    parser.add_argument("--age", type=float)
    parser.add_argument("--sex")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    path = write_report(args.out, args.measurements, args.age, args.sex)
    sys.stdout.write(str(path) + "\n")
    return skillkit.EXIT_INPUT_PROBLEM if (args.out / "problems.json").exists() else 0


if __name__ == "__main__":
    raise SystemExit(main())
