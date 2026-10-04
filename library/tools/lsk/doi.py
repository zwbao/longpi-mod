"""DOI normalization. The registry and every dedup check use normalize_doi."""

from __future__ import annotations

import re
import unicodedata
from typing import Optional

_PREFIXES = (
    "https://doi.org/",
    "http://doi.org/",
    "https://dx.doi.org/",
    "http://dx.doi.org/",
    "doi.org/",
    "dx.doi.org/",
    "doi:",
    "doi ",
)
_TRAILING = ".,;:'\"`>]}"
DOI_RE = re.compile(r"^10\.\d{4,9}/\S+$")
_DOI_BODY = re.compile(r"10\.\d{4,9}/[\x21-\x7e]+")
SOURCE_ID_RE = re.compile(r"^[a-z]+:[A-Za-z0-9._/-]+$")


def normalize_doi(raw: Optional[str]) -> str:
    """Lower-case DOI without URL or ``doi:`` prefix and without trailing punctuation.

    A DOI is printable ASCII, so anything after it (Chinese text, spaces) is cut.

    >>> normalize_doi(" DOI: 10.1038/S41467-026-68399-Z。")
    '10.1038/s41467-026-68399-z'
    >>> normalize_doi("10.1016/j.immuni.2026.02.007。全文已读。")
    '10.1016/j.immuni.2026.02.007'
    >>> normalize_doi("https://doi.org/10.1016/S0140-6736(20)30183-5).")
    '10.1016/s0140-6736(20)30183-5'
    """
    if raw is None:
        return ""
    text = unicodedata.normalize("NFKC", str(raw)).strip()
    lowered = text.lower()
    changed = True
    while changed:
        changed = False
        for prefix in _PREFIXES:
            if lowered.startswith(prefix):
                text = text[len(prefix):].strip()
                lowered = text.lower()
                changed = True
    match = _DOI_BODY.search(text)
    if not match:
        return ""
    text = match.group(0)
    while text:
        if text[-1] in _TRAILING:
            text = text[:-1]
        elif text[-1] == ")" and text.count("(") < text.count(")"):
            text = text[:-1]
        else:
            break
    return text.lower()


def is_doi(text: str) -> bool:
    return bool(DOI_RE.match(text or ""))


def registry_key(doi: str = "", source_id: str = "") -> str:
    """The unique key of a paper: its normalized DOI, else a namespaced id."""
    normalized = normalize_doi(doi)
    if normalized:
        return normalized
    return (source_id or "").strip()
