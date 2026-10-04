#!/usr/bin/env python3
"""Personal China-PAR 10-year ASCVD risk (Yang et al., Circulation 2016), men and women.

Two constants are derived from numbers the paper prints (the men's continuous
coefficients and the women's baseline survival); see presets.py and
references/contract.md for how, and for the checks against the paper.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import skillkit
from paper_card import lines as paper_card_lines
from presets import (
    BOUNDARY,
    CATEGORIES,
    DERIVATION_AGES,
    MEAN_MEN,
    MEAN_WOMEN,
    MEN,
    S10_MEN,
    S10_WOMEN,
    WOMEN,
)

TITLE = "China-PAR 10 年动脉粥样硬化性心血管病风险"
FLAGS = ("treated", "smoker", "diabetes", "north", "urban", "family_history")
YES = {"1", "yes", "y", "true", "是", "有"}
NO = {"0", "no", "n", "false", "否", "无", "没有"}
MODIFIABLE = ("sbp_mmhg", "tc_mg_dl", "hdl_mg_dl", "waist_cm")


def terms_men(age: float, sbp: float, treated: bool, tc: float, hdl: float, waist: float,
              smoker: bool, diabetes: bool, north: bool, urban: bool, family_history: bool) -> list[float]:
    """Each coefficient x value, in the order the paper prints them."""
    la = math.log(age)
    ls = math.log(sbp)
    sbp_key = "treated" if treated else "untreated"
    return [
        MEN["ln_age"] * la,
        MEN[f"ln_sbp_{sbp_key}"] * ls,
        MEN["ln_tc"] * math.log(tc),
        MEN["ln_hdl"] * math.log(hdl),
        MEN["ln_waist"] * math.log(waist),
        MEN["diabetes"] * diabetes,
        MEN["north"] * north,
        MEN["urban"] * urban,
        MEN[f"ln_age_x_ln_sbp_{sbp_key}"] * la * ls,
        MEN["smoker"] * smoker,
        MEN["family_history"] * family_history,
        MEN["ln_age_x_smoker"] * la * smoker,
        MEN["ln_age_x_family_history"] * la * family_history,
    ]


def sum_women(age: float, sbp: float, treated: bool, tc: float, hdl: float, waist: float,
              smoker: bool, diabetes: bool, north: bool) -> float:
    """The women's individual sum (Supplemental Table 1 coefficients)."""
    la = math.log(age)
    ls = math.log(sbp)
    key = "treated" if treated else "untreated"
    return (WOMEN["ln_age"] * la + WOMEN[f"ln_sbp_{key}"] * ls + WOMEN["ln_tc"] * math.log(tc)
            + WOMEN["ln_hdl"] * math.log(hdl) + WOMEN["ln_waist"] * math.log(waist) + WOMEN["smoker"] * smoker
            + WOMEN["diabetes"] * diabetes + WOMEN["north"] * north + WOMEN[f"ln_age_x_ln_sbp_{key}"] * la * ls)


def risk_men(total: float) -> float:
    """10-year risk (%) = 1 - S10 ^ exp(sum - mean), Supplemental Table 2."""
    return 100 * (1 - S10_MEN ** math.exp(total - MEAN_MEN))


def risk_women(total: float) -> float:
    return 100 * (1 - S10_WOMEN ** math.exp(total - MEAN_WOMEN))


def category(risk_pct: float) -> str:
    for upper, label in CATEGORIES:
        if risk_pct < upper:
            return label
    return CATEGORIES[-1][1]


def parse_flag(name: str, raw: str | None) -> tuple[bool | None, str | None]:
    if raw is None:
        return None, None
    text = str(raw).strip().lower()
    if text in YES:
        return True, None
    if text in NO:
        return False, None
    return None, f"--{name.replace('_', '-')} 只接受 yes 或 no（是/否），收到「{raw}」。"


def parse_sex(raw: str | None) -> str | None:
    text = (raw or "").strip().lower()
    if text in {"male", "m", "男", "man"}:
        return "male"
    if text in {"female", "f", "女", "woman"}:
        return "female"
    return None


def compute(values: dict, flags: dict, age: float, sex: str = "male") -> dict:
    if sex == "female":
        total = sum_women(age, values["sbp_mmhg"], flags["treated"], values["tc_mg_dl"], values["hdl_mg_dl"],
                          values["waist_cm"], flags["smoker"], flags["diabetes"], flags["north"])
        risk = risk_women(total)
    else:
        total = sum(terms_men(age, values["sbp_mmhg"], flags["treated"], values["tc_mg_dl"], values["hdl_mg_dl"],
                              values["waist_cm"], flags["smoker"], flags["diabetes"], flags["north"], flags["urban"],
                              flags["family_history"]))
        risk = risk_men(total)
    return {"sum": total, "risk_pct": risk, "category": category(risk)}


