"""Download reference files into a local cache.

The skill fetches GEO, STRING, STITCH, and the 450k promoter annotation
itself. Callers pass a destination path; completed files are reused.
"""

from __future__ import annotations

import shutil
import urllib.request
from pathlib import Path

USER_AGENT = "steeramed-core/0.2 (local reference cache)"


def cache_dir() -> Path:
    path = Path.home() / ".cache" / "steeramed-core"
    path.mkdir(parents=True, exist_ok=True)
    return path


def download(url: str, dest: Path, timeout: int = 120) -> Path:
    """Download ``url`` to ``dest``, resuming a partial file when the server allows it."""
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    partial = dest.with_name(dest.name + ".partial")
    existing = partial.stat().st_size if partial.exists() else 0
    headers = {"User-Agent": USER_AGENT}
    if existing:
        headers["Range"] = f"bytes={existing}-"
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        status = getattr(response, "status", 200)
        mode = "ab" if status == 206 and existing else "wb"
        if mode == "wb":
            existing = 0
        with partial.open(mode) as handle:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                handle.write(chunk)
                existing += len(chunk)
                if existing // (50 * 1024 * 1024) != (existing - len(chunk)) // (50 * 1024 * 1024):
                    print(f"download {dest.name}: {existing / 1e6:.0f} MB", flush=True)
    shutil.move(partial, dest)
    return dest
