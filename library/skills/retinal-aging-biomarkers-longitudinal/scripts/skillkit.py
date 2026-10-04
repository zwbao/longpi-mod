"""Manifest-driven input checks for longevity-skills scripts.

The canonical copy is tools/skillkit/skillkit.py. A skill whose skill.json
declares inputs vendors it as scripts/skillkit.py, so the directory still runs
on its own. CI fails when a vendored copy drifts from the canonical one.
Standard library only; Python 3.9 or newer.

Rules the kit enforces for measurement inputs (``"from": "measurements"``):

- A row named by the input's key (``crp_mg_dl``) is read in the key's unit.
  The key carries the unit.
- A row named by a label or an alias (``C反应蛋白``, ``crp``) without a unit is
  read in the input's unit, and the range check catches most wrong units
  (albumin 4.5 read as g/L). When a common wrong unit still lands inside the
  range (CRP mg/L read as mg/dL), skill.json sets ``unit_required`` and such a
  row must state its unit.
- A unit is converted only with a factor skill.json declares under ``accept``.
  An unknown unit is a problem, not a guess.
- A value outside ``range`` after conversion is a problem. Nothing is computed
  from a problem; the report says which row, what unit was read, and why.
"""

from __future__ import annotations

import csv
import io
import json
import math
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

KIT_VERSION = "1"
EXIT_INPUT_PROBLEM = 3

NAME_COLUMNS = ("marker", "item", "name", "indicator", "项目", "指标", "检验项目", "名称")
VALUE_COLUMNS = ("value", "result", "结果", "值", "检验结果", "数值")
UNIT_COLUMNS = ("unit", "units", "单位")

_SUPERSCRIPTS = {
    "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
    "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-",
}

_UNIT_ALIASES = {
    "岁": "a", "年": "a", "years": "a", "year": "a", "yr": "a", "yrs": "a", "y": "a",
    "小时": "h", "hours": "h", "hour": "h", "hr": "h", "hrs": "h",
    "分钟": "min", "minutes": "min", "minute": "min", "mins": "min",
    "天": "d", "days": "d", "day": "d",
    "毫米汞柱": "mmhg",
    "kg/m2": "kg/m^2",
    "公斤": "kg", "千克": "kg", "克": "g",
    "厘米": "cm", "米": "m", "毫米": "mm",
    "k/ul": "10^3/ul", "10^3/mm^3": "10^3/ul", "10^3/mm3": "10^3/ul", "thou/ul": "10^3/ul",
    "克/升": "g/l", "克/分升": "g/dl", "毫克/分升": "mg/dl", "毫克/升": "mg/l",
    "毫摩尔/升": "mmol/l", "微摩尔/升": "umol/l", "纳摩尔/升": "nmol/l",
    "飞升": "fl", "皮克": "pg",
    "单位/升": "u/l",
    "次/分": "/min", "次/分钟": "/min", "bpm": "/min",
    "ratio": "1", "fraction": "1",
}


def normalize_unit(text: Optional[str]) -> str:
    """Return the comparison form of a unit string (see schema/unit_cases.json)."""
    if text is None:
        return ""
    s = str(text)
    s = re.sub(
        "[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+",
        lambda m: "^" + "".join(_SUPERSCRIPTS[c] for c in m.group(0)),
        s,
    )
    s = unicodedata.normalize("NFKC", s)
    s = s.replace("µ", "u").replace("μ", "u")
    s = s.lower()
    s = re.sub(r"\s+", "", s)
    s = re.sub(r"^[×x*](?=10)", "", s)
    s = re.sub(r"10\*(\d+)", r"10^\1", s)
    s = s.replace("^^", "^")
    if s.startswith("iu/"):
        s = s[1:]
    return _UNIT_ALIASES.get(s, s)


def fold_name(text: str) -> str:
    """Case-, width-, and punctuation-insensitive form of a measurement name."""
    s = unicodedata.normalize("NFKC", str(text)).casefold()
    return re.sub(r"[\s_\-·•:：,，/\\]+", "", s)


