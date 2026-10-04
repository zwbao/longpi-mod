"""Paper card at the top of every personal report.

Canonical copy: tools/skillkit/paper_card.py. Each skill vendors it as
scripts/paper_card.py; CI fails when a copy drifts. The card is rendered from
the paper block of ../skill.json, so the registry, catalog.json and every
report cite the same title, journal, year, DOI and summary.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

_MANIFEST = Path(__file__).resolve().parent.parent / "skill.json"


def paper() -> Dict[str, Any]:
    return json.loads(_MANIFEST.read_text(encoding="utf-8")).get("paper", {})


def _cite(info: Dict[str, Any]) -> str:
    head = "。".join(part for part in (info.get("authors", ""), info.get("journal", "")) if part)
    if info.get("year"):
        head = f"{head}，{info['year']}" if head else str(info["year"])
    if info.get("doi"):
        head = f"{head}。doi:{info['doi']}" if head else f"doi:{info['doi']}"
    elif info.get("source_id"):
        head = f"{head}。{info['source_id']}" if head else info["source_id"]
    return f"{head}。" if head else ""


def lines() -> List[str]:
    info = paper()
    title_zh = info.get("title_zh", "")
    title = info.get("title", "")
    out = ["## 论文卡片", "", f"**{title_zh or title}**", ""]
    if title and title != title_zh:
        out += [f"原题：{title}", ""]
    cite = _cite(info)
    if cite:
        out += [cite, ""]
    links = []
    if info.get("article_url"):
        links.append(f"[文章]({info['article_url']})")
    if info.get("doi"):
        links.append(f"[DOI](https://doi.org/{info['doi']})")
    for item in info.get("supplements", []):
        links.append(f"[{item.get('label') or '补充材料'}]({item['url']})")
    if info.get("code_url"):
        links.append(f"[代码]({info['code_url']})")
    if links:
        out += [" · ".join(links), ""]
    for note in info.get("card_notes", []):
        out += [note, ""]
    out.append(info.get("summary_zh", ""))
    return out


TITLE = paper().get("title_zh", "") if _MANIFEST.exists() else ""
DOI_URL = f"https://doi.org/{paper()['doi']}" if _MANIFEST.exists() and paper().get("doi") else ""
SUMMARY = paper().get("summary_zh", "") if _MANIFEST.exists() else ""
