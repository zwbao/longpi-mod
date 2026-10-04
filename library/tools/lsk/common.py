"""Paths and small file helpers shared by the lsk commands."""

from __future__ import annotations

import datetime as _dt
import importlib.util
import sys
import json
from pathlib import Path
from types import ModuleType
from typing import Any, Dict, Iterable, List

ROOT = Path(__file__).resolve().parents[2]
SKILLS = ROOT / "skills"
SCHEMA = ROOT / "schema"
REGISTRY = ROOT / "registry" / "papers.jsonl"
EVIDENCE = ROOT / "skills" / "longevity-evidence" / "data" / "claims.jsonl"
INTENTS = ROOT / "intents.json"
CATALOG = ROOT / "catalog.json"
VERSION_FILE = ROOT / "VERSION"
README = ROOT / "README.md"
LEGACY_REGISTRY = SKILLS / "_registry" / "processed_dois.jsonl"
LEGACY_METHOD_MAP = SKILLS / "_registry" / "method_map.json"
KIT_SOURCE = ROOT / "tools" / "skillkit" / "skillkit.py"


def today() -> str:
    return _dt.date.today().isoformat()


def skill_dirs() -> List[Path]:
    return sorted(
        path for path in SKILLS.iterdir()
        if path.is_dir() and not path.name.startswith((".", "_")) and (path / "SKILL.md").exists()
    )


def read_json(path: Path) -> Any:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def dump_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def write_json(path: Path, value: Any) -> bool:
    """Write JSON if the text changed. Returns True when the file changed."""
    path = Path(path)
    text = dump_json(value)
    if path.exists() and path.read_text(encoding="utf-8") == text:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return True


def read_jsonl(path: Path) -> List[Dict[str, Any]]:
    path = Path(path)
    if not path.exists():
        return []
    rows = []
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError as error:
            raise ValueError(f"{path}:{number}: {error}") from error
    return rows


def dump_jsonl(rows: Iterable[Dict[str, Any]]) -> str:
    return "".join(json.dumps(row, ensure_ascii=False, sort_keys=False) + "\n" for row in rows)


def write_jsonl(path: Path, rows: Iterable[Dict[str, Any]]) -> bool:
    path = Path(path)
    text = dump_jsonl(rows)
    if path.exists() and path.read_text(encoding="utf-8") == text:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return True


def load_skillkit() -> ModuleType:
    """Import the canonical tools/skillkit/skillkit.py without touching sys.path."""
    if "lsk_skillkit" in sys.modules:
        return sys.modules["lsk_skillkit"]
    spec = importlib.util.spec_from_file_location("lsk_skillkit", KIT_SOURCE)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules["lsk_skillkit"] = module
    spec.loader.exec_module(module)
    return module
