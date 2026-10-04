"""Checkup values are context. They never add or remove compounds."""

from __future__ import annotations

import csv
import re
from pathlib import Path

PANELS = {
    "alt": ("谷丙转氨酶", None, 40),
    "ast": ("谷草转氨酶", None, 40),
    "creatinine": ("肌酐", None, 115),
    "egfr": ("肾小球滤过率", 60, None),
    "hemoglobin": ("血红蛋白", 110, None),
    "platelets": ("血小板", 100, None),
}

ALIASES = {
    "谷丙转氨酶": "alt",
    "谷丙": "alt",
    "丙氨酸氨基转移酶": "alt",
    "alt": "alt",
    "谷草转氨酶": "ast",
    "谷草": "ast",
    "天冬氨酸氨基转移酶": "ast",
    "ast": "ast",
    "肌酐": "creatinine",
    "creatinine": "creatinine",
    "肾小球滤过率": "egfr",
    "egfr": "egfr",
    "血红蛋白": "hemoglobin",
    "hgb": "hemoglobin",
    "血小板": "platelets",
    "plt": "platelets",
}


def _number(text: str) -> float | None:
    match = re.search(r"[-+]?\d+(?:\.\d+)?", text.replace(",", ""))
    if not match:
        return None
    return float(match.group(0))


def _panel_key(name: str) -> str | None:
    compact = re.sub(r"[\s（）()]", "", name).casefold()
    for alias, key in ALIASES.items():
        if alias.casefold() in compact:
            return key
    return None


def _interpret(item: str, value_text: str) -> dict | None:
    key = _panel_key(item)
    value = _number(value_text)
    if key is None or value is None:
        return None
    label, low, high = PANELS[key]
    flag = "normal"
    if low is not None and value < low:
        flag = "low"
    elif high is not None and value > high:
        flag = "high"
    return {"key": key, "label": label, "value": value, "low": low, "high": high, "flag": flag}


def parse_labs(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8", errors="replace")
    rows = []
    if "," in text.splitlines()[0] or "\t" in text.splitlines()[0]:
        dialect = csv.excel_tab if "\t" in text.splitlines()[0] else csv.excel
        table = list(csv.DictReader(text.splitlines(), dialect=dialect))
        if table:
            fields = {name.strip().lower(): name for name in table[0] if name}
            item_key = fields.get("项目") or fields.get("名称") or fields.get("item") or fields.get("name")
            value_key = fields.get("结果") or fields.get("值") or fields.get("value") or fields.get("result")
            if item_key and value_key:
                for row in table:
                    parsed = _interpret(row.get(item_key, ""), row.get(value_key, ""))
                    if parsed:
                        rows.append(parsed)
                return rows
    for line in text.splitlines():
        if not line.strip():
            continue
        value = _number(line)
        if value is None:
            continue
        parsed = _interpret(line, str(value))
        if parsed:
            rows.append(parsed)
    return rows


def lab_lines(rows: list[dict]) -> list[str]:
    if not rows:
        return ["没有从体检文件里读到可识别的项目。"]
    lines = []
    for row in rows:
        if row["flag"] == "high" and row["high"] is not None:
            bound = f"，高于常见上限 {row['high']:g}"
        elif row["flag"] == "low" and row["low"] is not None:
            bound = f"，低于常见下限 {row['low']:g}"
        else:
            bound = "，在常见范围内"
        lines.append(f"- {row['label']} {row['value']:g}{bound}")
    lines.append("超出常见范围的项目只写在这里，不增删化合物。")
    return lines
