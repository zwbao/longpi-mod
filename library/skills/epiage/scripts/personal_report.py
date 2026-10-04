#!/usr/bin/env python3
"""Run gangchen/epiage-skill's compute_clocks.py on one blood beta-value file.

scripts/compute_clocks.py and data/ are unmodified copies of
gangchen/epiage-skill @ fcf4e3b (MIT). This wrapper does not change them. It
checks the file, runs compute_clocks.py in a subprocess with this interpreter,
reads the JSON line it prints, and writes out/report.md and out/result.json.

The file, age and sex checks use only the standard library, so refusals work
and can be tested without pandas. Clock names and groups are read from the
vendored compute_clocks.py itself, which needs pandas and numpy.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import importlib.util
import json
import math
import os
import re
import subprocess
import sys
from pathlib import Path
from types import ModuleType
from typing import Any, Dict, List, Optional, Sequence, Tuple

import skillkit

HERE = Path(__file__).resolve().parent
UPSTREAM_SCRIPT = HERE / "compute_clocks.py"
TITLE = "epiage 血液甲基化时钟"
BOUNDARY = (
    "读数是 DNA 甲基化研究模型的估计，不是诊断，也不是开始或停止任何药物、补充剂或干预的理由。"
    "只适用于人全血。补值和低覆盖会改变读数，报告照录 compute_clocks.py 的提示。"
    "暴露组和健康分值不能换算成体检数值或患病概率。"
)
DEFAULT_CLOCKS = ("core",)
MAX_SAMPLES = 20
LOW_COVERAGE = 90.0
TIMEOUT_SECONDS = 3600
EXIT_MISSING_RUNTIME = 4
EXIT_UPSTREAM_FAILED = 5
BETAS_LABEL = "β 值文件"
IDAT_MESSAGE = (
    "IDAT 是芯片原始信号，这里只接受 β 值文件。请先在自己的电脑上按上游 SeSAMe 流程"
    "（SKILL.md 的 IDAT 一节）得到 betas.csv，看过 qc.csv，再把 betas.csv 交给这个脚本。"
)
SEX_CODES = {
    "m": "m", "male": "m", "man": "m", "男": "m", "男性": "m",
    "f": "f", "female": "f", "woman": "f", "女": "f", "女性": "f",
}
NOT_TABLE = {".xlsx", ".xls", ".pdf", ".zip", ".docx"}
UNIT_TEXT = {
    "years": "{v} 岁",
    "years/year": "{v}（年/年，是速度）",
    "kb": "{v} kb",
    "beta": "{v}（β 值）",
    "score": "{v}（分值）",
}
_SENSITIVITY = re.compile(r"^\s*age=\s*([-+0-9.eE]+):\s*GrimAge=\s*([-+0-9.eE]+),\s*accel=([-+0-9.eE]+)")
_UNAVAILABLE = re.compile(r"^WARNING: .*/([A-Za-z0-9_]+) unavailable:")
_MODE = re.compile(r"^Tissue: whole blood \| imputation of missing CpGs: (.+)$")


def manifest() -> dict:
    return skillkit.load_manifest(__file__)


def output_labels() -> Dict[str, str]:
    return {item["key"][len("dnam_"):]: item.get("label_zh", item["key"]) for item in manifest().get("outputs", [])}


def card_lines() -> List[str]:
    tool = manifest().get("tool", {})
    upstream = tool.get("upstream", "")
    lines = ["## 工具卡片", "", "**epiage-skill**（gangchen）", ""]
    lines.append(f"提交 {tool.get('commit', '')}，{tool.get('license', '')} 许可，© 2026 gangchen。系数和参照的出处见 NOTICE-epiage。")
    lines += ["", f"[代码]({upstream}) · [系数审计]({upstream}/blob/{tool.get('commit', '')}/epigenetic-clocks/references/model-audit.md)", ""]
    lines.append(
        "compute_clocks.py 只用 pandas 和 numpy，按 biolearn 和原始论文的系数离线计算 25 个衰老时钟和相关标志、"
        "12 个暴露组和健康分值；缺失的 CpG 用随附的全血 methyLImp 参照补值。它是开源重新实现，"
        "不是 Horvath 官方 DNAm Age 计算器，也不是 Clock Foundation 的认证结果。上游对照原文修正了 DNAmTL 截距符号，"
        "去掉了 McCartney 分值的 sigmoid，并暂停了冠心病和抑郁两个分值。个人报告只照录它对你交来的 β 值文件算出的数。"
    )
    return lines


# ---------------------------------------------------------------- input checks


def _is_idat(path: Path) -> bool:
    name = path.name.lower()
    return name.endswith(".idat") or name.endswith(".idat.gz")


def _open_text(path: Path):
    if path.name.lower().endswith(".gz"):
        return gzip.open(path, "rt", encoding="utf-8-sig", errors="replace", newline="")
    return path.open(encoding="utf-8-sig", errors="replace", newline="")


def _scale_problem(outside: int, total: int, low: float, high: float, first: Tuple[str, str, str]) -> skillkit.Problem:
    if outside / total > 0.01:
        finite = math.isfinite(low)
        if finite and low < 0:
            guess = "有负数，像是 M 值。"
        elif finite and high <= 100:
            guess = "像是百分比。"
        else:
            guess = ""
        spread = f"，最小 {low:g}，最大 {high:g}" if finite else ""
        message = (
            f"文件里有 {outside} 个数不在 0 到 1 之间（共 {total} 个数{spread}）。{guess}"
            "时钟要 0 到 1 的 β 值；百分比请除以 100，M 值请先换成 β 值。这里不会自动换算。"
        )
    else:
        cpg, sample, raw = first
        message = (
            f"有 {outside} 个数不在 0 到 1 之间，第一个是 {cpg} 在样本 {sample} 的 {raw}。"
            "compute_clocks.py 只接受 0 到 1 的 β 值，缺失请写 NA，不要写 0。改正这些行后重新运行。"
        )
    return skillkit.Problem("betas", BETAS_LABEL, "range", message)


def check_betas_file(path: Optional[Path]) -> List[skillkit.Problem]:
    """File-level checks that need no pandas: presence, IDAT, table shape, 0–1 scale."""
    if path is None:
        return [skillkit.Problem("betas", BETAS_LABEL, "missing", "缺少 β 值文件（--betas）。")]
    if path.is_dir():
        return [skillkit.Problem("betas", BETAS_LABEL, "parse", f"{path.name} 是一个文件夹。{IDAT_MESSAGE}")]
    if _is_idat(path):
        return [skillkit.Problem("betas", BETAS_LABEL, "parse", f"{path.name} 是 IDAT 文件。{IDAT_MESSAGE}")]
    if not path.exists():
        return [skillkit.Problem("betas", BETAS_LABEL, "missing", f"找不到 β 值文件 {path.name}。")]
    if path.suffix.lower() in NOT_TABLE:
        return [skillkit.Problem("betas", BETAS_LABEL, "parse", f"{path.name} 不是 CSV 或 TSV。请导出成 CSV/TSV（可以 gzip 压缩）。")]
    shape = skillkit.Problem(
        "betas", BETAS_LABEL, "parse",
        "β 值文件要有表头，第一列是 CpG 编号（cg...），其余每列是一个样本的 β 值，至少一行数据。",
    )
    rows = total = outside = 0
    low, high = math.inf, -math.inf
    first: Tuple[str, str, str] = ("", "", "")
    try:
        with _open_text(path) as handle:
            first_line = handle.readline()
            sep = "\t" if "\t" in first_line else ","
            header = next(csv.reader([first_line], delimiter=sep), [])
            if len(header) < 2:
                return [shape]
            samples = header[1:]
            for row in csv.reader(handle, delimiter=sep):
                if not any(cell.strip() for cell in row):
                    continue
                rows += 1
                for sample, cell in zip(samples, row[1:]):
                    text = cell.strip()
                    try:
                        number = float(text)
                    except ValueError:
                        continue
                    if math.isnan(number):
                        continue
                    total += 1
                    if 0.0 <= number <= 1.0:
                        continue
                    outside += 1
                    if math.isfinite(number):
                        low, high = min(low, number), max(high, number)
                    if not first[0]:
                        first = (row[0].strip(), sample.strip(), text)
    except (OSError, EOFError, csv.Error) as error:
        return [skillkit.Problem("betas", BETAS_LABEL, "parse", f"读不了 {path.name}（{error}）。请交 CSV/TSV 或它的 .gz。")]
    if rows == 0:
        return [shape]
    if outside:
        return [_scale_problem(outside, total, low, high, first)]
    return []


def parse_sex(text: Optional[str]) -> Tuple[Optional[str], List[skillkit.Problem]]:
    if text is None or not str(text).strip():
        return None, []
    code = SEX_CODES.get(str(text).strip().lower())
    if code is None:
        return None, [skillkit.Problem("sex", "性别", "parse", f"性别「{text}」认不出。请写 m、f、male、female、男 或 女。")]
    return code, []


def parse_numbers(tokens: Optional[Sequence[str]]) -> Tuple[List[float], List[skillkit.Problem]]:
    values: List[float] = []
    problems: List[skillkit.Problem] = []
    for token in split_tokens(tokens or []):
        try:
            number = float(token)
        except ValueError:
            number = math.nan
        if not (math.isfinite(number) and 0 <= number <= 120):
            problems.append(skillkit.Problem("sensitivity", "敏感性分析年龄", "range", f"敏感性分析的年龄「{token}」要是 0 到 120 之间的数。"))
            continue
        values.append(number)
    return values, problems


def split_tokens(items: Sequence[str]) -> List[str]:
    return [part for item in items for part in re.split(r"[,\s，、]+", str(item)) if part]


# ------------------------------------------------------ upstream metadata


def load_upstream() -> ModuleType:
    """Import the vendored compute_clocks.py for its model table. Raises ImportError without pandas/numpy."""
    import numpy  # noqa: F401,PLC0415 - optional dependency
    import pandas  # noqa: F401,PLC0415 - optional dependency

    spec = importlib.util.spec_from_file_location("epiage_compute_clocks", UPSTREAM_SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _fold(text: str) -> str:
    """compute_clocks.py's own normalisation of --clocks tokens."""
    return text.lower().replace("-", "").replace("_", "")


