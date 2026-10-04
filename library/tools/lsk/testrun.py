"""Run skill tests, one process per skill.

Every skill names its modules personal_report, presets and paper_card, so
their tests cannot share one pytest process. Skills whose requirements.txt
names a package that is not installed are reported as skipped, not failed.
"""

from __future__ import annotations

import importlib.util
import os
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Dict, List, Optional, Sequence

from .common import ROOT, skill_dirs

_REQ = re.compile(r"^\s*([A-Za-z0-9_.-]+)")
_IMPORT_NAMES = {"scikit-learn": "sklearn", "pyyaml": "yaml", "beautifulsoup4": "bs4"}


def missing_requirements(skill_dir: Path) -> List[str]:
    missing = []
    for req in skill_dir.glob("scripts/requirements*.txt"):
        for line in req.read_text(encoding="utf-8").splitlines():
            match = _REQ.match(line)
            if not match or line.strip().startswith("#"):
                continue
            package = match.group(1).lower()
            module = _IMPORT_NAMES.get(package, package.replace("-", "_"))
            if importlib.util.find_spec(module) is None:
                missing.append(package)
    return missing


def run_one(skill_dir: Path, python: str, timeout: int) -> Dict[str, object]:
    started = time.time()
    missing = missing_requirements(skill_dir)
    if missing:
        return {"skill": skill_dir.name, "status": "skipped", "detail": "missing " + ", ".join(missing), "seconds": 0.0}
    env = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1"}
    try:
        result = subprocess.run(
            [python, "-m", "pytest", "-q", "--no-header", "-p", "no:cacheprovider", "tests"],
            cwd=skill_dir, capture_output=True, text=True, timeout=timeout, env=env,
        )
    except subprocess.TimeoutExpired:
        return {"skill": skill_dir.name, "status": "failed", "detail": f"timed out after {timeout}s", "seconds": float(timeout)}
    tail = (result.stdout + result.stderr).strip().splitlines()
    passed = re.search(r"(\d+) passed", tail[-1] if tail else "")
    return {
        "skill": skill_dir.name,
        "status": "passed" if result.returncode == 0 else "failed",
        "detail": tail[-1] if tail else "",
        "log": "\n".join(tail[-40:]) if result.returncode != 0 else "",
        "cases": int(passed.group(1)) if passed else 0,
        "seconds": round(time.time() - started, 1),
    }


def changed_skills(base: str) -> tuple:
    """Skill names with committed or uncommitted changes since base, and whether tools/ or schema/ changed."""
    paths = set()
    for argv in (["git", "diff", "--name-only", f"{base}...HEAD"], ["git", "diff", "--name-only", "HEAD"],
                 ["git", "ls-files", "--others", "--exclude-standard"]):
        result = subprocess.run(argv, cwd=ROOT, capture_output=True, text=True)
        if result.returncode != 0:
            raise SystemExit(f"git failed: {' '.join(argv)}: {result.stderr.strip()}")
        paths.update(line.strip() for line in result.stdout.splitlines() if line.strip())
    names = sorted({path.split("/")[1] for path in paths if path.startswith("skills/") and path.count("/") >= 2
                    and not path.split("/")[1].startswith(("_", "."))})
    tools_changed = any(path.startswith(("tools/", "schema/")) for path in paths)
    return names, tools_changed


def run(names: Optional[Sequence[str]] = None, jobs: int = 8, timeout: int = 300, python: str = sys.executable,
        tools: bool = True, only: bool = False) -> int:
    dirs = [path for path in skill_dirs() if (path / "tests").exists()]
    if names or only:
        wanted = set(names or [])
        dirs = [path for path in dirs if path.name in wanted]
    with ThreadPoolExecutor(max(1, jobs)) as pool:
        results = list(pool.map(lambda path: run_one(path, python, timeout), dirs))
    failed = [item for item in results if item["status"] == "failed"]
    skipped = [item for item in results if item["status"] == "skipped"]
    cases = sum(int(item.get("cases", 0) or 0) for item in results)
    for item in failed:
        print(f"\nFAILED {item['skill']}: {item['detail']}\n{item.get('log', '')}")
    for item in skipped:
        print(f"skipped {item['skill']}: {item['detail']}")
    print(f"\nskills: {len(results)}  passed: {len(results) - len(failed) - len(skipped)}  failed: {len(failed)}  skipped: {len(skipped)}  test cases passed: {cases}")
    tools_tests = ROOT / "tools" / "tests"
    if tools and (not names or only) and tools_tests.exists():
        result = subprocess.run([python, "-m", "pytest", "-q", "--no-header", "-p", "no:cacheprovider", str(tools_tests)], cwd=ROOT)
        if result.returncode != 0:
            print("tools/tests failed")
            return 1
    return 1 if failed else 0
