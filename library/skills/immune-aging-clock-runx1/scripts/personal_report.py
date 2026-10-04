#!/usr/bin/env python3
"""Score pAge, tAge, and TCRAge from the frozen Table S3 coefficients."""

from __future__ import annotations

import argparse
import csv
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from presets import (
    ARTICLE_URL,
    BOUNDARY,
    BULK_SKIP,
    CARD_CITE,
    CARD_SUMMARY,
    CARD_TITLE,
    DOI_URL,
    IMM_SKIP,
    PAGE_INPUT,
    PT_SKIP,
    REPO,
    SEX_CODE,
    TABLE_S3_URL,
    TAGE_INPUT,
    TCR_INPUT,
    UNREADABLE,
    linear_score,
)

TABLE_PATH = Path(__file__).with_name("table_s3.csv")
UNREADABLE_SUFFIXES = {
    ".pdf",
    ".idat",
    ".bam",
    ".fq",
    ".fastq",
    ".xlsx",
    ".xls",
    ".rdata",
    ".rds",
    ".h5",
    ".h5ad",
    ".gz",
}
HEADER_MAP = {
    "clock": "clock",
    "type": "clock",
    "时钟": "clock",
    "cell": "cell",
    "celltype": "cell",
    "细胞": "cell",
    "细胞类型": "cell",
    "feature": "feature",
    "gene": "feature",
    "特征": "feature",
    "基因": "feature",
    "项目": "feature",
    "item": "feature",
    "value": "value",
    "数值": "value",
    "结果": "value",
}
CLOCK_MAP = {
    "page": "pAge",
    "tage": "tAge",
    "tcrage": "TCRAge",
    "ptage": "ptAge",
    "immage": "immAge",
    "bulkimmage": "bulk-immAge",
    "bulk-immage": "bulk-immAge",
}


def load_models() -> dict[tuple[str, str], dict[str, Decimal]]:
    grouped: dict[tuple[str, str], dict[str, Decimal]] = {}
    with TABLE_PATH.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            key = (row["type"], row["cell_type"])
            grouped.setdefault(key, {})[row["feature"]] = Decimal(row["coefficient"])
    return grouped


def load_lines(path: Path | None) -> list[str]:
    if path is None:
        return []
    rows = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            rows.append(text)
    return rows


def parse_labs(path: Path | None) -> list[tuple[str, str, str]]:
    if path is None:
        return []
    found = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if not text or text.startswith("#") or text.startswith("项目"):
            continue
        parts = [part.strip() for part in text.replace("，", ",").split(",")]
        if len(parts) < 2:
            parts = text.split()
        if len(parts) < 2:
            continue
        unit = parts[2] if len(parts) > 2 else ""
        found.append((parts[0], parts[1], unit))
    return found


def lab_lines(path: Path | None) -> list[str]:
    rows = parse_labs(path)
    lines = ["## 体检", ""]
    if not rows:
        lines.append("没有提供体检。体检不增删方法算出的名单。")
        return lines
    lines.append("下面照录体检数值。体检不增删方法算出的名单。")
    for name, value, unit in rows:
        unit_bit = f" {unit}" if unit else ""
        lines.append(f"- {name} {value}{unit_bit}")
    return lines


def medication_lines(names: list[str]) -> list[str]:
    lines = ["## 你正在使用的药", ""]
    if not names:
        lines.append("没有提供现用药。不能据此停。")
        return lines
    for name in names:
        lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def paper_card() -> list[str]:
    return [
        "## 论文卡片",
        "",
        f"**{CARD_TITLE}**",
        "",
        CARD_CITE,
        "",
        f"[文章页]({ARTICLE_URL})",
        f"[DOI]({DOI_URL})",
        f"[Table S3 系数表]({TABLE_S3_URL})",
        f"[代码仓库]({REPO})",
        "",
        CARD_SUMMARY,
    ]


def encode_sex(sex: str | None) -> Decimal | None:
    if sex is None:
        return None
    token = sex.strip().casefold()
    if token in {"f", "female", "女", "0"}:
        return Decimal(0)
    if token in {"m", "male", "男", "1"}:
        return Decimal(1)
    return None


def years(value: Decimal) -> str:
    rounded = value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return f"{rounded} 岁"


def _header_key(name: str | None) -> str:
    raw = (name or "").strip().casefold().replace(" ", "").replace("_", "")
    return HEADER_MAP.get(raw, raw)