def resolve_clocks(tokens: Sequence[str], module: ModuleType) -> Tuple[List[str], List[str]]:
    """Model keys in request order, and tokens that name no model or group."""
    by_fold = {_fold(key): key for key in module.CLOCKS}
    keys: List[str] = []
    unknown: List[str] = []
    for token in tokens:
        lowered = token.strip().lower()
        folded = _fold(lowered)
        if lowered in module.CLOCKS:
            keys.append(lowered)
        elif folded in module.GROUPS:
            keys.extend(module.GROUPS[folded])
        elif folded in by_fold:
            keys.append(by_fold[folded])
        else:
            unknown.append(token)
    return list(dict.fromkeys(keys)), unknown


def upstream_tokens(keys: Sequence[str], module: ModuleType) -> List[str]:
    """--clocks arguments that make compute_clocks.py run every key.

    compute_clocks.py strips "_" from each token before looking it up, so a key
    such as bmi_reed cannot be named directly. Such a key is requested through
    the smallest group that contains it; the extra rows are dropped afterwards.
    """
    tokens: List[str] = []
    for key in keys:
        if _fold(key) == key or _fold(key) in module.CLOCKS:
            tokens.append(key)
            continue
        groups = sorted((name for name, members in module.GROUPS.items() if key in members), key=lambda name: len(module.GROUPS[name]))
        tokens.append(groups[0])
    return list(dict.fromkeys(tokens))


