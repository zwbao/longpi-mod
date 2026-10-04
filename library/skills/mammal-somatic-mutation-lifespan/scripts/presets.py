"""Published rates from Cagan et al., Nature 2022. Slope k is Fig. 3c."""

from __future__ import annotations

import csv
from functools import lru_cache
from pathlib import Path

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Fig. 3c. Zero-intercept LME slope. Substitutions per genome, not indels.
ELB_K = 3206.4
# Table 1. Kept out of the personal report.
N_CRYPTS = 208
N_INDIVIDUALS = 56
N_SPECIES = 16
ELB_MIN = 1828.08
ELB_MAX = 5378.73

TABLE = Path(__file__).resolve().parents[1] / "references" / "species_rates.csv"

ALIASES = {
    "human": "Human",
    "homo sapiens": "Human",
    "人": "Human",
    "mouse": "Mouse",
    "小鼠": "Mouse",
    "naked mole-rat": "Naked mole-rat",
    "naked mole rat": "Naked mole-rat",
    "裸鼹鼠": "Naked mole-rat",
    "giraffe": "Giraffe",
    "长颈鹿": "Giraffe",
    "rat": "Rat",
    "大鼠": "Rat",
    "cow": "Cow",
    "牛": "Cow",
    "dog": "Dog",
    "狗": "Dog",
    "cat": "Cat",
    "猫": "Cat",
    "horse": "Horse",
    "马": "Horse",
    "rabbit": "Rabbit",
    "兔": "Rabbit",
    "ferret": "Ferret",
    "lion": "Lion",
    "tiger": "Tiger",
    "ring-tailed lemur": "Ring-tailed lemur",
    "black-and-white colobus": "Black-and-white colobus",
    "harbour porpoise": "Harbour porpoise",
    "harbor porpoise": "Harbour porpoise",
}


@lru_cache(maxsize=1)
def species_table():
    rows = {}
    with TABLE.open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            rows[row["species"]] = {
                "rate": float(row["mean_substitutions_per_year"]),
                "lifespan_80": float(row["lifespan_80_years"]),
            }
    return rows


def canonical_species(text):
    if text is None:
        return None
    token = " ".join(text.strip().casefold().replace("_", " ").split())
    if token in ALIASES:
        return ALIASES[token]
    for name in species_table():
        if name.casefold() == token:
            return name
    return None