def _clock_name(text: str) -> str | None:
    token = text.strip()
    if token in {"pAge", "tAge", "TCRAge", "ptAge", "immAge", "bulk-immAge"}:
        return token
    return CLOCK_MAP.get(token.casefold().replace(" ", ""))


def _decimal(text: str) -> Decimal | None:
    raw = text.strip().replace(",", "")
    if raw == "":
        return None
    try:
        return Decimal(raw)
    except Exception:
        return None


def _canon(name: str, choices: dict[str, object]) -> str | None:
    if name in choices:
        return name
    folded = {key.casefold(): key for key in choices}
    return folded.get(name.casefold())


class MeasurementFile:
    def __init__(self) -> None:
        self.blocked = ""
        self.values: dict[tuple[str, str], dict[str, Decimal]] = {}
        self.conflicts: set[tuple[str, str]] = set()
        self.bad: set[tuple[str, str]] = set()
        self.unknown_cells: list[str] = []


def read_measurements(path: Path | None, models: dict[tuple[str, str], dict[str, Decimal]]) -> MeasurementFile:
    parsed = MeasurementFile()
    if path is None:
        parsed.blocked = "没有提供测量表。"
        return parsed
    if not path.exists():
        raise FileNotFoundError(path)
    if path.is_dir() or path.suffix.lower() in UNREADABLE_SUFFIXES:
        parsed.blocked = f"{UNREADABLE}这份文件不算时钟。"
        return parsed
    text = path.read_text(encoding="utf-8-sig", errors="replace")
    if not text.strip():
        parsed.blocked = "测量表是空的。这份表不算时钟。"
        return parsed
    reader = csv.DictReader(text.splitlines())
    if reader.fieldnames is None:
        parsed.blocked = "测量表没有表头。表头需要 clock、cell_type、feature、value。"
        return parsed
    fields = {_header_key(name): name for name in reader.fieldnames if name}
    if "feature" not in fields or "value" not in fields:
        parsed.blocked = "测量表没有 feature 和 value 列。表头需要 clock、cell_type、feature、value。"
        return parsed
    t_cells = {cell: coefs for (clock, cell), coefs in models.items() if clock == "tAge"}
    for row in reader:
        feature_raw = (row.get(fields["feature"]) or "").strip()
        value_raw = (row.get(fields["value"]) or "").strip()
        if not feature_raw or feature_raw.startswith("#"):
            continue
        clock_raw = (row.get(fields["clock"]) or "").strip() if "clock" in fields else ""
        cell_raw = (row.get(fields["cell"]) or "").strip() if "cell" in fields else ""
        clock = _clock_name(clock_raw) if clock_raw else ""
        if clock in {"ptAge", "immAge", "bulk-immAge"}:
            continue
        if clock == "tAge":
            cell = _canon(cell_raw, t_cells) if cell_raw else None
            if cell is None:
                parsed.unknown_cells.append(cell_raw or "未填写细胞类型")
                continue
            key = ("tAge", cell)
            coefs = models[key]
        elif clock == "pAge":
            key = ("pAge", "")
            coefs = models[key]
        elif clock == "TCRAge":
            key = ("TCRAge", "")
            coefs = models[key]
        else:
            parsed.unknown_cells.append(clock_raw or feature_raw)
            continue
        feature = _canon(feature_raw, coefs)
        if feature is None or feature == "(Intercept)":
            parsed.unknown_cells.append(feature_raw)
            continue
        value = _decimal(value_raw)
        bucket = parsed.values.setdefault(key, {})
        if value is None:
            parsed.bad.add(key)
            continue
        if feature in bucket and bucket[feature] != value:
            parsed.conflicts.add(key)
            continue
        bucket[feature] = value
    return parsed


def _gap(names: list[str], unit: str) -> str:
    if len(names) <= 8:
        return "缺 " + "、".join(names)
    return f"缺 {len(names)} 个{unit}"


def _score_line(label: str, coefs: dict[str, Decimal], values: dict[str, Decimal], suffix: str, unit: str) -> str:
    missing = [name for name in coefs if name != "(Intercept)" and name not in values]
    if missing:
        return f"{label}：{_gap(missing, unit)}，没有算。"
    return f"{label}：{years(linear_score(coefs, values))}。{suffix}"