def name_variants(text: str) -> List[str]:
    """Folded forms of a raw row name, with and without a parenthetical.

    ``白蛋白(ALB)`` yields ``白蛋白(alb)``, ``白蛋白`` and ``alb``.
    """
    raw = unicodedata.normalize("NFKC", str(text)).strip()
    found: List[str] = []

    def add(value: str) -> None:
        folded = fold_name(value)
        if folded and folded not in found:
            found.append(folded)

    add(raw)
    outside = re.sub(r"[(\[（【][^)\]）】]*[)\]）】]", " ", raw)
    add(outside)
    for inner in re.findall(r"[(\[（【]([^)\]）】]*)[)\]）】]", raw):
        add(inner)
    return found


@dataclass
class Problem:
    key: str
    label: str
    kind: str
    message_zh: str

    def as_dict(self) -> Dict[str, str]:
        return {"key": self.key, "label": self.label, "kind": self.kind, "message_zh": self.message_zh}


@dataclass
class Collected:
    values: Dict[str, float] = field(default_factory=dict)
    sources: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    problems: List[Problem] = field(default_factory=list)
    unmatched: List[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.problems


def skill_dir(script_file: str) -> Path:
    return Path(script_file).resolve().parent.parent


def load_manifest(script_file: str) -> Dict[str, Any]:
    path = skill_dir(script_file) / "skill.json"
    return json.loads(path.read_text(encoding="utf-8"))


def input_specs(manifest: Dict[str, Any], source: str = "measurements") -> List[Dict[str, Any]]:
    return [spec for spec in manifest.get("inputs", []) if spec.get("from", "measurements") == source]


def spec_by_key(manifest: Dict[str, Any], key: str) -> Dict[str, Any]:
    for spec in manifest.get("inputs", []):
        if spec.get("key") == key:
            return spec
    raise KeyError(key)


def alias_index(specs: Sequence[Dict[str, Any]]) -> Dict[str, Tuple[Dict[str, Any], bool]]:
    """Map folded names to (spec, named_by_key).

    ``named_by_key`` is True only for the input's own key, which carries the
    unit. Labels and aliases do not.
    """
    index: Dict[str, Tuple[Dict[str, Any], bool]] = {}
    for spec in specs:
        index[fold_name(spec["key"])] = (spec, True)
    for spec in specs:
        for name in [spec.get("label_zh", ""), *spec.get("aliases", [])]:
            folded = fold_name(name)
            if folded and folded not in index:
                index[folded] = (spec, False)
    return index


def unit_factor(spec: Dict[str, Any], unit_text: str) -> Optional[float]:
    """Factor that converts a value in ``unit_text`` to the spec's unit, or None."""
    canonical = normalize_unit(spec.get("unit", ""))
    unit = normalize_unit(unit_text)
    if unit == canonical:
        return 1.0
    for name, factor in (spec.get("accept") or {}).items():
        if normalize_unit(name) == unit:
            return float(factor)
    return None


def _needs_unit(spec: Dict[str, Any]) -> bool:
    return bool(spec.get("unit_required"))


def _fmt(value: float) -> str:
    return f"{value:g}"


def _unit_label(spec: Dict[str, Any]) -> str:
    unit = spec.get("unit", "")
    return "" if unit in ("", "1") else unit


def _with_unit(text: str, unit: str) -> str:
    return f"{text} {unit}" if unit else text


def parse_number(raw: str) -> float:
    text = unicodedata.normalize("NFKC", str(raw)).strip()
    if re.fullmatch(r"[-+]?\d{1,3}(,\d{3})+(\.\d+)?", text):
        text = text.replace(",", "")
    if re.match(r"^[<>≤≥]", text):
        raise ValueError("comparison")
    value = float(text)
    if not math.isfinite(value):
        raise ValueError("not finite")
    return value


def range_problem(
    spec: Dict[str, Any],
    value: float,
    shown: str,
    raw: Optional[float] = None,
) -> Optional[Problem]:
    """Problem for a converted value outside range, or None.

    ``raw`` is the number as typed when it was read in the input's own unit;
    it is used to suggest which declared unit would put it in range.
    """
    bounds = spec.get("range")
    if not bounds:
        return None
    low, high = float(bounds[0]), float(bounds[1])
    if low <= value <= high:
        return None
    label = spec.get("label_zh", spec["key"])
    unit = _unit_label(spec)
    message = f"{label} 读成 {_with_unit(_fmt(value), unit)}（{shown}），不在合理范围 {_with_unit(f'{_fmt(low)}–{_fmt(high)}', unit)} 内。"
    if raw is not None:
        hints = []
        for name, factor in (spec.get("accept") or {}).items():
            if normalize_unit(name) == normalize_unit(spec.get("unit", "")):
                continue
            if low <= raw * float(factor) <= high:
                hints.append(name)
        if hints:
            message += f"如果化验单上的单位是 {'、'.join(hints)}，请在单位列写明。"
    if spec.get("note_zh"):
        message += spec["note_zh"]
    return Problem(spec["key"], label, "range", message)


def check_scalar(manifest: Dict[str, Any], key: str, value: Optional[float]) -> List[Problem]:
    """Range check for an input passed as a command-line argument."""
    spec = spec_by_key(manifest, key)
    label = spec.get("label_zh", key)
    if value is None:
        if spec.get("required"):
            return [Problem(key, label, "missing", f"缺少{label}。")]
        return []
    problem = range_problem(spec, float(value), "命令行参数", raw=float(value))
    return [problem] if problem else []


def read_rows(path: Path) -> List[Dict[str, str]]:
    text = Path(path).read_text(encoding="utf-8-sig", errors="replace")
    sample = text[:2048]
    delimiter = "\t" if sample.count("\t") > sample.count(",") else ","
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    rows = []
    for row in reader:
        rows.append({(key or "").strip(): (value or "").strip() for key, value in row.items() if key})
    return rows


def _column(fields: Iterable[str], names: Sequence[str]) -> Optional[str]:
    lookup = {fold_name(name): name for name in fields}
    for name in names:
        found = lookup.get(fold_name(name))
        if found is not None:
            return found
    return None


def collect_measurements(rows: Sequence[Dict[str, str]], manifest: Dict[str, Any]) -> Collected:
    """Match rows to measurement inputs, convert units, and check ranges."""
    specs = input_specs(manifest, "measurements")
    index = alias_index(specs)
    out = Collected()
    if not rows:
        for spec in specs:
            if spec.get("required"):
                label = spec.get("label_zh", spec["key"])
                out.problems.append(Problem(spec["key"], label, "missing", f"缺少{label}。"))
        return out
    fields = list(rows[0].keys())
    name_col = _column(fields, NAME_COLUMNS)
    value_col = _column(fields, VALUE_COLUMNS)
    unit_col = _column(fields, UNIT_COLUMNS)
    if name_col is None or value_col is None:
        out.problems.append(Problem("", "", "header", "测量表需要名称列和数值列，例如 marker,value,unit。"))
        return out
    for row in rows:
        raw_name = row.get(name_col, "")
        if not raw_name:
            continue
        hit = None
        for variant in name_variants(raw_name):
            if variant in index:
                hit = index[variant]
                break
        if hit is None:
            out.unmatched.append(raw_name)
            continue
        spec, by_key = hit
        key = spec["key"]
        label = spec.get("label_zh", key)
        raw_value = row.get(value_col, "")
        unit_text = row.get(unit_col, "") if unit_col else ""
        if raw_value == "":
            continue
        try:
            number = parse_number(raw_value)
        except ValueError:
            out.problems.append(Problem(key, label, "parse", f"{raw_name} 的结果「{raw_value}」不是一个可以计算的数。"))
            continue
        if not normalize_unit(unit_text):
            if not by_key and _needs_unit(spec):
                accepted = [spec.get("unit", "")] + [
                    name for name in (spec.get("accept") or {})
                    if normalize_unit(name) != normalize_unit(spec.get("unit", ""))
                ]
                out.problems.append(Problem(
                    key, label, "unit_missing",
                    f"{raw_name} 没有写单位。这一项常见 {'、'.join(accepted)}，换算差别很大，请在单位列写明。",
                ))
                continue
            factor = 1.0
            shown = f"按 {_unit_label(spec)} 读" if _unit_label(spec) else "没有单位"
        else:
            factor = unit_factor(spec, unit_text)
            if factor is None:
                accepted = [spec.get("unit", "")] + list((spec.get("accept") or {}).keys())
                message = f"{raw_name} 的单位 {unit_text} 不能换算成 {_unit_label(spec) or '无单位的数'}。可以接受的单位：{'、'.join(item for item in dict.fromkeys(accepted) if item) or '无单位'}。"
                if spec.get("note_zh"):
                    message += spec["note_zh"]
                out.problems.append(Problem(key, label, "unit", message))
                continue
            shown = f"原值 {_fmt(number)} {unit_text}" if factor != 1.0 else f"单位 {unit_text}"
        value = number * factor
        if key in out.values and not math.isclose(out.values[key], value, rel_tol=1e-9, abs_tol=1e-12):
            out.problems.append(Problem(key, label, "duplicate", f"{label} 出现了两次，数值不同（{_fmt(out.values[key])} 和 {_fmt(value)}）。请只保留一次。"))
            continue
        problem = range_problem(spec, value, shown, raw=number if factor == 1.0 else None)
        if problem:
            out.problems.append(problem)
            continue
        out.values[key] = value
        out.sources[key] = {"name": raw_name, "value": raw_value, "unit": unit_text, "factor": factor}
    for spec in specs:
        if spec.get("required") and spec["key"] not in out.values:
            if any(problem.key == spec["key"] for problem in out.problems):
                continue
            label = spec.get("label_zh", spec["key"])
            out.problems.append(Problem(spec["key"], label, "missing", f"缺少{label}。"))
    return out


def collect_file(path: Optional[Path], manifest: Dict[str, Any]) -> Collected:
    rows = read_rows(path) if path is not None else []
    return collect_measurements(rows, manifest)


def problems_markdown(problems: Sequence[Problem], title: str, boundary: str) -> str:
    lines = [f"# {title}", "", "## 输入没有通过检查", "", "这次没有计算。原因如下："]
    for problem in problems:
        lines.append(f"- {problem.message_zh}")
    lines += ["", "改正后重新运行。缺的项不要用别的数代替。", "", f"边界: {boundary}"]
    return "\n".join(lines) + "\n"


def write_problems(out_dir: Path, problems: Sequence[Problem], title: str, boundary: str) -> Path:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    report = out_dir / "report.md"
    report.write_text(problems_markdown(problems, title, boundary), encoding="utf-8")
    (out_dir / "problems.json").write_text(
        json.dumps({"schema": "longevity-problems/1", "problems": [p.as_dict() for p in problems]}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return report


def write_result(out_dir: Path, manifest: Dict[str, Any], outputs: Dict[str, Any]) -> Path:
    """Write out/result.json with the declared outputs this run computed.

    Undeclared keys raise, so a script cannot publish a value its manifest
    does not describe. None means not computed and is written as null. A
    number is written as a float; a category (a bin, a quartile label) as a
    string.
    """
    declared = {spec["key"]: spec for spec in manifest.get("outputs", [])}
    unknown = sorted(set(outputs) - set(declared))
    if unknown:
        raise KeyError(f"outputs not declared in skill.json: {', '.join(unknown)}")

    def plain(value: Any) -> Any:
        if value is None or isinstance(value, str):
            return value
        return float(value)

    payload = {
        "schema": "longevity-result/1",
        "skill": manifest.get("name", ""),
        "outputs": {
            key: {
                "value": plain(value),
                "unit": declared[key].get("unit", ""),
                "label_zh": declared[key].get("label_zh", key),
            }
            for key, value in outputs.items()
        },
    }
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "result.json"
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path
