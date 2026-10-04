#!/usr/bin/env python3
"""Run published aging clocks with pyaging on one person's feature matrix.

pyaging (Camillo, Bioinformatics 2024) holds the clock weights; this script
does not copy them. It checks the matrix, runs the named clocks, and writes a
report with every value and every warning pyaging printed. pyaging and pandas
are imported only when clocks run, so the checks and the report can be tested
without them.

pyaging reads a clock's features only from the columns of ``adata.X`` and fills
any it cannot find with the clock's reference values. GrimAge and a few other
clocks take chronological age (``age``) and sex (``female``, 1 = female) as
features, and their reference values describe a 65-year-old woman. This script
therefore writes ``age`` and ``female`` into the feature matrix from ``--age``
and ``--sex`` (or keeps the matrix's own ``age``/``female`` columns), never
moves them to ``adata.obs``, and refuses to run such a clock without them.
"""

from __future__ import annotations

import argparse
import contextlib
import csv
import io
import math
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import skillkit

TITLE = "pyaging 衰老时钟"
BOUNDARY = (
    "时钟读数是模型估计，不是诊断，也不是开始或停止任何药物的理由。"
    "缺失探针被补值时读数会变，报告照录 pyaging 的提示。DunedinPACE 是速度，不是年龄。"
)
DEFAULT_CLOCKS = ("horvath2013",)
MAX_SAMPLES = 20
MAX_BYTES = 200_000_000
EXIT_MISSING_RUNTIME = 4
SPEED_CLOCKS = {"dunedinpace", "dunedinpoam38"}
PACE_UNIT = "biological years per chronological year"
YEAR_UNITS = {"years", "year"}

# pyaging's own feature names for the two covariates. They are features of the
# clocks below, read from adata.X, so they must never go to adata.obs.
AGE, FEMALE = "age", "female"
COVARIATES = (AGE, FEMALE)
AGE_RANGE = (0.0, 120.0)

# Clocks whose model.features include "age" or "female" at pyaging edb1b37,
# read from clocks/notebooks/<clock>.ipynb (and, for cpgptgrimage3 and
# cpgptpcgrimage3, the weight table the notebook loads). A missing covariate is
# filled from model.reference_values (GrimAge: 1 and 65, "65 yo F") or with 0.
CLOCK_COVARIATES: Dict[str, Tuple[str, ...]] = {
    "grimage": (AGE, FEMALE),
    "grimage2": (AGE, FEMALE),
    "pcgrimage": (AGE, FEMALE),
    "dnamfitage": (AGE, FEMALE),
    "kdmage": (AGE, FEMALE),
    "linage2": (AGE, FEMALE),
    "grimage2adm": (AGE,),
    "grimage2b2m": (AGE,),
    "grimage2cystatinc": (AGE,),
    "grimage2gdf15": (AGE,),
    "grimage2loga1c": (AGE,),
    "grimage2packyrs": (AGE,),
    "grimage2timp1": (AGE,),
    "dnamfitagevo2max": (AGE,),
    "cpgptgrimage3": (AGE,),
    "cpgptpcgrimage3": (AGE,),
    "phenoage": (AGE,),
    "phenoagesaopaulo": (AGE,),
    "dnamfitagegait": (FEMALE,),
    "dnamfitagegrip": (FEMALE,),
    "homeostaticdysregulation": (FEMALE,),
}

# result.json key -> pyaging clock name. The key is "dnam_" plus the clock name
# without its own leading "dnam". pyaging's "phenoage" is the blood-chemistry
# clock and has no key here, so it can never be written as dnam_phenoage.
OUTPUT_CLOCKS: Dict[str, str] = {
    "dnam_horvath2013": "horvath2013",
    "dnam_skinandblood": "skinandblood",
    "dnam_hannum": "hannum",
    "dnam_phenoage": "dnamphenoage",
    "dnam_grimage": "grimage",
    "dnam_grimage2": "grimage2",
    "dnam_lin": "lin",
    "dnam_altumage": "altumage",
    "dnam_pedbe": "pedbe",
    "dnam_stoch": "stoch",
    "dnam_stocp": "stocp",
    "dnam_stocz": "stocz",
    "dnam_yingcausage": "yingcausage",
    "dnam_yingdamage": "yingdamage",
    "dnam_yingadaptage": "yingadaptage",
    "dnam_dunedinpace": "dunedinpace",
    "dnam_dunedinpoam38": "dunedinpoam38",
    "dnam_tl": "dnamtl",
    "dnam_zhangmortality": "zhangmortality",
    "dnam_epitoc1": "epitoc1",
}