# ------------------------------------------------------------ running


def run_upstream(path: Path, tokens: Sequence[str], age: Optional[float], sex: Optional[str],
                 sensitivity: Sequence[float]) -> subprocess.CompletedProcess:
    command = [sys.executable, str(UPSTREAM_SCRIPT), "--input", str(path), "--clocks", *tokens]
    if age is not None:
        command += ["--age", repr(float(age))]
    if sex is not None:
        command += ["--sex", sex]
    if sensitivity:
        command += ["--sensitivity", *[repr(float(item)) for item in sensitivity]]
    env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
    return subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace",
                          timeout=TIMEOUT_SECONDS, env=env)


def parse_records(stdout: str) -> List[Dict[str, Any]]:
    for line in reversed(stdout.splitlines()):
        if line.startswith("JSON:"):
            return json.loads(line[len("JSON:"):])
    raise ValueError("compute_clocks.py printed no JSON line")


def parse_mode(stdout: str) -> str:
    for line in stdout.splitlines():
        match = _MODE.match(line.strip())
        if match:
            return match.group(1).strip()
    return ""


def parse_sensitivity(stdout: str) -> List[Tuple[float, float, float]]:
    rows = []
    for line in stdout.splitlines():
        match = _SENSITIVITY.match(line)
        if match:
            rows.append(tuple(float(item) for item in match.groups()))
    return rows


