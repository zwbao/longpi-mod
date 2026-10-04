#!/usr/bin/env python3
"""Personal phenotypic-age readout. The calculator is Levine et al., Aging 2018.

Phenotypic age uses the original coefficients in BioAge phenoage_calc.R.
KDM biological age is not computed: the clone does not store q, k, s, or s_BA.
Checkup labs and current medicines do not change the nine biomarkers or the age.
"""

from __future__ import annotations

import skillkit
from paper_card import lines as paper_card_lines


import argparse
import csv
import json
import math
import sys
from pathlib import Path

from presets import (
    BOUNDARY,
    GAMMA,
    MORTALITY_NUMERATOR,
    PHENOAGE_BIOMARKERS,
    PHENOAGE_LOG_DENOMINATOR,
    PHENOAGE_LOG_NUMERATOR,
    PHENOAGE_OFFSET,
    PHENOTYPE_INTERCEPT,
    PHENOTYPE_WEIGHTS,
    ACTIVITY_MIXED_MIN,
    ACTIVITY_MODERATE_MIN,
    ACTIVITY_VIGOROUS_MIN,
    ALCOHOL_FEMALE_BELOW_G,
    ALCOHOL_MALE_BELOW_G,
    BMI_NORMAL_BELOW,
    BMI_OBESE_FROM,
    CHILDHOOD_ABUSE_FROM,
    CHILDHOOD_EMOTIONAL_NEGLECT_THROUGH,
    CHILDHOOD_PHYSICAL_NEGLECT_THROUGH,
    GAD7_ITEMS,
    GAD7_TOTAL_MIN,
    ITEM_POSITIVE_MIN,
    PHQ4_ANXIETY_MIN,
    PHQ4_DEPRESSION_MIN,
    PHQ4_EITHER_MIN,
    PHQ9_ITEMS,
    PHQ9_TOTAL_MIN,
    SBP_MMHG,
)



def mortality_risk(values: dict[str, float], crp_transform: str = "ln") -> float:
    """The Gompertz mortality score behind phenotypic age.

    MORTALITY_NUMERATOR is -(exp(120 * GAMMA) - 1): the cumulative hazard over
    120 months, so this is the model's 10-year mortality risk (0-1) for the
    NHANES III population it was fit on. It is a model estimate, not this
    person's risk.
    """
    return 1.0 - math.exp((MORTALITY_NUMERATOR * math.exp(_linear_predictor(values, crp_transform))) / GAMMA)


def phenotypic_age(values: dict[str, float], crp_transform: str) -> float:
    """Levine phenotypic age as coded in phenoage_calc.R when orig=TRUE.

    crp_transform 'ln' is the paper equation. 'log1p' is what
    data-raw/nhanes_all.R stores in the lncrp column before the same weights.
    """
    mortality = mortality_risk(values, crp_transform)
    if not 0.0 < mortality < 1.0:
        raise ValueError("mortality risk is outside (0, 1); phenotypic age is undefined")
    return PHENOAGE_OFFSET + math.log(PHENOAGE_LOG_NUMERATOR * math.log(1.0 - mortality)) / PHENOAGE_LOG_DENOMINATOR


def _linear_predictor(values: dict[str, float], crp_transform: str) -> float:
    crp = values["crp_mg_dl"]
    if crp_transform == "ln":
        if crp <= 0:
            raise ValueError("natural log of CRP needs a positive mg/dL value")
        lncrp = math.log(crp)
    elif crp_transform == "log1p":
        if crp < 0:
            raise ValueError("log1p of CRP needs a non-negative mg/dL value")
        lncrp = math.log1p(crp)
    else:
        raise ValueError(crp_transform)
    xb = PHENOTYPE_INTERCEPT
    paired = {
        "albumin_gL": values["albumin_gL"],
        "creat_umol": values["creat_umol"],
        "glucose_mmol": values["glucose_mmol"],
        "lncrp": lncrp,
        "lymph_pct": values["lymph_pct"],
        "mcv_fl": values["mcv_fl"],
        "rdw_pct": values["rdw_pct"],
        "alp_u_l": values["alp_u_l"],
        "wbc_10e3": values["wbc_10e3"],
        "age": values["age"],
    }
    for key, weight in PHENOTYPE_WEIGHTS.items():
        xb += weight * paired[key]
    return xb


