#!/usr/bin/env python3
"""Re-download the DrugAge snapshot the ranking is locked to.

The report reads data/drugage.csv already stored in this skill. Run this only
when asked to refresh. A failed hash check leaves the frozen file in place.
"""

from __future__ import annotations

import hashlib
import sys
import urllib.request
from pathlib import Path

from presets import DRUGAGE_SHA256, DRUGAGE_URL


def cache_dir() -> Path:
    return Path.home() / ".cache" / "longevitybench"


def refresh() -> Path:
    destination = cache_dir() / "drugage.csv"
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(".csv.partial")
    urllib.request.urlretrieve(DRUGAGE_URL, temporary)
    digest = hashlib.sha256(temporary.read_bytes()).hexdigest()
    if digest != DRUGAGE_SHA256:
        temporary.unlink(missing_ok=True)
        raise SystemExit(
            "Downloaded DrugAge file does not match the locked snapshot. The report still uses data/drugage.csv."
        )
    temporary.replace(destination)
    return destination


def main() -> int:
    print(refresh())
    return 0


if __name__ == "__main__":
    sys.exit(main())
