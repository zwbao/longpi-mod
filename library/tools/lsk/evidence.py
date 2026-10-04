"""skills/longevity-evidence/data/claims.jsonl: named entities and what one paper states about them.

Rows are copied from a skill's frozen lists (presets, supplements, main text),
never inferred. The longevity-evidence skill queries this file.
"""

from __future__ import annotations

from typing import Any, Dict, List

from . import jsonschema_lite
from .common import EVIDENCE, SCHEMA, read_json, read_jsonl


def load() -> List[Dict[str, Any]]:
    return read_jsonl(EVIDENCE)


def check(manifests: Dict[str, Dict[str, Any]]) -> List[str]:
    schema = read_json(SCHEMA / "claim.schema.json")
    errors: List[str] = []
    seen: Dict[str, int] = {}
    for index, row in enumerate(load(), start=1):
        where = f"skills/longevity-evidence/data/claims.jsonl:{index}"
        for message in jsonschema_lite.validate(row, schema):
            errors.append(f"{where}: {message}")
        if not isinstance(row, dict) or "id" not in row:
            continue
        if row["id"] in seen:
            errors.append(f"{where}: duplicate id {row['id']} (also line {seen[row['id']]})")
        seen[row["id"]] = index
        source = row.get("source") or {}
        skill = source.get("skill")
        if skill not in manifests:
            errors.append(f"{where}: source.skill {skill!r} does not exist")
            continue
        if not row["id"].startswith(f"{skill}:"):
            errors.append(f"{where}: id must start with the source skill name")
        if skill == "longevity-evidence" and not (source.get("doi") and source.get("title")):
            errors.append(f"{where}: a row filed under longevity-evidence needs source.doi and source.title")
        paper_doi = (manifests[skill].get("paper") or {}).get("doi")
        if source.get("doi") and paper_doi and source["doi"] != paper_doi:
            errors.append(f"{where}: source.doi {source['doi']} is not {skill}'s paper ({paper_doi})")
        species = set(row.get("species", []))
        skill_species = set(manifests[skill].get("species", []))
        if species == {"human"} and "human" not in skill_species:
            errors.append(f"{where}: {skill} has no human evidence ({sorted(skill_species)}) but the claim says human only")
    return errors