def upstream_warnings(stderr: str, keys: Sequence[str]) -> List[str]:
    wanted = set(keys)
    found: List[str] = []
    for line in stderr.splitlines():
        text = line.strip()
        if "warning" not in text.lower():
            continue
        match = _UNAVAILABLE.match(text)
        if match and match.group(1) not in wanted:
            continue
        if text not in found:
            found.append(text)
    return found


# ------------------------------------------------------------ report


def _number(value: Any) -> Optional[float]:
    if isinstance(value, bool) or value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _cell(text: Any) -> str:
    return str(text).replace("|", "/").replace("\n", " ").strip()


def value_text(record: Dict[str, Any], blocked: Sequence[str] = ()) -> str:
    value = _number(record.get("value"))
    if record.get("status") != "ok" or value is None:
        reason = _cell(record.get("status_reason") or "没有给出数")
        unresolved = _number(record.get("n_unresolved")) or 0
        if record.get("clock") in blocked:
            return f"不可用（上游暂停这个模型：{reason}）"
        if unresolved:
            return f"不可用（{int(unresolved)} 个 CpG 文件里没有、补值参照里也没有；上游：{reason}）"
        return f"不可用（上游：{reason}）"
    unit = str(record.get("unit", ""))
    template = UNIT_TEXT.get(unit, "{v} " + unit)
    return template.format(v=f"{value:.2f}").strip()


def accel_text(record: Dict[str, Any], age: Optional[float]) -> str:
    accel = _number(record.get("accel"))
    if age is None or record.get("unit") != "years" or record.get("status") != "ok" or accel is None:
        return "—"
    return f"{accel:+.2f} 岁"


def coverage_pct(record: Dict[str, Any]) -> Optional[float]:
    features = _number(record.get("n_feat"))
    missing = _number(record.get("n_missing"))
    if not features or missing is None:
        return None
    return (features - missing) / features * 100


def coverage_text(record: Dict[str, Any]) -> str:
    pct = coverage_pct(record)
    text = f"{record.get('coverage', '')}（缺 {record.get('n_missing', '')}/{record.get('n_feat', '')}）"
    if pct is not None and pct < LOW_COVERAGE:
        text += " 偏低"
    return text


def _count(value: Any) -> str:
    number = _number(value)
    return "—" if number is None else str(int(number))


def table(records: Sequence[Dict[str, Any]], labels: Dict[str, str], age: Optional[float],
          blocked: Sequence[str] = ()) -> List[str]:
    lines = ["| 模型 | 读数 | 读数减实足年龄 | CpG 覆盖 | 补值 CpG | 其中低置信 |", "| --- | --- | --- | --- | --- | --- |"]
    for record in records:
        key = record["clock"]
        name = f"{_cell(labels.get(key, key))}（`{key}`）"
        lines.append(
            f"| {name} | {value_text(record, blocked)} | {accel_text(record, age)} | {coverage_text(record)} | "
            f"{_count(record.get('n_imputed'))} | {_count(record.get('n_lowconf'))} |"
        )
    return lines


