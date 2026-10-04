"""Load and check skills/*/skill.json.

The JSON Schema covers shapes. This module adds the rules that cross fields or
files: kind and tier, paper or tool block, script paths, intent ids, unit
factors, verified inputs, and the vendored skillkit copy.
"""

from __future__ import annotations

from collections import OrderedDict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from . import jsonschema_lite, units
from .common import INTENTS, KIT_SOURCE, SCHEMA, read_json, skill_dirs, write_json
from .doi import normalize_doi

KEY_ORDER = [
    "$schema", "schema", "name", "kind", "tier", "species", "evidence", "domains", "blurb_zh", "intents",
    "triage", "paper", "tool", "entry", "population", "inputs_status", "inputs", "outputs", "related_not_same", "data_files",
]
PAPER_ORDER = [
    "doi", "source_id", "title", "title_zh", "journal", "year", "authors", "article_url", "supplements",
    "code_url", "card_notes", "summary_zh", "summary_status",
]
INPUT_ORDER = [
    "key", "label_zh", "aliases", "loinc", "unit", "accept", "molar_mass", "range", "unit_required", "required", "from", "flag",
    "output_of", "group", "note_zh",
]
PROFILE_KEYS = {"age", "sex"}


def ordered(manifest: Dict[str, Any]) -> "OrderedDict[str, Any]":
    """Stable key order so generated diffs stay small."""

    def sort(mapping: Dict[str, Any], order: List[str]) -> "OrderedDict[str, Any]":
        out: "OrderedDict[str, Any]" = OrderedDict()
        for key in order:
            if key in mapping:
                out[key] = mapping[key]
        for key in mapping:
            if key not in out:
                out[key] = mapping[key]
        return out

    result = sort(manifest, KEY_ORDER)
    if isinstance(result.get("paper"), dict):
        result["paper"] = sort(result["paper"], PAPER_ORDER)
    if isinstance(result.get("inputs"), list):
        result["inputs"] = [sort(item, INPUT_ORDER) if isinstance(item, dict) else item for item in result["inputs"]]
    return result


def manifest_path(skill_dir: Path) -> Path:
    return skill_dir / "skill.json"


def load(skill_dir: Path) -> Optional[Dict[str, Any]]:
    path = manifest_path(skill_dir)
    if not path.exists():
        return None
    return read_json(path)


def save(skill_dir: Path, manifest: Dict[str, Any]) -> bool:
    return write_json(manifest_path(skill_dir), ordered(manifest))


def load_all() -> Dict[str, Dict[str, Any]]:
    found: Dict[str, Dict[str, Any]] = {}
    for skill_dir in skill_dirs():
        data = load(skill_dir)
        if data is not None:
            found[skill_dir.name] = data
    return found


def intent_ids() -> List[str]:
    return [item["id"] for item in read_json(INTENTS)["intents"]]


def check_one(skill_dir: Path, manifest: Dict[str, Any], schema: Dict[str, Any], intents: List[str],
              all_names: List[str], table: Dict[str, Dict[str, Any]]) -> List[str]:
    """Problems for one manifest, prefixed with the skill name."""
    name = skill_dir.name
    errors = [f"{name}: schema {message}" for message in jsonschema_lite.validate(manifest, schema)]
    if errors:
        return errors
    if manifest["name"] != name:
        errors.append(f"{name}: name is {manifest['name']!r}, directory is {name!r}")
    kind, tier = manifest["kind"], manifest["tier"]
    if kind == "paper":
        if tier not in {"A", "B", "C"}:
            errors.append(f"{name}: a paper skill needs tier A, B, or C")
        paper = manifest.get("paper")
        if not paper:
            errors.append(f"{name}: a paper skill needs a paper block")
        else:
            if not paper.get("doi") and not paper.get("source_id"):
                errors.append(f"{name}: paper needs doi or source_id")
            if paper.get("doi") and paper["doi"] != normalize_doi(paper["doi"]):
                errors.append(f"{name}: paper.doi is not normalized ({normalize_doi(paper['doi'])})")
            summary = paper.get("summary_zh", "")
            if summary.rstrip("。").strip() == paper.get("title_zh", "").strip():
                errors.append(f"{name}: paper.summary_zh only repeats title_zh")
        if "triage" not in manifest:
            errors.append(f"{name}: a paper skill needs a triage block")
    elif kind == "tool":
        if tier != "tool":
            errors.append(f"{name}: a tool skill has tier tool")
        if not manifest.get("tool"):
            errors.append(f"{name}: a tool skill needs a tool block")
    elif kind == "evidence" and tier != "tool":
        errors.append(f"{name}: the evidence skill has tier tool")
    for intent in manifest.get("intents", []):
        if intent not in intents:
            errors.append(f"{name}: unknown intent {intent!r}")
    for other in manifest.get("related_not_same", []):
        if other not in all_names:
            errors.append(f"{name}: related_not_same names a missing skill {other!r}")
    population = manifest.get("population") or {}
    span = population.get("age_years")
    if span and not span[0] < span[1]:
        errors.append(f"{name}: population.age_years must be [low, high] with low < high")
    entry = manifest.get("entry")
    default_script = skill_dir / "scripts" / "personal_report.py"
    if entry:
        if not (skill_dir / entry["script"]).exists():
            errors.append(f"{name}: entry.script {entry['script']} does not exist")
    elif default_script.exists():
        errors.append(f"{name}: scripts/personal_report.py exists but entry is missing")
    errors += _check_inputs(skill_dir, manifest, table)
    outputs = [item["key"] for item in manifest.get("outputs", [])]
    if len(outputs) != len(set(outputs)):
        errors.append(f"{name}: duplicate output keys")
    for item in manifest.get("data_files", []):
        if not (skill_dir / item["path"]).exists():
            errors.append(f"{name}: data_files path {item['path']} does not exist")
    return errors


