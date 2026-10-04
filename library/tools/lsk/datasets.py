"""data/: shared reference tables the personal harness reads.

biological_variation.json  within-person variation per marker (reference change value)
effects.jsonl              average intervention effects from trials and meta-analyses

Both hold medical constants, so every row names its source and says whether it
was checked against that source (verified). The checks here keep the shape
honest and confirm each number appears in the quoted source text; they cannot
tell whether the source itself is right.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List

from . import jsonschema_lite
from .common import ROOT, SCHEMA, read_json, read_jsonl

BIOVAR = ROOT / "data" / "biological_variation.json"
EFFECTS = ROOT / "data" / "effects.jsonl"


def check_biovar() -> List[str]:
    if not BIOVAR.exists():
        return []
    schema = read_json(SCHEMA / "biological_variation.schema.json")
    data = read_json(BIOVAR)
    errors = [f"data/biological_variation.json{message}" for message in jsonschema_lite.validate(data, schema)]
    seen: Dict[str, int] = {}
    codes: Dict[str, str] = {}
    for index, row in enumerate(data.get("markers", []) if isinstance(data, dict) else []):
        if not isinstance(row, dict):
            continue
        key = row.get("key", "")
        if key in seen:
            errors.append(f"data/biological_variation.json: duplicate marker key {key}")
        seen[key] = index
        for code in row.get("loinc", []) + row.get("device_codes", []):
            if code in codes and codes[code] != key:
                errors.append(f"data/biological_variation.json: code {code} is on both {codes[code]} and {key}")
            codes[code] = key
        source = row.get("cvi_source", {}) if isinstance(row.get("cvi_source"), dict) else {}
        if "biologicalvariation.eu" in str(source.get("url", "")):
            errors.append(f"data/biological_variation.json: {key} cites the EFLM database, whose terms restrict redistribution; use a journal article")
        if row.get("verified"):
            if "doi" not in source:
                errors.append(f"data/biological_variation.json: {key} is verified but its CVI source has no DOI")
            if not source.get("quote"):
                errors.append(f"data/biological_variation.json: {key} is verified but its CVI source has no quote")
            else:
                missing = numbers_missing(source["quote"], [row.get("cvi_pct")] + list(row.get("cvi_ci_pct") or []))
                if missing:
                    errors.append(f"data/biological_variation.json: {key} quote does not contain {', '.join(str(item) for item in missing)}; copy the numbers exactly as printed")
    return errors


def load_biovar() -> Dict[str, Any]:
    return read_json(BIOVAR) if BIOVAR.exists() else {"markers": []}


def check_effects() -> List[str]:
    if not EFFECTS.exists():
        return []
    schema = read_json(SCHEMA / "effect.schema.json")
    markers = {row.get("key") for row in load_biovar().get("markers", [])}
    errors: List[str] = []
    seen: Dict[str, int] = {}
    for index, row in enumerate(read_jsonl(EFFECTS), start=1):
        where = f"data/effects.jsonl:{index}"
        for message in jsonschema_lite.validate(row, schema):
            errors.append(f"{where}{message}")
        if not isinstance(row, dict):
            continue
        if row.get("id") in seen:
            errors.append(f"{where}: duplicate id {row.get('id')} (also line {seen[row['id']]})")
        seen[row.get("id")] = index
        key = row.get("marker_key")
        if key and BIOVAR.exists() and key not in markers:
            errors.append(f"{where}: marker_key {key} is not in data/biological_variation.json")
        ci = row.get("effect", {}).get("ci")
        value = row.get("effect", {}).get("value")
        if isinstance(ci, list) and len(ci) == 2 and isinstance(value, (int, float)) and not min(ci) <= value <= max(ci):
            errors.append(f"{where}: effect value {value} is outside its confidence interval {ci}")
        if row.get("verified") and row.get("verified_by") not in ("person", "quote_match"):
            errors.append(f"{where}: verified rows say who checked them (verified_by: person or quote_match)")
        missing = numbers_missing_from_quote(row)
        if missing:
            errors.append(f"{where}: the quote does not contain {', '.join(str(item) for item in missing)}; copy the numbers exactly as printed")
    return errors


_NUMBER = re.compile(r"\d+(?:\.\d+)?")


def numbers_missing(quote: str, wanted: List[Any]) -> List[float]:
    """Numbers (sign aside) that do not appear in a verbatim quote."""
    text = str(quote).replace("\u00b7", ".").replace("\u2212", "-")
    have = {float(item) for item in _NUMBER.findall(text)}
    return [abs(item) for item in wanted if isinstance(item, (int, float)) and not any(abs(abs(item) - seen) < 1e-9 for seen in have)]


def numbers_missing_from_quote(row: Dict[str, Any]) -> List[float]:
    """Effect value and interval bounds (sign aside) that do not appear in the verbatim quote."""
    effect = row.get("effect") or {}
    return numbers_missing(row.get("quote", ""), [effect.get("value")] + list(effect.get("ci") or []))
