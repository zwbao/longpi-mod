"""Fetch a paper's PubMed abstract by DOI, with a local cache.

Crossref often lacks abstracts for Nature-family journals; PubMed has them.
Used when writing or reviewing paper.summary_zh, never at report time.
"""

from __future__ import annotations

import hashlib
import json
import time
import urllib.parse
import urllib.request
from typing import Optional

from .common import ROOT
from .crossref import USER_AGENT
from .doi import normalize_doi

CACHE = ROOT / ".cache" / "pubmed"
EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"


def _get(url: str, timeout: float = 30.0) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.read()
        except Exception:
            if attempt == 2:
                raise
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError("unreachable")


def abstract_text(doi: str, refresh: bool = False) -> Optional[str]:
    """PubMed abstract text (title, authors, abstract) for a DOI, or None."""
    doi = normalize_doi(doi)
    path = CACHE / (hashlib.sha256(doi.encode("utf-8")).hexdigest()[:24] + ".json")
    if path.exists() and not refresh:
        return json.loads(path.read_text(encoding="utf-8")).get("text")
    term = urllib.parse.quote(f"{doi}[doi]")
    found = json.loads(_get(f"{EUTILS}esearch.fcgi?db=pubmed&retmode=json&term={term}"))
    ids = found.get("esearchresult", {}).get("idlist", [])
    text = None
    if ids:
        time.sleep(0.34)
        text = _get(f"{EUTILS}efetch.fcgi?db=pubmed&rettype=abstract&retmode=text&id={ids[0]}").decode("utf-8")
    CACHE.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"doi": doi, "pmid": ids[0] if ids else None, "text": text}, ensure_ascii=False) + "\n", encoding="utf-8")
    time.sleep(0.34)
    return text