UNIT_ZH = {
    "kilobases": "kb（千碱基）",
    "beta value": "β 值",
    "unitless": "无单位分数",
    "probability": "概率",
    "proportion": "比例",
    "ratio": "比值",
    "pack-years": "包年",
    "units per week": "酒精单位/周",
    "months": "月",
    "weeks": "周",
    "days": "天",
    "hours": "小时",
    "log hazard": "对数风险",
    "log odds": "对数几率",
}

LABEL_ZH = {AGE: "实足年龄", FEMALE: "性别"}
FLAG = {AGE: "--age", FEMALE: "--sex"}


@dataclass
class Prediction:
    """What one pyaging run returned.

    values: {sample: {clock: value}}. units: {clock: adata.uns[f"{clock}_metadata"]["unit"]},
    a list such as ["kilobases"] or its text. filled: {clock: covariates pyaging
    filled from reference values because the matrix did not carry them}.
    """

    values: Dict[str, Dict[str, float]]
    warnings: List[str] = field(default_factory=list)
    units: Dict[str, object] = field(default_factory=dict)
    filled: Dict[str, List[str]] = field(default_factory=dict)


def manifest() -> dict:
    return skillkit.load_manifest(__file__)


def card_lines() -> List[str]:
    tool = manifest().get("tool", {})
    lines = ["## 工具卡片", "", "**pyaging**", ""]
    lines.append(f"版本 {tool.get('version', '')}（{tool.get('commit', '')}）。Camillo。Bioinformatics，2024。doi:{tool.get('doi', '')}。")
    lines += ["", f"[代码]({tool.get('upstream', '')}) · [DOI](https://doi.org/{tool.get('doi', '')})", ""]
    lines.append("pyaging 把已发表的甲基化、转录组和血液化学时钟放在同一个框架里运行。个人报告只照录它对你交来的矩阵算出的数，不重新训练任何时钟。")
    return lines


def parse_sex(raw: Optional[str]) -> Optional[float]:
    """1.0 for female, 0.0 for male, None when the text is not a sex."""
    text = (raw or "").strip().lower()
    if text in {"female", "f", "女", "女性", "woman"}:
        return 1.0
    if text in {"male", "m", "男", "男性", "man"}:
        return 0.0
    return None


def read_header(path: Path) -> Tuple[List[str], int]:
    """Column names and the number of data rows, without loading the whole file into pandas."""
    with path.open(encoding="utf-8-sig", errors="replace", newline="") as handle:
        reader = csv.reader(handle)
        header = next(reader, [])
        rows = sum(1 for row in reader if any(cell.strip() for cell in row))
    return header, rows