def notes(records: Sequence[Dict[str, Any]], keys: Sequence[str], module_groups: Dict[str, List[str]],
          samples: Sequence[str], age: Optional[float]) -> List[str]:
    ran = set(keys)
    units = {record.get("unit") for record in records}
    lines = [
        "- compute_clocks.py 是开源重新实现，读数和 Horvath 官方计算器接近但不是认证值。",
    ]
    if age is not None and "years" in units:
        lines.append("- 「读数减实足年龄」只是两个数相减，不是在同龄人群里回归出来的 AgeAccel；正数只说明模型读数高于实足年龄，不说明比同龄人老多少。")
    if age is None and "years" in units:
        lines.append("- 没有给实足年龄，所以没有算「读数减实足年龄」。")
    if ran & {"grimagev1", "grimagev2", "phenoage", "hrsinchphenoage"}:
        lines.append("- GrimAge 和 PhenoAge 是按死亡和健康结局训练的第二代时钟，本来就可能离实足年龄较远；GrimAge 是以年为单位的风险分，不是「看起来几岁」。")
    lines.append(f"- 覆盖率低于 {LOW_COVERAGE:g}% 的模型标了「偏低」：它缺的 CpG 多，靠补值多，这次读数不可靠。补值是估计，不是测量。")
    lines.append("- 「其中低置信」数的是补进去、但在全血参照里标准差大于 0.08 的 CpG；这一列越大，这个读数越不可靠。")
    if "dunedinpace" in ran:
        lines.append("- DunedinPACE 要约 2 万个背景 CpG 做分位数标准化，覆盖率按这些背景 CpG 算；远低于 90% 时读数主要由参照决定。")
    if units & {"years/year"}:
        lines.append("- DunedinPACE 和 DunedinPoAm 是每过一年的生物学衰老速度（年/年），不是年龄。")
    if "dnamtl" in ran:
        lines.append("- DNAmTL 是按甲基化估计的端粒长度替代值，单位 kb，不是实测端粒长度。")
    if ran & {"garagnani", "bocklandt"}:
        lines.append("- Garagnani 和 Bocklandt 只是单个 CpG 的 β 值，不是年龄。")
    if ran & {"zhang", "epitoc1"}:
        lines.append("- Zhang 是 10 个 CpG 的死亡风险加权分，EpiTOC1 是 385 个 CpG 的平均 β 值，都不是年龄或概率。")
    if ran & {"pedbe", "cortical"}:
        lines.append("- PedBE 为儿童口腔拭子训练，Cortical 为脑皮层训练；用在血液上只是照算。")
    phenotypes = set(module_groups.get("phenotypes", []))
    if ran & phenotypes:
        lines.append("- 暴露组和健康分值是原始加权 DNAm 分数，可以是负数，不能换算成 BMI、胆固醇、受教育年限、吸烟包年或患病概率，只能当作相对信号看。")
    if ran & {"cvd", "depression"}:
        lines.append("- 冠心病（cvd）和抑郁（depression）两个分值上游暂停计算：系数或输入尺度没能对上原文，所以恒为不可用。")
    lines.append("- 模型和补值参照都按人全血建立，别的组织不适用。只凭 β 值文件不能判断芯片型号。")
    if len(samples) > 1:
        lines.append(f"- 文件里有 {len(samples)} 个样本列，年龄和性别对每一列都一样套用；不同的人请分开运行。result.json 只写第一个样本（{samples[0]}）。")
    return lines


def render(records: Sequence[Dict[str, Any]], keys: Sequence[str], module: ModuleType, *, samples: Sequence[str],
           n_cpgs: int, age: Optional[float], sex: Optional[str], mode: str, warnings: Sequence[str],
           sensitivity: Sequence[Tuple[float, float, float]], sensitivity_note: str) -> str:
    labels = output_labels()
    phenotypes = set(module.GROUPS.get("phenotypes", []))
    blocked = set(module.MODEL_BLOCKERS)
    lines = [f"# {TITLE}", "", *card_lines(), "", "## 这次算了什么", ""]
    sex_text = {"m": "男", "f": "女"}.get(sex or "", "没有给")
    age_text = f"{age:g} 岁" if age is not None else "没有给"
    lines.append(f"读入 {n_cpgs} 个 CpG × {len(samples)} 个样本。实足年龄：{age_text}；性别：{sex_text}。模型：{'、'.join(keys)}。")
    if mode:
        lines.append(f"缺失 CpG 的补值方式：{mode}。")
    lines += ["", "## 读数", ""]
    for sample in samples:
        rows = [record for record in records if record.get("sample") == sample]
        lines += [f"### 样本 {sample}", ""]
        aging = [record for record in rows if record["clock"] not in phenotypes]
        scores = [record for record in rows if record["clock"] in phenotypes]
        if aging:
            lines += ["衰老时钟和相关标志：", "", *table(aging, labels, age, blocked), ""]
        if scores:
            lines += ["暴露组和健康分值（原始 DNAm 分数，不是体检数值）：", "", *table(scores, labels, age, blocked), ""]
    if sensitivity or sensitivity_note:
        lines += ["## GrimAgeV2 对实足年龄的敏感性", ""]
        if sensitivity:
            lines.append(f"只算第一个样本（{samples[0]}），其他输入不变，只换实足年龄：")
            lines.append("")
            lines += [f"- 实足年龄 {item[0]:g}：GrimAgeV2 {item[1]:.2f} 岁，读数减实足年龄 {item[2]:+.2f} 岁" for item in sensitivity]
        else:
            lines.append(sensitivity_note)
        lines.append("")
    lines += ["## 怎么读", "", *notes(records, keys, module.GROUPS, samples, age), ""]
    lines += ["## compute_clocks.py 的提示", ""]
    lines += [f"- {line}" for line in warnings] if warnings else ["compute_clocks.py 没有打印警告。"]
    lines += ["", f"边界: {BOUNDARY}"]
    return "\n".join(lines) + "\n"