def levers(values: dict, flags: dict, age: float, targets: dict, sex: str = "male") -> dict:
    """Risk at the current values, sensitivity per unit, and each target moved alone."""
    current = compute(values, flags, age, sex)["risk_pct"]
    sensitivity = []
    for key in MODIFIABLE:
        x = values[key]
        step = 1e-4 * max(1.0, abs(x))
        high = compute(dict(values, **{key: x + step}), flags, age, sex)["risk_pct"]
        low = compute(dict(values, **{key: x - step}), flags, age, sex)["risk_pct"]
        spec = skillkit.spec_by_key(skillkit.load_manifest(__file__), key)
        sensitivity.append({"key": key, "label_zh": spec.get("label_zh", key), "unit": spec.get("unit", ""), "value": x,
                            "per_unit": (high - low) / (2 * step)})
    low, high = DERIVATION_AGES
    waist_note = (
        "男性腰围系数在 Yang 2016 补充表 1 印作 −0.71（系数×值 −3.12）。"
        "腰围变小会让这个模型的风险变高。这不是建议把腰围变大，也不要把减腰围当成这项风险的改善。"
    )
    out = {"schema": "longevity-levers/1", "model": "china-par", "model_zh": "China-PAR（中国成人队列）",
           "current": {"risk_pct": current, "category": category(current)}, "sensitivity": sensitivity, "levers": [],
           "population_age_years": [low, high],
           "age_outside_derivation": not (low <= age <= high),
           "note_zh": "吸烟、糖尿病、降压治疗等是否项不在杠杆里；这里只算血压、血脂、腰围到目标值时的变化。"}
    if sex == "male":
        out["waist_coefficient_sign"] = "negative"
        out["waist_note_zh"] = waist_note
        for item in sensitivity:
            if item["key"] == "waist_cm":
                item["not_a_target"] = True
                item["reason_zh"] = waist_note
    usable = {key: value for key, value in targets.items() if key in MODIFIABLE}
    if usable:
        for key, target in usable.items():
            moved = compute(dict(values, **{key: target}), flags, age, sex)["risk_pct"]
            spec = skillkit.spec_by_key(skillkit.load_manifest(__file__), key)
            lever = {"key": key, "label_zh": spec.get("label_zh", key), "unit": spec.get("unit", ""),
                     "from": values[key], "to": target, "risk_delta_pct": moved - current}
            if sex == "male" and key == "waist_cm":
                lever["not_a_target"] = True
                lever["reason_zh"] = waist_note
            out["levers"].append(lever)
        together = compute(dict(values, **usable), flags, age, sex)["risk_pct"]
        out["targets"] = {"values": usable, "risk_pct": together, "risk_delta_pct": together - current, "category": category(together)}
        out["levers"].sort(key=lambda item: item["risk_delta_pct"])
    return out


def _with_paper_card(text: str) -> str:
    rows = text.splitlines()
    return "\n".join([rows[0], "", *paper_card_lines(), "", *rows[1:]]) + "\n"