def age_advance(phenoage: float, chronological_age: float) -> float:
    """PhenoAge minus chronological age, as phenoage_advance0 in phenoage_calc.R."""
    return phenoage - chronological_age


def collect_inputs(biomarkers: Path | None, age: float | None) -> tuple[dict[str, float], list]:
    """Read the nine markers through skill.json: aliases, units, and ranges.

    Returns the values in the method's units and the problems that stop the
    computation (wrong or missing unit, out of range, unparsable, duplicated).
    A missing marker is not a problem here; the report says the nine are not
    complete, as before.
    """
    manifest = skillkit.load_manifest(__file__)
    collected = skillkit.collect_file(biomarkers, manifest)
    problems = [item for item in collected.problems if item.kind != "missing"]
    problems += [item for item in skillkit.check_scalar(manifest, "age", age) if item.kind != "missing"]
    return collected.values, problems


MODIFIABLE_NOTE = "年龄不是杠杆；其余九项里，MCV、RDW 很少因生活方式在几个月内明显改变。"


def _phenoage_or_none(values: dict[str, float]) -> float | None:
    try:
        return phenotypic_age(values, "ln")
    except ValueError:
        return None


def levers(values: dict[str, float], targets: dict[str, float]) -> dict:
    """Sensitivity of phenotypic age to each input at the current values, and
    what moving each targeted input alone (then all together) does in this model.

    Sensitivities are central differences of the same formula, in years of
    phenotypic age per unit of the input's method unit. They let a caller turn
    within-person variation into a noise band in years. Nothing here is a
    prediction for this person.
    """
    manifest = skillkit.load_manifest(__file__)
    specs = {item["key"]: item for item in skillkit.input_specs(manifest)}
    current = phenotypic_age(values, "ln")
    current_mortality = 100 * mortality_risk(values)
    sensitivity = []
    for key, label, unit in PHENOAGE_BIOMARKERS:
        x = values[key]
        step = 1e-4 * max(1.0, abs(x))
        low = dict(values, **{key: x - step}) if x - step > 0 else dict(values)
        high = dict(values, **{key: x + step})
        span = high[key] - low[key]
        slope = (phenotypic_age(high, "ln") - phenotypic_age(low, "ln")) / span
        sensitivity.append({"key": key, "label_zh": label, "unit": specs.get(key, {}).get("unit", unit), "value": x, "years_per_unit": slope})
    out = {
        "schema": "longevity-levers/1",
        "model": "phenoage",
        "model_zh": "表型年龄（Levine 2018，NHANES III）",
        "current": {"phenoage": current, "mortality_10y_pct": current_mortality, "age": values.get("age")},
        "sensitivity": sensitivity,
        "levers": [],
        "note_zh": MODIFIABLE_NOTE,
    }
    usable = {key: value for key, value in targets.items() if key in values and key != "age"}
    if usable:
        for key, target in usable.items():
            moved = dict(values, **{key: target})
            phenoage = _phenoage_or_none(moved)
            if phenoage is None:
                continue
            out["levers"].append({
                "key": key,
                "label_zh": specs.get(key, {}).get("label_zh", key),
                "unit": specs.get(key, {}).get("unit", ""),
                "from": values[key],
                "to": target,
                "phenoage_delta": phenoage - current,
                "mortality_delta_pct": 100 * mortality_risk(moved) - current_mortality,
            })
        together = dict(values, **usable)
        phenoage = _phenoage_or_none(together)
        if phenoage is not None:
            out["targets"] = {
                "values": usable,
                "phenoage": phenoage,
                "phenoage_delta": phenoage - current,
                "mortality_10y_pct": 100 * mortality_risk(together),
            }
        out["levers"].sort(key=lambda item: item["phenoage_delta"])
    return out


