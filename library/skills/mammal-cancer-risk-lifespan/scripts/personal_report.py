#!/usr/bin/env python3
"""Species CMR lookup, and CMR from the paper's ratio."""

from __future__ import annotations

import csv
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import BOUNDARY, DIET, canonical_species, sex_rows, species_rows

TITLE = "# 哺乳动物癌症死亡比例"


def read_rows(path):
    if path is None:
        return []
    with path.open(encoding="utf-8-sig", newline="") as handle:
        sample = handle.read(4096)
        handle.seek(0)
        if not sample.strip():
            return []
        dialect = csv.Sniffer().sniff(sample, delimiters=",\t")
        return list(csv.DictReader(handle, dialect=dialect))


def load_kv(path):
    rows = read_rows(path)
    out = {}
    if not rows:
        return out
    fields = {(name or "").strip().lower(): name for name in rows[0].keys() if name}
    key_field = "name" if "name" in fields else ("item" if "item" in fields else None)
    if key_field and "value" in fields:
        for row in rows:
            key = (row.get(fields[key_field]) or "").strip()
            if key:
                out[key] = (row.get(fields["value"]) or "").strip()
        return out
    if len(rows) == 1:
        return {key.strip(): (value or "").strip() for key, value in rows[0].items() if key}
    return out


def load_meds(path):
    if path is None:
        return []
    return [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip() and not line.startswith("#")]


def as_float(text):
    if text is None:
        return None
    raw = str(text).strip().replace(",", "")
    if raw == "":
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def fmt(value):
    return f"{value:.6g}"


def pick(kv, *keys):
    lowered = {key.casefold(): value for key, value in kv.items()}
    for key in keys:
        if key.casefold() in lowered:
            return lowered[key.casefold()]
    return None


def cmr_ratio(neoplasia, known_deaths):
    if known_deaths == 0:
        return None
    return neoplasia / known_deaths


def lab_lines(path):
    rows = read_rows(path)
    lines = ["## 体检", ""]
    if not rows:
        lines.append("没有提供体检。体检不增删方法算出的名单。")
        return lines
    lines.append("下面照录体检数值。体检不增删方法算出的名单。")
    for row in rows:
        lowered = {(k or "").strip(): (v or "").strip() for k, v in row.items()}
        item = lowered.get("项目") or lowered.get("item") or ""
        value = lowered.get("结果") or lowered.get("value") or lowered.get("result") or ""
        unit = lowered.get("单位") or lowered.get("unit") or ""
        if item and value:
            suffix = f" {unit}" if unit else ""
            lines.append(f"- {item} {value}{suffix}")
        else:
            bits = [f"{key} {value}".strip() for key, value in lowered.items() if key and value]
            if bits:
                lines.append("- " + "，".join(bits))
    return lines


def medication_lines(meds, names):
    lines = ["## 你正在使用的药", ""]
    if not meds:
        lines.append("没有提供现用药。不能据此停。")
        return lines
    known = {name.casefold() for name in names}
    for name in meds:
        tail = "这个名字出现在名单里" if name.casefold() in known else "名单里没有这个名字"
        lines.append(f"- {name}：{tail}。不能据此停。")
    return lines


def method_items(kv):
    computed = []
    missing = []
    species_text = pick(kv, "species", "物种")
    species = canonical_species(species_text) if species_text else None
    neoplasia = as_float(pick(kv, "neoplasia", "cancer_deaths", "肿瘤死亡数"))
    known = as_float(pick(kv, "known_deaths", "necropsy", "有病理记录的死亡数"))
    sex = pick(kv, "sex", "性别")
    if species_text and species is None:
        missing.append("这个物种不在 data.csv 的 Species 列。")
    elif species:
        row = species_rows()[species]
        computed.append(f"{species} 的表内癌症死亡比例：{fmt(float(row['CMR']))}")
        if row.get("ICM"):
            computed.append(f"{species} 的表内累积癌症死亡：{fmt(float(row['ICM']))}")
        else:
            missing.append(f"{species} 的 ICM 列是空的，不补 0。")
        diets = [label for column, label in DIET if row.get(column) == "1"]
        if diets:
            computed.append(f"{species} 的猎物记录：" + "、".join(diets))
        if sex:
            sex_row = sex_rows().get(species)
            token = sex.strip().casefold()
            if sex_row is None:
                missing.append("性别表没有这个物种的 CMR_F 或 CMR_M 列。不把缺失补成 0。")
            elif token in {"f", "female", "雌"}:
                computed.append(f"{species} 的雌性癌症死亡比例：{fmt(float(sex_row['CMR_F']))}")
            elif token in {"m", "male", "雄"}:
                computed.append(f"{species} 的雄性癌症死亡比例：{fmt(float(sex_row['CMR_M']))}")
            else:
                missing.append("性别对不上雌或雄，不算分性别比例。")
    else:
        missing.append("缺物种列，不能对照 data.csv。")
    if neoplasia is not None and known is not None:
        if known == 0:
            missing.append("有病理记录的死亡数是 0，不能做除法。")
        else:
            computed.append(f"按计数的癌症死亡比例：{fmt(cmr_ratio(neoplasia, known))}")
    elif neoplasia is not None or known is not None:
        missing.append("缺肿瘤死亡数或有病理记录的死亡数，不算你给的比例。")
    missing.append("缺零膨胀系统发育模型的系数列，不用体重去改比例。")
    return computed, missing


def render(meds, labs, measurements):
    computed, missing = method_items(load_kv(measurements))
    lines = [TITLE, "", "## 能算的", ""]
    if computed:
        lines.extend(f"- {item}" for item in computed)
    else:
        lines.append("这次没有算完的读出。")
    lines.extend(["", "## 不能算的", ""])
    lines.extend(f"- {item}" for item in missing)
    listed = [f"- {item}" for item in computed] or ["- 没有进入方法名单的项目"]
    lines.extend(["", "## 方法算出的名单", "", *listed])
    names = []
    for item in computed:
        names.append(item.split("：", 1)[0])
        if "：" in item:
            names.extend(part.strip() for part in item.split("：", 1)[1].split("、"))
    lines.extend(["", *medication_lines(meds, names), "", *lab_lines(labs), "", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def _with_paper_card(text):
    rows = text.splitlines()
    rest = rows[1:]
    while rest and rest[0] == "":
        rest = rest[1:]
    return "\n".join([rows[0], "", *paper_card_lines(), "", *rest]) + "\n"


def report(out, meds, labs, measurements, age=None):
    del age
    out.mkdir(parents=True, exist_ok=True)
    path = out / "report.md"
    path.write_text(_with_paper_card(render(load_meds(meds), labs, measurements)), encoding="utf-8")
    return path


def main():
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--measurements", type=Path)
    parser.add_argument("--medications", type=Path)
    parser.add_argument("--labs", type=Path)
    parser.add_argument("--age", type=float)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    print(report(args.out, args.medications, args.labs, args.measurements, args.age))


if __name__ == "__main__":
    main()