def failure_report(code: Optional[int], stderr: str, detail: str) -> str:
    tail = "\n".join(stderr.strip().splitlines()[-40:]) or "（没有输出）"
    status = f"退出码 {code}" if code is not None else detail
    lines = [
        f"# {TITLE}", "", "## compute_clocks.py 没有算完", "",
        f"{status}。下面是它最后打印的内容：", "", "```text", tail, "```", "",
        "这次没有读数。不要用别的数代替。", "", f"边界: {BOUNDARY}",
    ]
    return "\n".join(lines) + "\n"


# ------------------------------------------------------------ outputs


def outputs_for(records: Sequence[Dict[str, Any]]) -> Dict[str, Optional[float]]:
    declared = [item["key"] for item in manifest().get("outputs", [])]
    first = records[0].get("sample") if records else None
    values = {
        record["clock"]: _number(record.get("value"))
        for record in records
        if record.get("sample") == first and record.get("status") == "ok"
    }
    return {key: values.get(key[len("dnam_"):]) for key in declared}


def _refuse(out_dir: Path, problems: Sequence[skillkit.Problem], code: int = skillkit.EXIT_INPUT_PROBLEM) -> int:
    path = skillkit.write_problems(out_dir, problems, TITLE, BOUNDARY)
    skillkit.write_result(out_dir, manifest(), outputs_for([]))
    sys.stdout.write(str(path) + "\n")
    return code


def _fail(out_dir: Path, code: Optional[int], stderr: str, detail: str = "") -> int:
    report = out_dir / "report.md"
    report.write_text(failure_report(code, stderr, detail), encoding="utf-8")
    skillkit.write_result(out_dir, manifest(), outputs_for([]))
    sys.stdout.write(str(report) + "\n")
    return EXIT_UPSTREAM_FAILED


