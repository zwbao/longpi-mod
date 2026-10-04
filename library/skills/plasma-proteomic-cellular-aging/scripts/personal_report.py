#!/usr/bin/env python3
from __future__ import annotations

from paper_card import lines as paper_card_lines


import argparse
import csv
from pathlib import Path

from presets import BOUNDARY


def read_rows(path: Path | None) -> list[dict[str, str]]:
    if path is None or not path.exists():
        return []
    with path.open(encoding="utf-8-sig", newline="") as handle:
        sample = handle.read(4096)
        handle.seek(0)
        if not sample.strip():
            return []
        dialect = csv.Sniffer().sniff(sample, delimiters=",\t")
        return list(csv.DictReader(handle, dialect=dialect))


def load_meds(path: Path | None) -> list[str]:
    if path is None or not path.exists():
        return []
    names = []
    for line in path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            names.append(text)
    return names


def as_float(text: str | None) -> float | None:
    if text is None:
        return None
    raw = str(text).strip().replace("＋", "+").replace("－", "-")
    if raw == "":
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def lab_lines(path: Path | None) -> list[str]:
    rows = read_rows(path)
    lines = ["## 体检", ""]
    if not rows:
        lines.append("没有提供体检。体检不增删方法算出的名单。")
        return lines
    lines.append("下面照录体检数值。体检不增删方法算出的名单。")
    for row in rows:
        lowered = {(k or "").strip(): (v or "").strip() for k, v in row.items()}
        item = lowered.get("项目") or lowered.get("item") or lowered.get("name")
        value = lowered.get("结果") or lowered.get("value") or lowered.get("result")
        unit = lowered.get("单位") or lowered.get("unit") or ""
        if item and value:
            suffix = f" {unit}" if unit else ""
            lines.append(f"- {item} {value}{suffix}")
        else:
            bits = [f"{key} {val}".strip() for key, val in lowered.items() if key and val]
            if bits:
                lines.append("- " + "，".join(bits))
    return lines


def medication_lines(meds: list[str], known: set[str]) -> list[str]:
    lines = ["## 你正在使用的药", ""]
    if not meds:
        lines.append("没有提供现用药。")
        return lines
    folded = {name.casefold() for name in known}
    for name in meds:
        if name.casefold() in folded:
            lines.append(f"- {name}：这个名字出现在方法名单里。不能据此停。")
        else:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def finish(lines: list[str]) -> str:
    lines.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def write_report(out: Path, text: str) -> Path:
    out.mkdir(parents=True, exist_ok=True)
    path = out / "report.md"
    path.write_text(_with_paper_card(text if text.endswith("\n") else text + "\n"), encoding="utf-8")
    return path



from presets import MIN_PROTEIN_FEATURES, SEX_FEMALE, SEX_MALE

_MODELS = None


def load_models():
    global _MODELS
    if _MODELS is not None:
        return _MODELS
    path = Path(__file__).resolve().parent / "soma_clock_coefficients_min.csv"
    models = []
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            weights = {}
            for key, value in row.items():
                if key in {"Cell_Type", "Intercept", "Sex"} or not key:
                    continue
                weight = float(value)
                if weight != 0.0:
                    weights[key] = weight
            models.append(
                {
                    "name": row["Cell_Type"],
                    "intercept": float(row["Intercept"]),
                    "sex": float(row["Sex"]),
                    "weights": weights,
                }
            )
    _MODELS = models
    return models


def sex_code(text):
    token = (text or "").strip().lower()
    if token in {"f", "female", "女", "1", "1.0"}:
        return SEX_FEMALE
    if token in {"m", "male", "男", "0", "0.0"}:
        return SEX_MALE
    return None


def parse_person(rows):
    proteins = {}
    sex = None
    for row in rows:
        low = {(k or "").strip().lower(): (v or "").strip() for k, v in row.items() if k}
        name = low.get("item") or low.get("protein") or ""
        value = low.get("value") or ""
        if name.lower() in {"sex", "性别"}:
            sex = sex_code(value)
            continue
        if name.lower() in {"age", "actual_age", "chronological_age"}:
            continue
        number = as_float(value)
        if name and number is not None:
            proteins[name] = number
    return proteins, sex


def scored(rows):
    proteins, sex = parse_person(rows)
    found = []
    if sex is None:
        return found, proteins, sex
    for model in load_models():
        used = [key for key in model["weights"] if key in proteins]
        if len(used) < MIN_PROTEIN_FEATURES:
            continue
        total = model["intercept"] + model["sex"] * sex
        for key, weight in model["weights"].items():
            total += weight * proteins.get(key, 0.0)
        found.append((model["name"], total, len(used), len(model["weights"])))
    return found, proteins, sex


def opening(rows):
    found, _proteins, sex = scored(rows)
    if sex is None:
        return "没有提供性别，所以这次没有算出细胞类型的预测年龄。"
    if not found:
        return "没有细胞类型对上足够的实测蛋白，所以这次没有算出预测年龄。"
    if len(found) == 1:
        name, total, _used, _n = found[0]
        return (
            f"这次算出 {name} 的预测年龄是 {total:.2f} 岁。"
            "没测到的蛋白按人群均值代入。一个人的文件算不出年龄差。"
        )
    names = "、".join(item[0] for item in found)
    return (
        f"这次算出这些细胞类型的预测年龄：{names}。"
        "没测到的蛋白按人群均值代入。一个人的文件算不出年龄差。"
    )


def method_lines(rows):
    found, _proteins, sex = scored(rows)
    lines = ["## 方法算出的名单", ""]
    if sex is None or not found:
        lines.append("- 没有算出的细胞类型。")
        return lines
    for name, total, _used, _n in found:
        lines.append(f"- {name}：预测年龄 {total:.2f} 岁。")
    return lines


def known_names(rows):
    return {name for name, *_rest in scored(rows)[0]}


def render(meds, labs, rows):
    lines = ["# 细胞类型蛋白年龄", "", opening(rows), ""]
    lines.extend(method_lines(rows))
    lines.extend(["", *medication_lines(meds, known_names(rows))])
    lines.extend(["", *lab_lines(labs)])
    return finish(lines)


def report(out, meds, labs, measurements):
    return write_report(out, render(load_meds(meds), labs, read_rows(measurements)))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--measurements", type=Path)
    parser.add_argument("--medications", type=Path)
    parser.add_argument("--labs", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    print(report(args.out, args.medications, args.labs, args.measurements))



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
    main()
