"""Species cancer mortality from the paper's data.csv. No invented regressions."""

from __future__ import annotations

import csv
from functools import lru_cache
from pathlib import Path

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Abstract. Kept out of the personal report.
N_INDIVIDUALS = 110148
N_NECROPSY = 11840
N_SPECIES = 191

ROOT = Path(__file__).resolve().parents[1] / "references"

ALIASES = {
    "kowari": "Dasyuroides_byrnei",
    "blackbuck": "Antilope_cervicapra",
    "patagonian mara": "Dolichotis_patagonum",
}

DIET = (
    ("Mammal", "哺乳动物猎物"),
    ("Bird", "鸟类猎物"),
    ("Herptile", "爬行类猎物"),
    ("Fish", "鱼类猎物"),
    ("Vertebrate", "脊椎动物猎物"),
    ("Invertebrate", "无脊椎动物猎物"),
    ("Animal", "动物性食物"),
)


@lru_cache(maxsize=1)
def species_rows():
    rows = {}
    with (ROOT / "species_cmr.csv").open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            rows[row["Species"]] = row
    return rows


@lru_cache(maxsize=1)
def sex_rows():
    rows = {}
    with (ROOT / "sex_cmr.csv").open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            rows[row["Species"]] = row
    return rows


def canonical_species(text):
    if text is None:
        return None
    token = " ".join(text.strip().casefold().replace("_", " ").split())
    if token in ALIASES:
        return ALIASES[token]
    for name in species_rows():
        if name.casefold().replace("_", " ") == token:
            return name
    return None