def run(betas: Optional[Path], clocks: Sequence[str], age: Optional[float], sex_text: Optional[str],
        sensitivity_tokens: Optional[Sequence[str]], out_dir: Path) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    problems = check_betas_file(betas)
    problems += [item for item in skillkit.check_scalar(manifest(), "age", age) if item.kind != "missing"]
    sex, sex_problems = parse_sex(sex_text)
    sensitivity, sensitivity_problems = parse_numbers(sensitivity_tokens)
    problems += sex_problems + sensitivity_problems
    tokens = split_tokens(clocks) or list(DEFAULT_CLOCKS)
    if problems:
        return _refuse(out_dir, problems)

    try:
        module = load_upstream()
    except ImportError as error:
        problem = skillkit.Problem(
            "runtime", "pandas / numpy", "runtime",
            f"这台机器上的 Python（{sys.executable}）没有 pandas 或 numpy（{error}）。"
            "请用装了 scripts/requirements.txt 的解释器运行，不要改用别的年龄估计。",
        )
        return _refuse(out_dir, [problem], EXIT_MISSING_RUNTIME)

    keys, unknown = resolve_clocks(tokens, module)
    if unknown or not keys:
        problems.append(skillkit.Problem(
            "clocks", "模型名", "parse",
            f"不认识的模型或组名：{'、'.join(unknown) or '（空）'}。可用的组：{'、'.join(module.GROUPS)}；"
            f"可用的模型：{'、'.join(module.CLOCKS)}。",
        ))
    grim = [key for key in keys if key in module.NEEDS_AGE_SEX]
    if grim:
        hint = (
            f"GrimAge（{'、'.join(grim)}）的公式直接用实足年龄和性别，两项都要给。"
            "不提供时请从 --clocks 去掉 GrimAge（默认的 core 组含 grimagev1 和 grimagev2），例如 --clocks horvath,hannum,phenoage。"
        )
        if age is None:
            problems.append(skillkit.Problem("age", "实足年龄", "missing", f"缺少实足年龄。{hint}"))
        if sex is None:
            problems.append(skillkit.Problem("sex", "性别", "missing", f"缺少性别。{hint}"))
    if problems:
        return _refuse(out_dir, problems)

    try:
        frame = module.load_betas(betas)
    except (ValueError, OSError, EOFError, UnicodeError) as error:
        return _refuse(out_dir, [skillkit.Problem("betas", BETAS_LABEL, "parse", f"compute_clocks.py 不接受这个文件：{error}")])
    samples = [str(name) for name in frame.columns]
    if len(samples) > MAX_SAMPLES:
        return _refuse(out_dir, [skillkit.Problem(
            "betas", BETAS_LABEL, "parse",
            f"文件有 {len(samples)} 个样本列。个人读出最多 {MAX_SAMPLES} 个，而且年龄和性别会套用到每一列；请只保留你自己的样本。",
        )])

    run_sensitivity = list(sensitivity) if "grimagev2" in keys else []
    sensitivity_note = "" if not sensitivity or run_sensitivity else "给了 --sensitivity，但这次没有选 GrimAgeV2，所以没有做敏感性分析。"
    try:
        result = run_upstream(betas, upstream_tokens(keys, module), age, sex, run_sensitivity)
    except subprocess.TimeoutExpired:
        return _fail(out_dir, None, "", f"超过 {TIMEOUT_SECONDS} 秒没有算完")
    if result.returncode != 0:
        return _fail(out_dir, result.returncode, result.stderr or result.stdout)
    try:
        records = parse_records(result.stdout)
    except ValueError as error:
        return _fail(out_dir, None, result.stderr + "\n" + result.stdout[-2000:], f"读不了它的 JSON 输出（{error}）")

    order = {key: index for index, key in enumerate(keys)}
    sample_order = {name: index for index, name in enumerate(samples)}
    records = sorted(
        (record for record in records if record.get("clock") in order),
        key=lambda record: (sample_order.get(str(record.get("sample")), len(samples)), order[record["clock"]]),
    )
    for record in records:
        record["sample"] = str(record.get("sample"))
    report = out_dir / "report.md"
    report.write_text(render(
        records, keys, module, samples=samples, n_cpgs=int(frame.shape[0]), age=age, sex=sex,
        mode=parse_mode(result.stdout), warnings=upstream_warnings(result.stderr, keys),
        sensitivity=parse_sensitivity(result.stdout) if run_sensitivity else [], sensitivity_note=sensitivity_note,
    ), encoding="utf-8")
    skillkit.write_result(out_dir, manifest(), outputs_for(records))
    sys.stdout.write(str(report) + "\n")
    return 0


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Run epiage-skill clocks on one blood beta-value file")
    parser.add_argument("--betas", type=Path, help="CSV/TSV (optionally .gz): CpG,beta or CpG x sample matrix")
    parser.add_argument("--clocks", nargs="+", default=list(DEFAULT_CLOCKS),
                        help="model keys or groups, comma- or space-separated (default core)")
    parser.add_argument("--age", type=float)
    parser.add_argument("--sex", help="m / f (also male, female, 男, 女)")
    parser.add_argument("--sensitivity", nargs="+", help="other ages for the GrimAgeV2 sensitivity check")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    return run(args.betas, args.clocks, args.age, args.sex, args.sensitivity, args.out)


if __name__ == "__main__":
    raise SystemExit(main())
