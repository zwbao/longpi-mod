"""Clock weights from Supplementary Table 20. Transformations from Supplementary Note 1."""

from __future__ import annotations

import csv
from functools import lru_cache
from pathlib import Path

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Methods. Relative age = age / max lifespan.
MAX_LIFESPAN = {"nmr": 37.0, "human": 122.5}
# Supplementary Note 1 R snippet fixes maturity at 5 years for the inverse.
MATURITY_YEARS = 5.0
OFFSET_K = 1.5
# Results. Kept out of the personal report.
N_SAMPLES = 385

TABLE = Path(__file__).resolve().parents[1] / "references" / "table_s20.csv"

CLOCKS = {
    "pan1": ("pan1", "Coef.NMR.PanTissueVersion1", "identity", "全组织时钟"),
    "pan2": ("pan2", "Coef.NMR.PanTissueVersion2", "identity", "含诱导多能细胞的全组织时钟"),
    "blood": ("blood", "Coef.NMR.Blood", "identity", "血液时钟"),
    "skin": ("skin", "Coef.NMR.Skin", "identity", "皮肤时钟"),
    "liver": ("liver", "Coef.NMR.Liver", "identity", "肝时钟"),
    "kidney": ("kidney", "Coef.NMR.Kidney", "identity", "肾时钟"),
    "loglin": ("loglin", "Coef.HumanNMR.AgeLogLinear", "loglin", "人与裸鼹鼠对数线性时钟"),
    "relative": ("relative", "Coef.HumanNMR.RelativeAge", "relative", "人与裸鼹鼠相对年龄时钟"),
}

TISSUE_ALIASES = {
    "pan": "pan1",
    "pantissue": "pan1",
    "全组织": "pan1",
    "pan1": "pan1",
    "pan2": "pan2",
    "blood": "blood",
    "血液": "blood",
    "skin": "skin",
    "皮肤": "skin",
    "liver": "liver",
    "肝": "liver",
    "肝脏": "liver",
    "kidney": "kidney",
    "肾": "kidney",
    "肾脏": "kidney",
    "loglin": "loglin",
    "humannmr": "loglin",
    "relative": "relative",
    "相对年龄时钟": "relative",
}

SPECIES_ALIASES = {
    "nmr": "nmr",
    "naked mole-rat": "nmr",
    "naked mole rat": "nmr",
    "裸鼹鼠": "nmr",
    "human": "human",
    "人": "human",
    "homo sapiens": "human",
}


@lru_cache(maxsize=1)
def models():
    loaded = {
        key: {"column": column, "transform": transform, "label": label, "intercept": None, "weights": {}}
        for key, (column, _paper, transform, label) in CLOCKS.items()
    }
    with TABLE.open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            probe = row["probe"]
            for key, (column, _paper, _transform, _label) in CLOCKS.items():
                raw = (row.get(column) or "").strip()
                if raw == "":
                    continue
                value = float(raw)
                if probe == "(Intercept)":
                    loaded[key]["intercept"] = value
                else:
                    loaded[key]["weights"][probe] = value
    return loaded


def canonical_tissue(text):
    if text is None:
        return None
    token = text.strip().casefold().replace(" ", "").replace("_", "").replace("-", "")
    return TISSUE_ALIASES.get(token)


def canonical_species(text):
    if text is None:
        return None
    token = " ".join(text.strip().casefold().replace("_", " ").split())
    return SPECIES_ALIASES.get(token)