def load_biomarkers(path: Path) -> dict[str, float]:
    """Values of the nine markers in the method's units (problems dropped)."""
    values, _problems = collect_inputs(path, None)
    return values


def load_lines(path: Path | None) -> list[str]:
    if path is None:
        return []
    names = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            names.append(text)
    return names


def load_numbers(path: Path | None, count: int, label: str) -> list[float] | None:
    if path is None:
        return None
    numbers = []
    for line in path.read_text(encoding="utf-8", errors="replace").replace(",", " ").split():
        if line.startswith("#"):
            continue
        numbers.append(float(line))
    if len(numbers) != count:
        raise ValueError(f"{label} file needs {count} scores")
    return numbers


def load_phq4(path: Path | None) -> list[float] | None:
    return load_numbers(path, 4, "PHQ-4")


CHILDHOOD_WORDS = {
    "never": 0,
    "nevertrue": 0,
    "从不": 0,
    "从不是": 0,
    "rarely": 1,
    "rarelytrue": 1,
    "很少": 1,
    "sometimes": 2,
    "sometimestrue": 2,
    "有时": 2,
    "often": 3,
    "oftentrue": 3,
    "经常": 3,
    "veryoften": 4,
    "veryoftentrue": 4,
    "总是": 4,
}


def load_childhood(path: Path | None) -> list[int] | None:
    if path is None:
        return None
    text = path.read_text(encoding="utf-8", errors="replace").replace(",", " ")
    for phrase in ("very often true", "very often", "never true", "rarely true", "sometimes true", "often true"):
        text = text.replace(phrase, phrase.replace(" ", ""))
        text = text.replace(phrase.title(), phrase.replace(" ", ""))
    answers = []
    for raw in text.split():
        if raw.startswith("#"):
            continue
        key = raw.casefold().replace("_", "")
        if key not in CHILDHOOD_WORDS:
            raise ValueError("childhood file needs five answers: never, rarely, sometimes, often, very often")
        answers.append(CHILDHOOD_WORDS[key])
    if len(answers) != 5:
        raise ValueError("childhood file needs five answers in the paper's item order")
    return answers


def body_mass_index(bmi: float | None, height_m: float | None, weight_kg: float | None) -> float | None:
    if bmi is not None:
        return bmi
    if height_m is None or weight_kg is None:
        return None
    if height_m <= 0:
        raise ValueError("height in meters must be positive")
    return weight_kg / (height_m * height_m)


def bmi_class(bmi: float) -> str:
    if bmi < BMI_NORMAL_BELOW:
        return "体重正常或偏低"
    if bmi < BMI_OBESE_FROM:
        return "超重"
    return "肥胖"


def alcohol_line(grams: float, sex: str | None) -> str:
    label = (sex or "").casefold()
    if label in {"男", "male", "m"}:
        healthy = grams < ALCOHOL_MALE_BELOW_G
        who = "男性"
    elif label in {"女", "female", "f"}:
        healthy = grams < ALCOHOL_FEMALE_BELOW_G
        who = "女性"
    else:
        return f"- 每日酒精 {grams:g} 克：没有性别，不算健康饮酒。"
    state = "算健康饮酒。" if healthy else "不算健康饮酒。"
    return f"- 每日酒精 {grams:g} 克：按论文对{who}的划分，{state}"


def activity_line(moderate: float | None, vigorous: float | None, mixed: float | None) -> str | None:
    given = (moderate, vigorous, mixed)
    if all(item is None for item in given):
        return None
    if any(item is None for item in given):
        return "- 活动分钟没有给全，不算健康活动。"
    healthy = (
        moderate >= ACTIVITY_MODERATE_MIN
        or vigorous >= ACTIVITY_VIGOROUS_MIN
        or mixed >= ACTIVITY_MIXED_MIN
    )
    state = "算健康活动。" if healthy else "不算健康活动。"
    return (
        f"- 每周中等强度 {moderate:g} 分钟、剧烈 {vigorous:g} 分钟、混合 {mixed:g} 分钟："
        f"按论文的划分，{state}"
    )