def write_report(out_dir: Path, measurements: Path | None, age: float | None, sex: str | None,
                 flag_values: dict, targets: Path | None = None) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    for name in ("problems.json", "levers.json"):
        if (out_dir / name).exists():
            (out_dir / name).unlink()
    manifest = skillkit.load_manifest(__file__)
    collected = skillkit.collect_file(measurements, manifest)
    problems = list(collected.problems)
    problems += skillkit.check_scalar(manifest, "age", age)
    person_sex = parse_sex(sex)
    if person_sex is None:
        problems.append(skillkit.Problem("sex", "性别", "missing", "需要性别（男或女）：China-PAR 男女方程不同。"))
    flags: dict = {}
    for name in FLAGS:
        value, message = parse_flag(name, flag_values.get(name))
        if message:
            problems.append(skillkit.Problem(name, name, "parse", message))
        elif value is None and not (person_sex == "female" and name in ("urban", "family_history")):
            label = skillkit.spec_by_key(manifest, name).get("label_zh", name)
            problems.append(skillkit.Problem(name, label, "missing", f"缺少{label}（--{name.replace('_', '-')} yes 或 no）。"))
        flags[name] = value
    if problems:
        path = skillkit.write_problems(out_dir, problems, TITLE, BOUNDARY)
        path.write_text(_with_paper_card(path.read_text(encoding="utf-8")), encoding="utf-8")
        skillkit.write_result(out_dir, manifest, {"risk_10y_pct": None, "risk_category": None})
        return path

    values = collected.values
    lines = [f"# {TITLE}", "", "## 输入", ""]
    lines.append(f"- 年龄 {age:g} 岁，{'男' if person_sex == 'male' else '女'}")
    lines.append(f"- 收缩压 {values['sbp_mmhg']:g} mmHg（{'两周内用过降压药' if flags['treated'] else '未用降压药'}）")
    lines.append(f"- 总胆固醇 {values['tc_mg_dl']:.1f} mg/dL，高密度脂蛋白胆固醇 {values['hdl_mg_dl']:.1f} mg/dL，腰围 {values['waist_cm']:g} cm")
    yes_no = lambda flag: "是" if flag else "否"
    lines.append(f"- 吸烟 {yes_no(flags['smoker'])}，糖尿病 {yes_no(flags['diabetes'])}，北方 {yes_no(flags['north'])}"
                 + ("" if person_sex == "female" else f"，城市 {yes_no(flags['urban'])}，早发心血管病家族史 {yes_no(flags['family_history'])}"))
    lines += ["", "## 结果", ""]
    low, high = DERIVATION_AGES
    result = compute(values, flags, age, person_sex)
    outputs = {"risk_10y_pct": result["risk_pct"], "risk_category": result["category"]}
    lines.append(f"10 年动脉粥样硬化性心血管病风险 {result['risk_pct']:.1f}%，属于{result['category']}"
                 "（2019 年中国指南：低于 5% 低危，5%–9.9% 中危，10% 及以上高危）。")
    mean, s10 = (MEAN_WOMEN, S10_WOMEN) if person_sex == "female" else (MEAN_MEN, S10_MEN)
    lines.append(f"个人得分 {result['sum']:.2f}，人群平均 {mean}，10 年基线生存率 {s10}。")
    if not low <= age <= high:
        lines.append(f"年龄在方程推导人群（{low}–{high} 岁）之外，结果更不确定。")
    lines += ["", "## 说明", "",
              "- 论文用的是诊室里坐位测三次取平均的收缩压；家用血压计的读数通常偏低，结果会随之偏低。",
              "- 论文印出的两位小数系数和女性基线生存率不够精确，复现不了论文自己的结果。这里男性的六个连续项系数、女性的基线生存率由论文印出的计算示例反推，复现论文表 2 的误差在 1% 以内（见 references/contract.md）。",
              "- 男性腰围的系数在补充表 1 里是负数（印出 −0.71，示例的系数×值是 −3.12）。腰围变小，模型风险变高。这是论文里的系数，不是录入把符号写反了。不要据此建议增大腰围，也不要把减腰围说成这项风险的改善。女性腰围系数是正的（印出 1.48）。" if person_sex == "male" else
              "- 女性腰围系数在补充表 1 里是正的（印出 1.48）。男性方程的腰围系数是负的，两套方程不要混用。",
              "- 这是一组人群的平均风险，不是这个人一定会发生的事。", "", f"边界: {BOUNDARY}"]
    path = out_dir / "report.md"
    path.write_text(_with_paper_card("\n".join(lines) + "\n"), encoding="utf-8")
    skillkit.write_result(out_dir, manifest, outputs)
    wanted = dict(skillkit.collect_file(targets, manifest).values) if targets is not None else {}
    (out_dir / "levers.json").write_text(json.dumps(levers(values, flags, age, wanted, person_sex), ensure_ascii=False, indent=1) + "\n",
                                         encoding="utf-8")
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=TITLE)
    parser.add_argument("--measurements", type=Path, help="CSV item,value,unit: 收缩压, 总胆固醇, 高密度脂蛋白胆固醇, 腰围")
    parser.add_argument("--age", type=float)
    parser.add_argument("--sex")
    for name in FLAGS:
        parser.add_argument(f"--{name.replace('_', '-')}", dest=name)
    parser.add_argument("--targets", type=Path, help="CSV of target values for out/levers.json")
    parser.add_argument("--medications", type=Path, help="accepted and ignored: the equation has no medication term besides treated")
    parser.add_argument("--labs", type=Path, help="accepted and ignored")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    path = write_report(args.out, args.measurements, args.age, args.sex, {name: getattr(args, name) for name in FLAGS}, args.targets)
    sys.stdout.write(str(path) + "\n")
    return skillkit.EXIT_INPUT_PROBLEM if (args.out / "problems.json").exists() else 0


if __name__ == "__main__":
    raise SystemExit(main())