def _check_inputs(skill_dir: Path, manifest: Dict[str, Any], table: Dict[str, Dict[str, Any]]) -> List[str]:
    name = skill_dir.name
    errors: List[str] = []
    inputs = manifest.get("inputs", [])
    status = manifest.get("inputs_status", "none")
    if inputs and status == "none":
        errors.append(f"{name}: inputs are declared but inputs_status is none")
    if status in {"draft", "verified"} and not inputs:
        errors.append(f"{name}: inputs_status is {status} but inputs is empty")
    keys = [item["key"] for item in inputs]
    if len(keys) != len(set(keys)):
        errors.append(f"{name}: duplicate input keys")
    kit = units._kit
    seen: Dict[str, str] = {}
    for spec in inputs:
        where = f"{name}: input {spec['key']}"
        low_high = spec.get("range")
        if low_high and not low_high[0] < low_high[1]:
            errors.append(f"{where}: range must be [low, high] with low < high")
        if spec["from"] == "argument" and not spec.get("flag"):
            errors.append(f"{where}: an argument input needs flag")
        if spec["from"] == "profile" and spec["key"] not in PROFILE_KEYS:
            errors.append(f"{where}: profile inputs are {sorted(PROFILE_KEYS)}")
        if spec["from"] == "output" and not spec.get("output_of"):
            errors.append(f"{where}: an output input needs output_of")
        errors += [f"{name}: {message}" for message in units.check_input_units(spec, table)]
        if spec["from"] != "measurements":
            continue
        for alias in [spec["key"], spec.get("label_zh", ""), *spec.get("aliases", [])]:
            folded = kit.fold_name(alias)
            if not folded:
                continue
            owner = seen.get(folded)
            if owner and owner != spec["key"]:
                errors.append(f"{where}: name {alias!r} also names input {owner}")
            seen[folded] = spec["key"]
    if status == "verified":
        if not (skill_dir / "tests" / "test_manifest.py").exists():
            errors.append(f"{name}: verified inputs need tests/test_manifest.py")
        vendored = skill_dir / "scripts" / "skillkit.py"
        if not vendored.exists():
            errors.append(f"{name}: verified inputs need scripts/skillkit.py")
        elif vendored.read_bytes() != KIT_SOURCE.read_bytes():
            errors.append(f"{name}: scripts/skillkit.py differs from tools/skillkit/skillkit.py (run: python3 -m tools.lsk kit sync)")
    return errors


def check_all() -> Tuple[Dict[str, Dict[str, Any]], List[str]]:
    schema = read_json(SCHEMA / "skill.schema.json")
    intents = intent_ids()
    table = units.load_table()
    dirs = skill_dirs()
    names = [path.name for path in dirs]
    manifests: Dict[str, Dict[str, Any]] = {}
    errors: List[str] = []
    for skill_dir in dirs:
        try:
            data = load(skill_dir)
        except ValueError as error:
            errors.append(f"{skill_dir.name}: skill.json is not valid JSON: {error}")
            continue
        if data is None:
            errors.append(f"{skill_dir.name}: missing skill.json")
            continue
        manifests[skill_dir.name] = data
        errors += check_one(skill_dir, data, schema, intents, names, table)
    output_keys = {item["key"] for data in manifests.values() for item in data.get("outputs", [])}
    for name, data in manifests.items():
        for spec in data.get("inputs", []):
            for key in spec.get("output_of", []):
                if key not in output_keys:
                    errors.append(f"{name}: input {spec['key']} output_of names unknown output {key!r}")
    intents_doc = read_json(INTENTS)
    for intent in intents_doc["intents"]:
        for skill in intent.get("skills", []):
            if skill not in manifests:
                errors.append(f"intents.json: {intent['id']} lists missing skill {skill!r}")
            elif manifests[skill]["tier"] == "C":
                errors.append(f"intents.json: {intent['id']} lists tier C skill {skill!r}")
    return manifests, errors
