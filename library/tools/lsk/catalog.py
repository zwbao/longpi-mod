"""Build catalog.json: the machine-readable index agents and dsh-plugin-longpi read.

The file is deterministic (no timestamps, no git hash) so CI can check it is
up to date with `python3 -m tools.lsk catalog --check`. The release version
comes from VERSION.
"""

from __future__ import annotations

import re
from collections import Counter
from typing import Any, Dict, List

from .common import EVIDENCE, INTENTS, SKILLS, VERSION_FILE, read_json, read_jsonl

CATALOG_SCHEMA = "longevity-catalog/1"


def frontmatter_description(skill_md: str) -> str:
    match = re.match(r"^---\r?\n([\s\S]*?)\r?\n---", skill_md)
    if not match:
        return ""
    lines = match.group(1).splitlines()
    for index, line in enumerate(lines):
        if re.match(r"^description:\s*(>-|[>|])\s*$", line):
            block = []
            for nxt in lines[index + 1:]:
                if nxt.strip() and not nxt.startswith((" ", "\t")):
                    break
                if nxt.strip():
                    block.append(nxt.strip())
            return re.sub(r"\s+", " ", " ".join(block)).strip()
        inline = re.match(r"^description:\s*(.+)$", line)
        if inline:
            return inline.group(1).strip().strip("'\"")
    return ""


def version() -> str:
    return VERSION_FILE.read_text(encoding="utf-8").strip() if VERSION_FILE.exists() else "0.0.0-dev"


def skill_entry(name: str, data: Dict[str, Any]) -> Dict[str, Any]:
    skill_md = (SKILLS / name / "SKILL.md").read_text(encoding="utf-8")
    entry: Dict[str, Any] = {
        "name": name,
        "kind": data["kind"],
        "tier": data["tier"],
        "species": data["species"],
        "evidence": data["evidence"],
        "domains": data["domains"],
        "blurb_zh": data["blurb_zh"],
        "description": frontmatter_description(skill_md),
        "intents": data.get("intents", []),
        "has_script": bool(data.get("entry")),
    }
    if data.get("entry"):
        entry["entry"] = data["entry"]
    if data.get("population"):
        entry["population"] = data["population"]
    if data.get("inputs"):
        entry["inputs_status"] = data.get("inputs_status", "draft")
        entry["inputs"] = data["inputs"]
    if data.get("outputs"):
        entry["outputs"] = data["outputs"]
    paper = data.get("paper")
    if paper:
        entry["paper"] = {key: paper[key] for key in ("doi", "source_id", "title", "title_zh", "journal", "year") if key in paper}
    tool = data.get("tool")
    if tool:
        entry["tool"] = {key: tool[key] for key in ("upstream", "version", "commit", "requires", "doi") if key in tool}
    if data.get("related_not_same"):
        entry["related_not_same"] = data["related_not_same"]
    return entry


def build(manifests: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    intents = read_json(INTENTS)["intents"]
    claims = read_jsonl(EVIDENCE)
    skills: List[Dict[str, Any]] = [skill_entry(name, manifests[name]) for name in sorted(manifests)]
    tiers = Counter(item["tier"] for item in skills)
    return {
        "schema": CATALOG_SCHEMA,
        "version": version(),
        "counts": {
            "skills": len(skills),
            "tiers": {key: tiers.get(key, 0) for key in ("A", "B", "C", "tool")},
            "claims": len(claims),
            "claim_entities": len({(row["entity_type"], row["entity"].casefold()) for row in claims}),
        },
        "intents": intents,
        "skills": skills,
    }
