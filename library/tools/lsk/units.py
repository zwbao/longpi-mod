"""Check the unit conversion factors declared in skill.json against schema/units.json."""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional

from .common import SCHEMA, load_skillkit, read_json

_kit = load_skillkit()
normalize_unit = _kit.normalize_unit


def load_table() -> Dict[str, Dict[str, Any]]:
    return read_json(SCHEMA / "units.json")["units"]


def expected_factor(from_unit: str, to_unit: str, molar_mass: Optional[float], table: Dict[str, Dict[str, Any]]) -> Optional[float]:
    """Factor converting a value in from_unit to to_unit, or None if unknown."""
    a = table.get(normalize_unit(from_unit))
    b = table.get(normalize_unit(to_unit))
    if a is None or b is None:
        return None
    if a["dim"] == b["dim"]:
        return a["factor"] / b["factor"]
    if molar_mass:
        if a["dim"] == "mass_conc" and b["dim"] == "molar_conc":
            return a["factor"] / molar_mass / b["factor"]
        if a["dim"] == "molar_conc" and b["dim"] == "mass_conc":
            return a["factor"] * molar_mass / b["factor"]
    return None


def check_input_units(spec: Dict[str, Any], table: Dict[str, Dict[str, Any]], tolerance: float = 0.01) -> List[str]:
    """Problems with one input's unit and accept map. Empty means consistent."""
    problems: List[str] = []
    unit = spec.get("unit", "")
    accept = spec.get("accept") or {}
    if not unit:
        if accept:
            problems.append(f"{spec['key']}: accept needs a canonical unit")
        return problems
    canonical = normalize_unit(unit)
    if canonical not in table:
        problems.append(f"{spec['key']}: unit {unit!r} is not in schema/units.json")
        return problems
    for name, factor in accept.items():
        if normalize_unit(name) == canonical:
            if not math.isclose(float(factor), 1.0, rel_tol=1e-9):
                problems.append(f"{spec['key']}: accept[{name!r}] is the canonical unit and must be 1")
            continue
        expected = expected_factor(name, unit, spec.get("molar_mass"), table)
        if expected is None:
            problems.append(f"{spec['key']}: cannot check accept[{name!r}] against {unit!r} (unknown unit or missing molar_mass)")
            continue
        if not math.isclose(float(factor), expected, rel_tol=tolerance):
            problems.append(f"{spec['key']}: accept[{name!r}] = {factor} but {name} -> {unit} is {expected:.6g}")
    return problems