def beta_problems(path: Path, skip: List[str]) -> List[skillkit.Problem]:
    """Methylation beta values must be on the 0–1 scale. Covariate and metadata columns are skipped."""
    outside = 0
    total = 0
    with path.open(encoding="utf-8-sig", errors="replace", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            for key, value in list(row.items())[1:]:
                if key in skip or value in ("", None):
                    continue
                try:
                    number = float(value)
                except ValueError:
                    continue
                total += 1
                if not (0.0 <= number <= 1.0):
                    outside += 1
    if total and outside / total > 0.01:
        return [skillkit.Problem(
            "matrix", "甲基化矩阵", "range",
            f"矩阵里有 {outside} 个值不在 0 到 1 之间。甲基化时钟要 β 值；百分比请除以 100，M 值请先换成 β 值。",
        )]
    return []


def check_matrix(path: Optional[Path], metadata: List[str], data_type: str) -> List[skillkit.Problem]:
    if path is None or not path.exists():
        return [skillkit.Problem("matrix", "特征矩阵", "missing", "缺少特征矩阵文件。")]
    if path.suffix.lower() in {".idat", ".pdf", ".xlsx"}:
        return [skillkit.Problem("matrix", "特征矩阵", "parse", f"{path.name} 不是 CSV。IDAT 要先预处理成 β 值矩阵，PDF 和表格请导出成 CSV。")]
    if path.stat().st_size > MAX_BYTES:
        return [skillkit.Problem("matrix", "特征矩阵", "parse", "矩阵文件超过 200 MB。只保留要跑的时钟用到的列。")]
    header, rows = read_header(path)
    if len(header) < 2 or rows == 0:
        return [skillkit.Problem("matrix", "特征矩阵", "parse", "矩阵需要表头，第一列是样本名，其余列是特征，至少一行数据。")]
    if rows > MAX_SAMPLES:
        return [skillkit.Problem("matrix", "特征矩阵", "parse", f"矩阵有 {rows} 个样本。个人读出最多 {MAX_SAMPLES} 个。")]
    return beta_problems(path, [*metadata, *COVARIATES]) if data_type == "methylation" else []


def covariate_columns(path: Path) -> Tuple[Dict[str, Dict[str, float]], List[skillkit.Problem]]:
    """The matrix's own age and female columns, {name: {sample: value}}, checked row by row."""
    found: Dict[str, Dict[str, float]] = {}
    problems: List[skillkit.Problem] = []
    with path.open(encoding="utf-8-sig", errors="replace", newline="") as handle:
        reader = csv.reader(handle)
        header = next(reader, [])
        where = {name: header.index(name, 1) for name in COVARIATES if name in header[1:]}
        if not where:
            return found, problems
        bad: Dict[str, List[str]] = {name: [] for name in where}
        for row in reader:
            if not any(cell.strip() for cell in row):
                continue
            sample = row[0].strip()
            for name, index in where.items():
                raw = row[index].strip() if index < len(row) else ""
                try:
                    number = float(raw)
                except ValueError:
                    number = float("nan")
                ok = math.isfinite(number) and (
                    AGE_RANGE[0] <= number <= AGE_RANGE[1] if name == AGE else number in (0.0, 1.0)
                )
                if ok:
                    found.setdefault(name, {})[sample] = number
                else:
                    bad[name].append(f"{sample}「{raw}」")
    for name, rows in bad.items():
        if not rows:
            continue
        shown = "、".join(rows[:5]) + ("等" if len(rows) > 5 else "")
        rule = "要填 0 到 120 之间的实足年龄（岁）" if name == AGE else "只能填 0（男）或 1（女）"
        problems.append(skillkit.Problem(
            name, LABEL_ZH[name], "parse",
            f"矩阵的 {name} 列{rule}，这些样本不符合：{shown}。空格会被 pyaging 补成别的数，文字读不进模型，所以不计算。",
        ))
    return found, problems


def conflict_problems(flags: Dict[str, float], columns: Dict[str, Dict[str, float]]) -> List[skillkit.Problem]:
    """A covariate given both on the command line and as a matrix column must agree for every sample."""
    problems = []
    for name, value in flags.items():
        differ = [sample for sample, number in columns.get(name, {}).items() if not math.isclose(number, value, abs_tol=1e-6)]
        if differ:
            shown = "、".join(differ[:5]) + ("等" if len(differ) > 5 else "")
            problems.append(skillkit.Problem(
                name, LABEL_ZH[name], "conflict",
                f"命令行 {FLAG[name]} 和矩阵的 {name} 列不一致（样本 {shown}）。"
                f"只保留一处：删掉矩阵的 {name} 列，或者去掉 {FLAG[name]}，或者把两处改成一样。",
            ))
    return problems


def required_problems(clocks: List[str], supplied: set) -> List[skillkit.Problem]:
    """Clocks that take age or sex as a model input refuse to run without it."""
    problems = []
    for name in COVARIATES:
        needing = [clock for clock in clocks if name in CLOCK_COVARIATES.get(clock, ())]
        if needing and name not in supplied:
            problems.append(skillkit.Problem(
                name, LABEL_ZH[name], "missing",
                f"{'、'.join(needing)} 把{LABEL_ZH[name]}（{name}）当作模型输入。"
                f"不提供时 pyaging 会用参考值代替（GrimAge 按 65 岁女性），算出的数不是你的。"
                f"请加 {FLAG[name]}"
                + ("（男或女）" if name == FEMALE else "")
                + f"，或在矩阵里加 {name} 列" + ("（1 女，0 男）" if name == FEMALE else "") + "。",
            ))
    return problems


def filled_problems(filled: Dict[str, List[str]]) -> List[skillkit.Problem]:
    problems = []
    for clock, names in filled.items():
        labels = "、".join(f"{LABEL_ZH.get(name, name)}（{name}）" for name in names)
        problems.append(skillkit.Problem(
            clock, clock, "missing",
            f"{clock} 把{labels}当作模型输入，这次 pyaging 用参考值代替了，读数不是你的，没有写进报告。"
            f"请加 {'、'.join(FLAG.get(name, name) for name in names)}，或在矩阵里加这些列后重跑。",
        ))
    return problems


def prepare_frame(frame, metadata: List[str], covariates: Dict[str, float]):
    """Write covariates as feature columns and keep them out of the metadata moved to adata.obs.

    ``frame`` is the pandas DataFrame read from the matrix. A covariate given
    on the command line is written to every row; one already in the matrix
    stays as it is (the caller has checked the two agree).
    """
    for name, value in covariates.items():
        frame[name] = float(value)
    columns = list(frame.columns)
    kept = [col for col in metadata if col in columns and col not in COVARIATES]
    return frame, kept


def predict(path: Path, clocks: List[str], metadata: List[str], covariates: Dict[str, float]) -> Prediction:
    """Run pyaging on the matrix plus the covariates, and read back values, units and fills."""
    import pandas as pd  # noqa: PLC0415 - optional dependency
    import pyaging as pya  # noqa: PLC0415 - optional dependency

    # Sample names stay text ("01" is not 1), so they match the names the checks read.
    frame = pd.read_csv(path, converters={0: str})
    frame = frame.set_index(frame.columns[0])
    frame, kept = prepare_frame(frame, metadata, covariates)
    captured = io.StringIO()
    with contextlib.redirect_stdout(captured), contextlib.redirect_stderr(captured):
        adata = pya.pp.df_to_adata(frame, metadata_cols=kept)
        pya.pred.predict_age(adata, clocks)
    values: Dict[str, Dict[str, float]] = {}
    for sample, row in adata.obs.iterrows():
        values[str(sample)] = {clock: float(row[clock]) for clock in clocks if clock in row and _finite(row[clock])}
    units: Dict[str, object] = {}
    filled: Dict[str, List[str]] = {}
    for clock in clocks:
        meta = adata.uns.get(f"{clock}_metadata") or {}
        units[clock] = unit_text(meta.get("unit") if hasattr(meta, "get") else None)
        missing = adata.uns.get(f"{clock}_missing_features")
        missing = [] if missing is None else [str(name) for name in missing]
        hit = [name for name in COVARIATES if name in missing]
        if hit:
            filled[clock] = hit
    warnings = [line.strip() for line in captured.getvalue().splitlines() if _is_warning(line)]
    return Prediction(values, warnings, units, filled)


def unit_text(raw) -> str:
    """pyaging stores a clock's unit as a list such as ["years"]; older weights may have none."""
    if raw is None:
        return ""
    if isinstance(raw, (list, tuple)):
        return ", ".join(str(item) for item in raw if item is not None).strip()
    return str(raw).strip()


def _finite(value) -> bool:
    try:
        return math.isfinite(float(value))
    except (TypeError, ValueError):
        return False


def _is_warning(line: str) -> bool:
    lower = line.lower()
    return any(word in lower for word in ("missing", "imput", "warning", "not found", "absent"))


def value_line(clock: str, value: float, unit: str, age: Optional[float]) -> str:
    folded = unit.lower()
    if folded in YEAR_UNITS:
        gap = f"，减实足年龄 {value - age:+.1f} 岁" if age is not None else ""
        return f"- {clock}：{value:.1f} 岁{gap}"
    if clock in SPEED_CLOCKS or folded == PACE_UNIT:
        return f"- {clock}：{value:.3f}（每过一年的衰老速度，不是年龄）"
    if not unit:
        return f"- {clock}：{value:.4g}（pyaging 没有记录单位，不当作年龄，不和实足年龄相减）"
    return f"- {clock}：{value:.4g} {UNIT_ZH.get(folded, unit)}（不是年龄，不和实足年龄相减）"


def covariate_lines(flags: Dict[str, float], columns: Dict[str, Dict[str, float]]) -> List[str]:
    lines = []
    if AGE in flags:
        lines.append(f"- 实足年龄 {flags[AGE]:g} 岁（{FLAG[AGE]}）")
    elif AGE in columns:
        lines.append("- 实足年龄：矩阵的 age 列")
    if FEMALE in flags:
        lines.append(f"- 性别 {'女' if flags[FEMALE] == 1.0 else '男'}（{FLAG[FEMALE]}，female={flags[FEMALE]:g}）")
    elif FEMALE in columns:
        lines.append("- 性别：矩阵的 female 列（1 女，0 男）")
    if lines:
        lines.insert(0, "年龄和性别作为特征列交给 pyaging（GrimAge 等时钟把它们当作模型输入）：")
        lines.append("")
    return lines


def render(prediction: Prediction, clocks: List[str], ages: Dict[str, Optional[float]], intro: Optional[List[str]] = None) -> str:
    lines = [f"# {TITLE}", "", *card_lines(), "", "## 时钟读数", ""]
    lines += intro or []
    for sample, by_clock in prediction.values.items():
        lines.append(f"### 样本 {sample}")
        for clock in clocks:
            if clock not in by_clock:
                lines.append(f"- {clock}：没有读数。")
                continue
            lines.append(value_line(clock, by_clock[clock], unit_text(prediction.units.get(clock)), ages.get(sample)))
        lines.append("")
    lines += ["## pyaging 的提示", ""]
    lines += [f"- {line}" for line in prediction.warnings] if prediction.warnings else ["pyaging 没有打印缺失或补值提示。"]
    lines += ["", f"边界: {BOUNDARY}"]
    return "\n".join(lines) + "\n"


def outputs_for(values: Dict[str, Dict[str, float]]) -> Dict[str, Optional[float]]:
    declared = [item["key"] for item in manifest().get("outputs", [])]
    first = next(iter(values.values()), {})
    return {key: first.get(OUTPUT_CLOCKS[key]) for key in declared}


def refuse(out_dir: Path, problems: List[skillkit.Problem]) -> int:
    path = skillkit.write_problems(out_dir, problems, TITLE, BOUNDARY)
    skillkit.write_result(out_dir, manifest(), outputs_for({}))
    sys.stdout.write(str(path) + "\n")
    return skillkit.EXIT_INPUT_PROBLEM


def run(matrix: Optional[Path], clocks: List[str], metadata: List[str], data_type: str, age: Optional[float],
        out_dir: Path, sex: Optional[str] = None) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    problems = check_matrix(matrix, metadata, data_type)
    age_problems = [item for item in skillkit.check_scalar(manifest(), "age", age) if item.kind != "missing"]
    problems += age_problems
    flags: Dict[str, float] = {}
    if age is not None and not age_problems:
        flags[AGE] = float(age)
    if sex is not None and sex.strip():
        female = parse_sex(sex)
        if female is None:
            problems.append(skillkit.Problem("sex", "性别", "parse", f"--sex 只接受 男 或 女（male/female、m/f），收到「{sex}」。"))
        else:
            flags[FEMALE] = female
    columns: Dict[str, Dict[str, float]] = {}
    # A flag or column that was given but failed its own check already has a problem; do not also call it missing.
    given = {AGE} if age is not None else set()
    given |= {FEMALE} if sex is not None and sex.strip() else set()
    readable = matrix is not None and matrix.exists() and not any(item.kind in {"missing", "parse"} for item in problems if item.key == "matrix")
    if readable:
        columns, column_problems = covariate_columns(matrix)
        problems += column_problems
        problems += conflict_problems(flags, columns)
        given |= set(columns) | {item.key for item in column_problems}
    problems += required_problems(clocks, given)
    if problems:
        return refuse(out_dir, problems)
    try:
        prediction = predict(matrix, clocks, metadata, flags)
    except ImportError as error:
        problem = skillkit.Problem("runtime", "pyaging", "runtime", f"这台机器上的 Python 没有安装 pyaging 或 pandas（{error}）。请用装了 pyaging 的解释器运行，不要改用别的年龄估计。")
        skillkit.write_problems(out_dir, [problem], TITLE, BOUNDARY)
        skillkit.write_result(out_dir, manifest(), outputs_for({}))
        return EXIT_MISSING_RUNTIME
    if prediction.filled:
        return refuse(out_dir, filled_problems(prediction.filled))
    by_column = columns.get(AGE, {})
    ages = {sample: by_column.get(sample, flags.get(AGE)) for sample in prediction.values}
    report = out_dir / "report.md"
    report.write_text(render(prediction, clocks, ages, covariate_lines(flags, columns)), encoding="utf-8")
    skillkit.write_result(out_dir, manifest(), outputs_for(prediction.values))
    sys.stdout.write(str(report) + "\n")
    return 0


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Run pyaging clocks on one feature matrix")
    parser.add_argument("--matrix", type=Path)
    parser.add_argument("--clocks", default=",".join(DEFAULT_CLOCKS), help="comma-separated pyaging clock names")
    parser.add_argument("--metadata-cols", default="", help="comma-separated covariate columns that are not features (age and female always stay features)")
    parser.add_argument("--data-type", choices=["methylation", "other"], default="methylation")
    parser.add_argument("--age", type=float, help="chronological age in years; written to every sample as the age feature")
    parser.add_argument("--sex", help="male/female (m/f, 男/女); written to every sample as female = 0/1")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    clocks = [item.strip().lower() for item in args.clocks.split(",") if item.strip()]
    metadata = [item.strip() for item in args.metadata_cols.split(",") if item.strip()]
    return run(args.matrix, clocks, metadata, args.data_type, args.age, args.out, args.sex)


if __name__ == "__main__":
    raise SystemExit(main())
