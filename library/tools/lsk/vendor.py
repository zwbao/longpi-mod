"""Vendored copies of tools/skillkit/*.py inside skills.

Skills stay runnable on their own, so shared code is copied, not imported
across directories. `sync` refreshes the copies; `check` fails on drift.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import List, Tuple

from .common import ROOT, skill_dirs

KIT = ROOT / "tools" / "skillkit" / "skillkit.py"
CARD = ROOT / "tools" / "skillkit" / "paper_card.py"


def _uses(skill_dir: Path, module: str) -> bool:
    scripts = skill_dir / "scripts"
    if not scripts.exists():
        return False
    needle = (f"import {module}", f"from {module} import")
    for path in scripts.glob("*.py"):
        if path.name == f"{module}.py":
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        if any(item in text for item in needle):
            return True
    return False


def targets() -> List[Tuple[Path, Path]]:
    """(canonical, vendored copy) pairs that should be identical."""
    pairs: List[Tuple[Path, Path]] = []
    for skill_dir in skill_dirs():
        manifest_path = skill_dir / "skill.json"
        has_paper = manifest_path.exists() and "paper" in json.loads(manifest_path.read_text(encoding="utf-8"))
        if has_paper and _uses(skill_dir, "paper_card"):
            pairs.append((CARD, skill_dir / "scripts" / "paper_card.py"))
        if _uses(skill_dir, "skillkit"):
            pairs.append((KIT, skill_dir / "scripts" / "skillkit.py"))
    return pairs


def sync() -> List[Path]:
    changed = []
    for source, copy in targets():
        data = source.read_bytes()
        if not copy.exists() or copy.read_bytes() != data:
            copy.write_bytes(data)
            changed.append(copy)
    return changed


def check() -> List[str]:
    errors = []
    for source, copy in targets():
        if not copy.exists():
            errors.append(f"{copy.relative_to(ROOT)} is missing (run: python3 -m tools.lsk vendor sync)")
        elif copy.read_bytes() != source.read_bytes():
            errors.append(f"{copy.relative_to(ROOT)} differs from {source.relative_to(ROOT)} (run: python3 -m tools.lsk vendor sync)")
    return errors


_RENDER = r"""
import json, sys
sys.path.insert(0, sys.argv[1])
import paper_card
print(json.dumps(paper_card.lines(), ensure_ascii=False))
"""


def check_cards() -> List[str]:
    """Render every vendored card in its own process and check its shape."""
    errors = []
    for source, copy in targets():
        if source != CARD or not copy.exists():
            continue
        name = copy.parent.parent.name
        result = subprocess.run([sys.executable, "-c", _RENDER, str(copy.parent)], capture_output=True, text=True)
        if result.returncode != 0:
            errors.append(f"{name}: paper card failed to render: {result.stderr.strip()[-300:]}")
            continue
        lines = json.loads(result.stdout)
        if not lines or lines[0] != "## 论文卡片":
            errors.append(f"{name}: paper card must start with ## 论文卡片")
        if any(line.startswith("## ") for line in lines[1:]):
            errors.append(f"{name}: paper card must not contain another ## heading")
        if not any("doi.org/" in line or "alphaxiv" in line.lower() for line in lines):
            errors.append(f"{name}: paper card has no DOI or source link")
        summary = lines[-1] if lines else ""
        if len(summary) < 40:
            errors.append(f"{name}: paper card summary is shorter than 40 characters")
    return errors