def symptom_line(title: str, scores: list[float], names: tuple[str, ...], total_min: int) -> str:
    total = sum(scores)
    hit = "达到" if total >= total_min else "没有达到"
    positive = [names[i] for i, score in enumerate(scores) if score >= ITEM_POSITIVE_MIN]
    if positive:
        detail = "单项阳性：" + "、".join(positive) + "。"
    else:
        detail = "没有单项阳性。"
    return f"- {title}合计 {total:g}：合计{hit}症状线。{detail}"


def childhood_score(answers: list[int]) -> int:
    emotional_abuse, physical_abuse, emotional_neglect, sexual_abuse, physical_neglect = answers
    score = 0
    for answer in (emotional_abuse, physical_abuse, sexual_abuse):
        if answer >= CHILDHOOD_ABUSE_FROM:
            score += 1
    if emotional_neglect <= CHILDHOOD_EMOTIONAL_NEGLECT_THROUGH:
        score += 1
    if physical_neglect <= CHILDHOOD_PHYSICAL_NEGLECT_THROUGH:
        score += 1
    return score


def load_labs(path: Path | None) -> list[tuple[str, str, str]]:
    if path is None:
        return []
    text = path.read_text(encoding="utf-8", errors="replace").strip()
    if not text:
        return []
    first = text.splitlines()[0]
    if "项目" in first or "item" in first.casefold():
        rows = list(csv.DictReader(text.splitlines()))
        fields = {name.strip(): name for name in rows[0] if name} if rows else {}
        item_key = fields.get("项目") or fields.get("item") or fields.get("name")
        value_key = fields.get("结果") or fields.get("value") or fields.get("result")
        unit_key = fields.get("单位") or fields.get("unit")
        parsed = []
        for row in rows:
            item = (row.get(item_key, "") if item_key else "").strip()
            value = (row.get(value_key, "") if value_key else "").strip()
            unit = (row.get(unit_key, "") if unit_key else "").strip()
            if item and value:
                parsed.append((item, value, unit))
        return parsed
    parsed = []
    for line in text.splitlines():
        if line.strip():
            parsed.append((line.strip(), "", ""))
    return parsed


def method_names() -> list[str]:
    return [label for _key, label, _unit in PHENOAGE_BIOMARKERS]


def medication_lines(medications: list[str]) -> list[str]:
    names = {label.casefold() for label in method_names()}
    lines = ["## 你正在使用的药", ""]
    if not medications:
        lines.append("没有提供现用药。")
        return lines
    for name in medications:
        if name.casefold() in names:
            lines.append(f"- {name}：这个名字出现在方法名单里。不能据此停。")
        else:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def lab_section(labs: list[tuple[str, str, str]]) -> list[str]:
    lines = ["## 体检", ""]
    if not labs:
        lines.append("没有提供体检。体检不增删方法算出的名单。")
        return lines
    lines.append("下面照录体检数值。体检不增删方法算出的名单。")
    for item, value, unit in labs:
        suffix = f" {unit}" if unit else ""
        lines.append(f"- {item} {value}{suffix}")
    return lines


def phq_lines(phq: list[float]) -> list[str]:
    total = sum(phq)
    depression = phq[0] + phq[1]
    anxiety = phq[2] + phq[3]
    return [
        f"- 问卷四项合计 {total:g}："
        + ("达到筛查线。" if total >= PHQ4_EITHER_MIN else "合计没有达到筛查线。")
        + ("前两项达到抑郁筛查线。" if depression >= PHQ4_DEPRESSION_MIN else "前两项没有达到抑郁筛查线。")
        + ("后两项达到焦虑筛查线。" if anxiety >= PHQ4_ANXIETY_MIN else "后两项没有达到焦虑筛查线。")
    ]


