#!/usr/bin/env python3
"""Personal eGFR with the CKD-EPI 2021 race-free equations (Inker et al., NEJM 2021),
staged with the KDIGO 2024 GFR and albuminuria categories.

Constants and their sources are in presets.py; how each person-facing sentence
maps to KDIGO text is in references/contract.md.
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import skillkit
from paper_card import lines as paper_card_lines
from presets import (
    ACR_CUTS,
    ALBUMINURIA_TERMS,
    BOUNDARY,
    CR_2021,
    CR_CYS_2021,
    GFR_CATEGORIES,
    LOW_EGFR,
    MIN_AGE,
    MONITORING_PER_YEAR,
    REFERRAL_EGFR,
    UMOL_L_PER_MG_DL,
)

TITLE = "肾小球滤过率估计值（eGFR）和 KDIGO 分档"
VISIT_NONE = "不需要特别就诊"
VISIT_SEE = "建议就诊"
VISIT_SOON = "尽快就诊"


def egfr_cr(scr_mg_dl: float, age: float, sex: str) -> float:
    """CKD-EPI 2021 creatinine equation, [P] Table 2 / Table S10. Scr in mg/dL."""
    c = CR_2021
    ratio = scr_mg_dl / c["kappa"][sex]
    value = c["mu"] * min(ratio, 1.0) ** c["a1"][sex] * max(ratio, 1.0) ** c["a2"] * c["age"] ** age
    return value * (c["female"] if sex == "female" else 1.0)


def egfr_cr_cys(scr_mg_dl: float, cys_mg_l: float, age: float, sex: str) -> float:
    """CKD-EPI 2021 creatinine-cystatin C equation, [P] Table 2 / Table S10. Scys in mg/L."""
    c = CR_CYS_2021
    ratio = scr_mg_dl / c["kappa"][sex]
    cys = cys_mg_l / c["cys_knot"]
    value = (c["mu"] * min(ratio, 1.0) ** c["a1"][sex] * max(ratio, 1.0) ** c["a2"]
             * min(cys, 1.0) ** c["b1"] * max(cys, 1.0) ** c["b2"] * c["age"] ** age)
    return value * (c["female"] if sex == "female" else 1.0)


def reported(value: float) -> int:
    """KDIGO Table 11: report eGFR rounded to the nearest whole number (half up, not banker's)."""
    return int(math.floor(value + 0.5))


def gfr_category(egfr_whole: int) -> tuple:
    """KDIGO Table 2 on the reported whole number: (category, KDIGO term, Chinese term)."""
    for lower, name, term, term_zh in GFR_CATEGORIES:
        if egfr_whole >= lower:
            return name, term, term_zh
    raise ValueError(egfr_whole)


def albuminuria_category(value: float, unit: str) -> str:
    """KDIGO Table 3 with the column of the unit the lab reported (mg/g or mg/mmol)."""
    a2_from, a3_above = ACR_CUTS[unit]
    if value < a2_from:
        return "A1"
    if value <= a3_above:
        return "A2"
    return "A3"


def parse_sex(raw: str | None) -> str | None:
    text = (raw or "").strip().lower()
    if text in {"male", "m", "男", "man"}:
        return "male"
    if text in {"female", "f", "女", "woman"}:
        return "female"
    return None


def acr_in_reported_unit(collected: skillkit.Collected) -> tuple:
    """(value, unit) in the unit the row was written in; mg/g when the row carried no unit."""
    value = collected.values["uacr_mg_g"]
    source = collected.sources.get("uacr_mg_g", {})
    if skillkit.normalize_unit(source.get("unit", "")) == "mg/mmol":
        # The number as printed, so 3.0 mg/mmol stays exactly on the Table 3 boundary.
        return skillkit.parse_number(source["value"]), "mg/mmol"
    return value, "mg/g"


def assess(values: dict, age: float, sex: str, acr: tuple | None = None) -> dict:
    """Everything the report says, as plain data. values: creatinine_umol_l and optional cystatin_c_mg_l."""
    scr_mg_dl = values["creatinine_umol_l"] / UMOL_L_PER_MG_DL
    cr_raw = egfr_cr(scr_mg_dl, age, sex)
    out = {"scr_mg_dl": scr_mg_dl, "egfr_cr_raw": cr_raw, "egfr_cr": reported(cr_raw),
           "egfr_cr_cys_raw": None, "egfr_cr_cys": None}
    if values.get("cystatin_c_mg_l") is not None:
        both = egfr_cr_cys(scr_mg_dl, values["cystatin_c_mg_l"], age, sex)
        out.update(egfr_cr_cys_raw=both, egfr_cr_cys=reported(both))
        used, equation = out["egfr_cr_cys"], "eGFRcr-cys"
    else:
        used, equation = out["egfr_cr"], "eGFRcr"
    g, g_term, g_zh = gfr_category(used)
    out.update(egfr_used=used, equation=equation, g=g, g_term=g_term, g_zh=g_zh)
    a = None
    if acr is not None:
        a = albuminuria_category(*acr)
    out["a"] = a
    low = used < LOW_EGFR
    albuminuria = a in ("A2", "A3")
    if used < REFERRAL_EGFR or a == "A3":
        visit = VISIT_SOON
    elif low or albuminuria:
        visit = VISIT_SEE
    else:
        visit = VISIT_NONE
    out["visit"] = visit
    out["checks_per_year"] = None
    if (low or albuminuria) and a is not None:
        out["checks_per_year"] = MONITORING_PER_YEAR[g][int(a[1]) - 1]
    return out


def _with_paper_card(text: str) -> str:
    rows = text.splitlines()
    return "\n".join([rows[0], "", *paper_card_lines(), "", *rows[1:]]) + "\n"


def report_lines(result: dict, values: dict, age: float, sex: str, acr: tuple | None) -> list:
    lines = [f"# {TITLE}", "", "## 输入", ""]
    lines.append(f"- {age:g} 岁，{'男' if sex == 'male' else '女'}")
    lines.append(f"- 血肌酐 {values['creatinine_umol_l']:.0f} µmol/L（{result['scr_mg_dl']:.2f} mg/dL）")
    if values.get("cystatin_c_mg_l") is not None:
        lines.append(f"- 胱抑素 C {values['cystatin_c_mg_l']:.2f} mg/L")
    if acr is not None:
        lines.append(f"- 尿白蛋白/肌酐比 {acr[0]:g} {acr[1]}")
    lines += ["", "## 结果", "", "分档用国际肾脏病指南 KDIGO 2024（下面简称 KDIGO）。", ""]
    lines.append(f"- eGFR（肌酐方程）：{result['egfr_cr']} mL/min/1.73m²")
    if result["egfr_cr_cys"] is not None:
        lines.append(f"- eGFR（肌酐加胱抑素 C 方程）：{result['egfr_cr_cys']} mL/min/1.73m²。"
                     "KDIGO 建议有胱抑素 C 时用这个数分档（推荐 1.1.2.1）。")
    lines.append(f"- GFR 分档：{result['g']}（{result['g_zh']}），按 {result['equation']} = {result['egfr_used']}。")
    if result["a"] is not None:
        term_zh = ALBUMINURIA_TERMS[result["a"]][1]
        lines.append(f"- 白蛋白尿分档：{result['a']}（{term_zh}）。")
    else:
        lines.append("- 白蛋白尿分档：没有尿白蛋白/肌酐比，这一半没法分。")
    lines += ["", "## 这意味着什么", ""]
    lines += meaning_lines(result)
    lines += ["", "## 说明", "",
              "- eGFR 是用血肌酐（和胱抑素 C）、年龄、性别估算的，不是直接测出的肾小球滤过率。方程里年龄本身就会让 eGFR 变低。",
              "- CKD-EPI 2021 方程主要用美国和欧洲人群建立。KDIGO 2024 提到中国等国家有改良版本，化验单上印的 eGFR 如果用了别的方程，数会略有不同。",
              "- eGFR 也用来决定一些药的剂量。如果你在用药，把这次结果给开药的医生或药师看，不要自己加药、减药或停药。",
              "- 趋势（这次和以前比变了多少）不在这里算。",
              "", f"边界: {BOUNDARY}"]
    return lines


def meaning_lines(result: dict) -> list:
    g, a, used = result["g"], result["a"], result["egfr_used"]
    out = []
    if result["visit"] == VISIT_NONE:
        if a == "A1" and g == "G1":
            out.append(f"这次 eGFR {used}，属于 {g}，尿白蛋白/肌酐比在 A1。两项都在正常范围，这是好消息。")
        elif a == "A1":
            out.append(f"这次 eGFR {used}，属于 {g}，尿白蛋白/肌酐比在 A1。两项都没有到需要就诊的切点，这是好消息。")
        else:
            out.append(f"这次 eGFR {used}，属于 {g}，没有到 60 以下。")
        if g == "G2":
            out.append("KDIGO 表 2 注明：没有肾损伤证据时，G1 和 G2 都不算慢性肾脏病。")
        if a is None:
            out.append("还缺尿白蛋白/肌酐比。KDIGO 建议有肾病风险（如高血压、糖尿病）的人把尿白蛋白/肌酐比和 eGFR 一起查"
                       "（实践要点 1.1.1.1），下次体检可以加上。")
        return out
    reasons = []
    if used < LOW_EGFR:
        reasons.append(f"eGFR {used} 低于 60（{g}，KDIGO 表 11 要求把低于 60 标为偏低）")
    if a in ("A2", "A3"):
        reasons.append(f"尿白蛋白/肌酐比在 {a}（{ALBUMINURIA_TERMS[a][1]}）")
    head = "；".join(reasons)
    if result["visit"] == VISIT_SOON:
        if used < REFERRAL_EGFR:
            out.append(f"提示肾功能明显下降：{head}。KDIGO 把 eGFR 低于 30 列为需要转到肾脏专科的情况（图 48）。"
                       "请尽快到肾内科就诊，由医生评估。")
        else:
            out.append(f"提示尿里白蛋白明显偏多：{head}。请尽快到肾内科就诊，由医生评估并复查确认。")
    else:
        out.append(f"提示肾脏指标异常：{head}。建议到肾内科或内科就诊，由医生评估。")
    out.append("一次结果不能确定是慢性肾脏病。KDIGO 2024 这样安排复查：")
    out.append("- 偶然查到 eGFR 偏低或尿白蛋白/肌酐比偏高，要复查确认（实践要点 1.1.1.2）。")
    out.append("- 异常要持续至少 3 个月才算慢性；只看一次结果不能下结论，它可能来自最近一次急性肾损伤（定义和实践要点 1.1.3.1、1.1.3.2）。"
               "所以复查要覆盖 3 个月之内和 3 个月之后。")
    if a in ("A2", "A3"):
        out.append("- 随机尿的比值 ≥30 mg/g（≥3 mg/mmol）要用之后一次早晨第一次排尿的中段尿复查确认（实践要点 1.3.1.2）。")
    if a is None:
        out.append("- 还缺尿白蛋白/肌酐比。就诊时可以一起查，医生才能按 G 和 A 两项判断风险。")
    out.append("- 具体哪一天复查，由医生按你的情况定。")
    if result["checks_per_year"] is not None:
        out.append(f"如果医生确认是慢性肾脏病，KDIGO 图 13 建议 {g}、{a} 这一格每年查 {result['checks_per_year']} 次 eGFR 和尿白蛋白/肌酐比。")
    return out


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
                                         f"年龄 {age:g} 岁。CKD-EPI 2021 方程只用于 18 岁及以上成人，儿童和青少年要用别的方程。"))
    else:
        problems += skillkit.check_scalar(manifest, "age", age)
    person_sex = parse_sex(sex)
    if person_sex is None:
        problems.append(skillkit.Problem("sex", "性别", "missing", "需要性别（男或女）：CKD-EPI 方程男女系数不同。"))
    empty = {spec["key"]: None for spec in manifest["outputs"]}
    if problems:
        path = skillkit.write_problems(out_dir, problems, TITLE, BOUNDARY)
        path.write_text(_with_paper_card(path.read_text(encoding="utf-8")), encoding="utf-8")
        skillkit.write_result(out_dir, manifest, empty)
        return path
    values = dict(collected.values)
    acr = acr_in_reported_unit(collected) if "uacr_mg_g" in values else None
    result = assess(values, age, person_sex, acr)
    path = out_dir / "report.md"
    path.write_text(_with_paper_card("\n".join(report_lines(result, values, age, person_sex, acr)) + "\n"), encoding="utf-8")
    skillkit.write_result(out_dir, manifest, {
        "egfr_cr": result["egfr_cr"],
        "egfr_cr_cys": result["egfr_cr_cys"],
        "gfr_category": result["g"],
        "gfr_category_equation": result["equation"],
        "albuminuria_category": result["a"],
        "kdigo_checks_per_year": result["checks_per_year"],
        "doctor_visit": result["visit"],
    })
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=TITLE)
    parser.add_argument("--measurements", type=Path, help="CSV item,value,unit: 血肌酐, 可选胱抑素C, 可选尿白蛋白/肌酐比")
    parser.add_argument("--age", type=float)
    parser.add_argument("--sex")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    path = write_report(args.out, args.measurements, args.age, args.sex)
    sys.stdout.write(str(path) + "\n")
    return skillkit.EXIT_INPUT_PROBLEM if (args.out / "problems.json").exists() else 0


if __name__ == "__main__":
    raise SystemExit(main())
