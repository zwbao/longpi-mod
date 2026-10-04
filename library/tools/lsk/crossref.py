"""Fetch paper metadata from the Crossref REST API, with a local cache.

Only public bibliographic metadata is requested (title, journal, year,
authors, abstract when the publisher deposited one). Responses are cached in
.cache/crossref/ so reruns and CI do not hit the network.
"""

from __future__ import annotations

import hashlib
import html
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, Optional

from .common import ROOT
from .doi import normalize_doi

CACHE = ROOT / ".cache" / "crossref"
API = "https://api.crossref.org/works/"
USER_AGENT = "longevity-skills-lsk/1.0 (https://github.com/zwbao/longevity-skills)"


def _cache_path(doi: str) -> Path:
    return CACHE / (hashlib.sha256(doi.encode("utf-8")).hexdigest()[:24] + ".json")


def fetch_raw(doi: str, refresh: bool = False, timeout: float = 20.0) -> Optional[Dict[str, Any]]:
    """Crossref message for a DOI, or None when Crossref has no record."""
    doi = normalize_doi(doi)
    path = _cache_path(doi)
    if path.exists() and not refresh:
        cached = json.loads(path.read_text(encoding="utf-8"))
        return cached.get("message")
    url = API + urllib.parse.quote(doi, safe="/")
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    message: Optional[Dict[str, Any]] = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                message = json.loads(response.read().decode("utf-8")).get("message")
            break
        except urllib.error.HTTPError as error:
            if error.code == 404:
                message = None
                break
            if attempt == 2:
                raise
        except urllib.error.URLError:
            if attempt == 2:
                raise
        time.sleep(1.5 * (attempt + 1))
    CACHE.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"doi": doi, "message": message}, ensure_ascii=False) + "\n", encoding="utf-8")
    return message


def _year(message: Dict[str, Any]) -> Optional[int]:
    for key in ("published-print", "published-online", "issued", "created"):
        parts = (message.get(key) or {}).get("date-parts") or []
        if parts and parts[0] and parts[0][0]:
            return int(parts[0][0])
    return None


def _clean(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text or "")
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def summarize(message: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Fields the paper block uses: title, journal, year, authors, abstract, type."""
    if not message:
        return {}
    titles = message.get("title") or []
    journals = message.get("container-title") or []
    authors = message.get("author") or []
    first = ""
    if authors:
        head = authors[0]
        first = head.get("family") or head.get("name") or ""
    author_text = ""
    if first:
        author_text = first if len(authors) == 1 else f"{first} 等"
    out = {
        "title": _clean(titles[0]) if titles else "",
        "journal": _clean(journals[0]) if journals else "",
        "year": _year(message),
        "authors": author_text,
        "abstract": _clean(message.get("abstract", "")),
        "type": message.get("type", ""),
        "publisher": message.get("publisher", ""),
    }
    return {key: value for key, value in out.items() if value not in ("", None)}


def lookup(doi: str, refresh: bool = False) -> Dict[str, Any]:
    return summarize(fetch_raw(doi, refresh=refresh))