def context_lines(
    sex: str | None,
    bmi: float | None,
    alcohol_g: float | None,
    moderate_min: float | None,
    vigorous_min: float | None,
    mixed_min: float | None,
    sbp: float | None,
    phq9: list[float] | None,
    gad7: list[float] | None,
    childhood: list[int] | None,
) -> list[str]:
    lines = []
    if bmi is not None:
        lines.append(f"- 体重指数 {bmi:.2f}：按论文的划分，属于{bmi_class(bmi)}。")
    if alcohol_g is not None:
        lines.append(alcohol_line(alcohol_g, sex))
    activity = activity_line(moderate_min, vigorous_min, mixed_min)
    if activity is not None:
        lines.append(activity)
    if sbp is not None:
        state = "达到" if sbp >= SBP_MMHG else "没有达到"
        lines.append(f"- 收缩压 {sbp:g} mmHg：{state}论文写出的 {SBP_MMHG:g} mmHg 收缩压线。")
    if phq9 is not None:
        lines.append(symptom_line("抑郁九项", phq9, PHQ9_ITEMS, PHQ9_TOTAL_MIN))
    if gad7 is not None:
        lines.append(symptom_line("焦虑七项", gad7, GAD7_ITEMS, GAD7_TOTAL_MIN))
    if childhood is not None:
        lines.append(f"- 童年逆境五项合计 {childhood_score(childhood)}。")
    return lines


