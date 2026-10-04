"""registry/papers.jsonl: every paper the pipeline has seen, keyed by normalized DOI.

The weekly pipeline calls upsert() for each paper it looks at, whatever the
outcome, so the next run skips it. skills/_registry/processed_dois.jsonl is a
generated copy in the old format for jobs that still read it.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from . import jsonschema_lite
from .common import LEGACY_REGISTRY, REGISTRY, SCHEMA, read_json, read_jsonl, today, write_jsonl
from .doi import normalize_doi

ROW_ORDER = ["doi", "title", "journal", "year", "tier", "outcome", "skill", "reason_zh", "first_seen", "updated", "source"]


def load() -> List[Dict[str, Any]]:
    return read_jsonl(REGISTRY)


def _ordered(row: Dict[str, Any]) -> Dict[str, Any]:
    out = {key: row[key] for key in ROW_ORDER if key in row and row[key] not in ("", None)}
    for key, value in row.items():
        if key not in out and value not in ("", None):
            out[key] = value
    return out


def save(rows: List[Dict[str, Any]]) -> bool:
    return write_jsonl(REGISTRY, [_ordered(row) for row in sorted(rows, key=lambda item: item["doi"])])


def find(rows: List[Dict[str, Any]], doi: str) -> Optional[Dict[str, Any]]:
    key = normalize_doi(doi) or (doi or "").strip()
    for row in rows:
        if row["doi"] == key:
            return row
    return None


def upsert(rows: List[Dict[str, Any]], row: Dict[str, Any], source: str = "pipeline") -> Tuple[Dict[str, Any], bool]:
    """Insert or update one paper by normalized DOI. Returns (row, created)."""
    key = normalize_doi(row.get("doi", "")) or (row.get("doi") or "").strip()
    if not key:
        raise ValueError("a registry row needs a DOI or a namespaced source id")
    existing = find(rows, key)
    if existing is None:
        fresh = {**row, "doi": key, "first_seen": row.get("first_seen") or today(), "updated": today(), "source": row.get("source") or source}
        rows.append(fresh)
        return fresh, True
    for field, value in row.items():
        if field in {"doi", "first_seen", "source"} or value in ("", None):
            continue
        existing[field] = value
    existing["updated"] = today()
    return existing, False


def check(manifests: Dict[str, Dict[str, Any]]) -> List[str]:
    schema = read_json(SCHEMA / "paper.schema.json")
    rows = load()
    errors: List[str] = []
    seen: Dict[str, int] = {}
    for index, row in enumerate(rows, start=1):
        for message in jsonschema_lite.validate(row, schema):
            errors.append(f"registry/papers.jsonl:{index}: {message}")
        key = row.get("doi", "")
        if key in seen:
            errors.append(f"registry/papers.jsonl:{index}: duplicate paper {key} (also line {seen[key]})")
        seen[key] = index
        if normalize_doi(key) and normalize_doi(key) != key:
            errors.append(f"registry/papers.jsonl:{index}: DOI not normalized ({normalize_doi(key)})")
        if row.get("outcome") == "skill":
            skill = row.get("skill")
            if skill not in manifests:
                errors.append(f"registry/papers.jsonl:{index}: skill {skill!r} does not exist")
            else:
                data = manifests[skill]
                paper_key = (data.get("paper") or {}).get("doi") or (data.get("paper") or {}).get("source_id") or (data.get("tool") or {}).get("doi")
                if paper_key != key:
                    errors.append(f"registry/papers.jsonl:{index}: {skill} cites {paper_key}, registry says {key}")
                if row.get("tier") != data["tier"]:
                    errors.append(f"registry/papers.jsonl:{index}: {skill} is tier {data['tier']}, registry says {row.get('tier')}")
    for name, data in manifests.items():
        key = (data.get("paper") or {}).get("doi") or (data.get("paper") or {}).get("source_id")
        if data["kind"] == "paper" and key not in seen:
            errors.append(f"{name}: paper {key} is not in registry/papers.jsonl")
    return errors


def sync_from_manifests(manifests: Dict[str, Dict[str, Any]]) -> int:
    """Refresh tier, title, journal and year of skill rows from skill.json. Returns rows changed."""
    rows = load()
    changed = 0
    for row in rows:
        data = manifests.get(row.get("skill", ""))
        if row.get("outcome") != "skill" or not data:
            continue
        paper = data.get("paper") or {}
        wanted = {"tier": data["tier"]}
        for key in ("title", "journal", "year"):
            if paper.get(key):
                wanted[key] = paper[key]
        if data.get("triage", {}).get("reason_zh"):
            wanted["reason_zh"] = data["triage"]["reason_zh"]
        if any(row.get(key) != value for key, value in wanted.items()):
            row.update(wanted)
            row["updated"] = today()
            changed += 1
    save(rows)
    return changed


def legacy_rows() -> List[Dict[str, Any]]:
    """Rows in the old processed_dois.jsonl format, for jobs that still read it."""
    out = []
    for row in load():
        if row.get("outcome") != "skill":
            continue
        out.append({
            "doi": row["doi"],
            "skill_name": row["skill"],
            "date_added": row.get("first_seen", ""),
            "title": row.get("title", ""),
            "journal": row.get("journal", ""),
            "tier": row.get("tier", ""),
        })
    return sorted(out, key=lambda item: item["skill_name"])


def write_legacy() -> bool:
    return write_jsonl(LEGACY_REGISTRY, legacy_rows())


def check_legacy() -> List[str]:
    current = read_jsonl(LEGACY_REGISTRY)
    if current != legacy_rows():
        return ["skills/_registry/processed_dois.jsonl is stale (run: python3 -m tools.lsk registry --write-legacy)"]
    return []