def clock_lines(parsed: MeasurementFile, sex: str | None, models: dict[tuple[str, str], dict[str, Decimal]]) -> list[str]:
    lines = ["## 这次算出的时钟", ""]
    if parsed.blocked:
        lines.append(parsed.blocked)
        lines.append(PT_SKIP)
        lines.append(IMM_SKIP)
        lines.append(BULK_SKIP)
        return lines
    page = parsed.values.get(("pAge", ""))
    if ("pAge", "") in parsed.conflicts:
        lines.append("pAge：同一特征有两个不同数值，没有算。")
    elif ("pAge", "") in parsed.bad:
        lines.append("pAge：有无法读取的数值，没有算。")
    elif page:
        lines.append(_score_line("pAge", models[("pAge", "")], page, PAGE_INPUT, "细胞比例"))
    else:
        lines.append("pAge：没有提供细胞比例。")

    t_keys = [key for key in parsed.values if key[0] == "tAge"]
    if not t_keys:
        lines.append("tAge：没有提供对数表达。")
    for key in sorted(t_keys):
        label = f"tAge（{key[1]}）"
        if key in parsed.conflicts:
            lines.append(f"{label}：同一特征有两个不同数值，没有算。")
        elif key in parsed.bad:
            lines.append(f"{label}：有无法读取的数值，没有算。")
        else:
            lines.append(_score_line(label, models[key], parsed.values[key], TAGE_INPUT, "基因"))
    unknown = []
    seen = set()
    for name in parsed.unknown_cells:
        if name not in seen:
            unknown.append(name)
            seen.add(name)
    if unknown:
        shown = "、".join(unknown[:8])
        lines.append(f"测量表里这些名字对不上 Table S3 的时钟或细胞类型：{shown}。")

    tcr_key = ("TCRAge", "")
    tcr_values = dict(parsed.values.get(tcr_key, {}))
    sex_code = encode_sex(sex)
    if sex_code is not None:
        tcr_values["gender"] = sex_code
    if tcr_key in parsed.conflicts:
        lines.append("TCRAge：同一特征有两个不同数值，没有算。")
    elif tcr_key in parsed.bad:
        lines.append("TCRAge：有无法读取的数值，没有算。")
    elif not parsed.values.get(tcr_key):
        lines.append("TCRAge：没有提供 TCR 指标。")
    elif sex_code is None and "gender" not in parsed.values.get(tcr_key, {}):
        lines.append(f"TCRAge：缺性别。{SEX_CODE}没有算。")
    else:
        lines.append(_score_line("TCRAge", models[tcr_key], tcr_values, TCR_INPUT, "TCR 指标"))
    lines.append(PT_SKIP)
    lines.append(IMM_SKIP)
    lines.append(BULK_SKIP)
    return lines


def context_lines(age: float | None, sex: str | None) -> list[str]:
    lines = ["## 上下文", ""]
    if age is None:
        lines.append("没有提供实足年龄。实足年龄用来对照，不代替上面算出的时钟。")
    else:
        lines.append(f"实足年龄 {age:g} 岁。实足年龄用来对照，不代替上面算出的时钟。")
    if sex:
        lines.append(f"性别 {sex}。{SEX_CODE}")
    else:
        lines.append(f"没有提供性别。{SEX_CODE}")
    return lines


def render(age, meds, labs, measurements, sex, models) -> str:
    lines = ["# 免疫衰老时钟", "", *paper_card(), ""]
    lines.extend(clock_lines(read_measurements(measurements, models), sex, models))
    lines.extend(["", "## 方法算出的名单", "", "名单是空的。", ""])
    lines.extend(medication_lines(load_lines(meds)))
    lines.extend(["", *lab_lines(labs)])
    lines.extend(["", *context_lines(age, sex)])
    lines.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def report(out, age=None, medications=None, labs=None, measurements=None, sex=None):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    path = out / "report.md"
    path.write_text(
        render(age, medications, labs, measurements, sex, load_models()),
        encoding="utf-8",
    )
    return path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--age", type=float)
    parser.add_argument("--sex")
    parser.add_argument("--medications", type=Path)
    parser.add_argument("--labs", type=Path)
    parser.add_argument("--measurements", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    print(report(args.out, args.age, args.medications, args.labs, args.measurements, args.sex))


if __name__ == "__main__":
    main()