def render_report(
    values: dict[str, float] | None,
    missing: list[str],
    age: float | None,
    sex: str | None,
    phq: list[float] | None,
    medications: list[str],
    labs: list[tuple[str, str, str]],
    bmi: float | None = None,
    alcohol_g: float | None = None,
    moderate_min: float | None = None,
    vigorous_min: float | None = None,
    mixed_min: float | None = None,
    sbp: float | None = None,
    phq9: list[float] | None = None,
    gad7: list[float] | None = None,
    childhood: list[int] | None = None,
) -> str:
    ready = values is not None and age is not None
    lines = ["# 表型年龄", ""]
    if not ready:
        biomarker_missing = [item for item in missing if item != "age"]
        if not biomarker_missing:
            lines.append("没有实足年龄，所以没有表型年龄。")
        elif len(biomarker_missing) == len(PHENOAGE_BIOMARKERS):
            lines.append("九项血液指标没有提供，所以没有表型年龄。")
        else:
            lines.append("九项血液指标没有齐，所以没有表型年龄。")
    else:
        primary = phenotypic_age(values, "ln")
        advance = age_advance(primary, age)
        lines.append(
            f"用你给的九项血液指标算出了表型年龄，是 {primary:.2f} 岁。"
            f"表型年龄减去实足年龄是 {advance:.2f} 岁。"
            "KDM 生物年龄和按队列回归得到的残差没有计算。"
        )
    lines.extend(["", "## 方法算出的名单", ""])
    if not ready:
        lines.append("名单是空的。")
    else:
        for key, label, unit in PHENOAGE_BIOMARKERS:
            lines.append(f"- {label}（{unit}）：{values[key]:g}")
        primary = phenotypic_age(values, "ln")
        advance = age_advance(primary, age)
        lines.append(f"实足年龄 {age:g} 岁。表型年龄 {primary:.2f} 岁。表型年龄减去实足年龄是 {advance:.2f} 岁。")
        lines.append(
            f"同一个模型给出的 10 年死亡风险是 {100 * mortality_risk(values):.1f}%。"
            "这是按 NHANES III 美国人群拟合的模型估计，不是这个人的风险，也不是寿命预测。"
        )
        if phq is not None:
            lines.extend(phq_lines(phq))
    lines.extend(context_lines(sex, bmi, alcohol_g, moderate_min, vigorous_min, mixed_min, sbp, phq9, gad7, childhood))
    lines.extend(["", *medication_lines(medications), "", *lab_section(labs), "", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def write_report(
    out_dir: Path,
    biomarkers: Path | None,
    age: float | None,
    sex: str | None,
    medications: Path | None,
    labs: Path | None,
    phq4: Path | None,
    bmi: float | None = None,
    height_m: float | None = None,
    weight_kg: float | None = None,
    alcohol_g: float | None = None,
    moderate_min: float | None = None,
    vigorous_min: float | None = None,
    mixed_min: float | None = None,
    sbp: float | None = None,
    phq9: Path | None = None,
    gad7: Path | None = None,
    childhood: Path | None = None,
    targets: Path | None = None,
) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    for name in ("problems.json", "levers.json"):
        stale = out_dir / name
        if stale.exists():
            stale.unlink()
    values, problems = collect_inputs(biomarkers, age)
    if problems:
        manifest = skillkit.load_manifest(__file__)
        path = skillkit.write_problems(out_dir, problems, "表型年龄", BOUNDARY)
        text = path.read_text(encoding="utf-8").replace(
            "这次没有计算。原因如下：", "输入没有通过检查，所以没有表型年龄。原因如下："
        )
        path.write_text(_with_paper_card(text), encoding="utf-8")
        skillkit.write_result(out_dir, manifest, {"phenoage": None, "phenoage_advance": None, "mortality_10y_pct": None})
        return path
    if age is not None:
        values["age"] = age
    required = [key for key, _label, _unit in PHENOAGE_BIOMARKERS]
    missing = [key for key in required if key not in values]
    if age is None:
        missing.append("age")
    complete = None if missing else values
    text = render_report(
        complete,
        missing,
        age,
        sex,
        load_phq4(phq4),
        load_lines(medications),
        load_labs(labs),
        body_mass_index(bmi, height_m, weight_kg),
        alcohol_g,
        moderate_min,
        vigorous_min,
        mixed_min,
        sbp,
        load_numbers(phq9, 9, "PHQ-9"),
        load_numbers(gad7, 7, "GAD-7"),
        load_childhood(childhood),
    )
    path = out_dir / "report.md"
    path.write_text(_with_paper_card(text), encoding="utf-8")
    computed = phenotypic_age(complete, "ln") if complete is not None else None
    skillkit.write_result(out_dir, skillkit.load_manifest(__file__), {
        "phenoage": computed,
        "phenoage_advance": age_advance(computed, age) if computed is not None and age is not None else None,
        "mortality_10y_pct": 100 * mortality_risk(complete) if complete is not None else None,
    })
    if complete is not None:
        wanted: dict[str, float] = {}
        if targets is not None:
            collected = skillkit.collect_file(targets, skillkit.load_manifest(__file__))
            wanted = dict(collected.values)
        (out_dir / "levers.json").write_text(json.dumps(levers(complete, wanted), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Phenotypic age readout from Levine et al. 2018")
    parser.add_argument("--biomarkers", type=Path)
    parser.add_argument("--age", type=float)
    parser.add_argument("--sex", default=None)
    parser.add_argument("--medications", type=Path)
    parser.add_argument("--labs", type=Path)
    parser.add_argument("--phq4", type=Path)
    parser.add_argument("--bmi", type=float)
    parser.add_argument("--height-m", type=float)
    parser.add_argument("--weight-kg", type=float)
    parser.add_argument("--alcohol-g", type=float)
    parser.add_argument("--moderate-min", type=float)
    parser.add_argument("--vigorous-min", type=float)
    parser.add_argument("--mixed-min", type=float)
    parser.add_argument("--sbp", type=float)
    parser.add_argument("--phq9", type=Path)
    parser.add_argument("--gad7", type=Path)
    parser.add_argument("--childhood", type=Path)
    parser.add_argument("--targets", type=Path, help="CSV of target values (marker,value,unit) for out/levers.json")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    path = write_report(
        args.out,
        args.biomarkers,
        args.age,
        args.sex,
        args.medications,
        args.labs,
        args.phq4,
        args.bmi,
        args.height_m,
        args.weight_kg,
        args.alcohol_g,
        args.moderate_min,
        args.vigorous_min,
        args.mixed_min,
        args.sbp,
        args.phq9,
        args.gad7,
        args.childhood,
        args.targets,
    )
    sys.stdout.write(str(path) + "\n")
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
    raise SystemExit(main())
