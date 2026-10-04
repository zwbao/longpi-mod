"""Read a checkup export and mark values outside common adult reference bounds.

Bounds are the usual ranges printed on Chinese adult panels. A file that
includes ref_low and ref_high overrides them. Abnormal rows stay in the
report as context; they do not add or remove compounds.
"""

from __future__ import annotations

import csv
import re
from pathlib import Path

# item key -> (label, low, high, units we accept)
PANELS = {
    "alt": ("谷丙转氨酶", None, 40, {"u/l", "iu/l"}),
    "ast": ("谷草转氨酶", None, 40, {"u/l", "iu/l"}),
    "creatinine": ("肌酐", None, 115, {"umol/l", "μmol/l"}),
    "egfr": ("肾小球滤过率", 60, None, {"ml/min/1.73m2", "ml/min"}),
    "hemoglobin": ("血红蛋白", 110, None, {"g/l"}),
    "platelets": ("血小板", 100, None, {"10^9/l", "x10^9/l"}),
}

ALIASES = {
    "alt": "alt",
    "谷丙": "alt",
    "谷丙转氨酶": "alt",
    "丙氨酸氨基转移酶": "alt",
    "ast": "ast",
    "谷草": "ast",
    "谷草转氨酶": "ast",
    "天冬氨酸氨基转移酶": "ast",
    "肌酐": "creatinine",
    "creatinine": "creatinine",
    "cr": "creatinine",
    "egfr": "egfr",
    "肾小球滤过率": "egfr",
    "血红蛋白": "hemoglobin",
    "hgb": "hemoglobin",
    "hb": "hemoglobin",
    "血小板": "platelets",
    "plt": "platelets",
}


def _panel_key(name: str) -> str | None:
    text = re.sub(r"[\s（）()]", "", name).casefold()
    for alias, key in ALIASES.items():
        if alias.casefold() in text:
            return key
    return None


def _number(text: str) -> float | None:
    match = re.search(r"[-+]?\d+(?:\.\d+)?", text.replace(",", ""))
    if not match:
        return None
    return float(match.group(0))


def parse_labs(path: Path) -> list[dict]:
    suffix = path.suffix.lower()
    if suffix in {".csv", ".tsv", ".txt"} and _looks_like_table(path):
        return _parse_table(path)
    return _parse_text(path.read_text(encoding="utf-8", errors="replace"))


def _looks_like_table(path: Path) -> bool:
    sample = path.read_text(encoding="utf-8", errors="replace")[:500]
    return "," in sample or "\t" in sample


def _parse_table(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8", errors="replace")
    dialect = csv.excel_tab if "\t" in text.splitlines()[0] else csv.excel
    rows = list(csv.DictReader(text.splitlines(), dialect=dialect))
    if not rows:
        return _parse_text(text)
    fields = {name.strip().lower(): name for name in rows[0] if name}
    item_key = fields.get("item") or fields.get("name") or fields.get("项目") or fields.get("名称")
    value_key = fields.get("value") or fields.get("结果") or fields.get("值")
    if item_key is None or value_key is None:
        return _parse_text(text)
    unit_key = fields.get("unit") or fields.get("单位")
    low_key = fields.get("ref_low") or fields.get("下限")
    high_key = fields.get("ref_high") or fields.get("上限")
    parsed = []
    for row in rows:
        item = (row.get(item_key) or "").strip()
        if not item:
            continue
        parsed.extend(
            _interpret(
                item,
                row.get(value_key) or "",
                (row.get(unit_key) or "") if unit_key else "",
                _optional_float(row.get(low_key)) if low_key else None,
                _optional_float(row.get(high_key)) if high_key else None,
            )
        )
    return parsed


def _parse_text(text: str) -> list[dict]:
    parsed = []
    for line in text.splitlines():
        if not line.strip():
            continue
        value = _number(line)
        if value is None:
            continue
        parsed.extend(_interpret(line, str(value), line, None, None))
    return parsed


def _optional_float(value: str | None) -> float | None:
    if value is None or str(value).strip() == "":
        return None
    return _number(str(value))


def _interpret(item: str, value_text: str, unit_text: str, ref_low: float | None, ref_high: float | None) -> list[dict]:
    key = _panel_key(item)
    value = _number(value_text)
    if key is None or value is None:
        return []
    label, default_low, default_high, _units = PANELS[key]
    low = default_low if ref_low is None else ref_low
    high = default_high if ref_high is None else ref_high
    flag = "normal"
    if low is not None and value < low:
        flag = "low"
    elif high is not None and value > high:
        flag = "high"
    return [
        {
            "key": key,
            "label": label,
            "value": value,
            "low": low,
            "high": high,
            "flag": flag,
            "unit": unit_text.strip(),
        }
    ]


def lab_lines(rows: list[dict]) -> list[str]:
    if not rows:
        return ["没有从体检文件里读到可识别的项目。"]
    lines = []
    for row in rows:
        bound = ""
        if row["flag"] == "high" and row["high"] is not None:
            bound = f"，高于参考上限 {row['high']:g}"
        elif row["flag"] == "low" and row["low"] is not None:
            bound = f"，低于参考下限 {row['low']:g}"
        else:
            bound = "，在参考范围内"
        lines.append(f"- {row['label']} {row['value']:g}{bound}")
    if any(row["flag"] != "normal" for row in rows):
        lines.append("有项目超出参考范围。这只说明名单不能单独执行，不会据此删掉或推荐化合物。")
    return lines
