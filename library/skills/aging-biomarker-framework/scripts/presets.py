"""Published benchmark numbers from Ying et al., Nature Aging 2025.

These are cohort hazard ratios and R² values, not CpG weights.
"""

from __future__ import annotations

BOUNDARY = (
    "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。"
    "名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"
)

DOI = "10.1038/s43587-025-00987-y"
N_BIOMARKERS = 39
AGE_MORTALITY_R = 0.12
AGE_MORTALITY_P = 0.67
HORVATH_SKIN_R2 = 0.88
GRIMAGE2_MORTALITY_HR = 2.57
GRIMAGE2_HEALTHSPAN_HR = 2.00
HEALTHSPAN_LIFE_R = 0.97
HEALTHSPAN_LIFE_P = 3.83e-4
NAS_N = 1488
NAS_DECEASED = 0.388
MGB_N = 500
MGB_DECEASED = 0.088
GS_N = 18859
GS_DECEASED = 0.080

# Cohort hazard ratios per standard deviation, where the main text states them.
CLOCKS = {
    "HorvathSkinBlood": "Horvath 皮肤和血液时钟的年龄 R² 是 0.88，正文把它写成最高。",
    "GrimAge2": "GS 死亡 HR 2.57，健康寿命 HR 2.00；NAS 死亡 HR 1.35；MGB 死亡 HR 2.08。",
    "GrimAge": "GS 死亡 HR 2.50；MGB 死亡 HR 1.84。这是 GrimAge 第一版。",
    "PhenoAge": "GS 死亡 HR 2.16；MGB 死亡 HR 2.03。",
    "DunedinPoAm38": "NAS 死亡 HR 1.36。",
    "DunedinPACE": "NAS 死亡 HR 1.35。",
}

# Paces of aging (biological years per calendar year, about 1), not ages.
# The report lists them but takes no age deviation from them.
PACE_CLOCKS = ("DunedinPoAm38", "DunedinPACE")

ALIASES = {
    "horvathskinblood": "HorvathSkinBlood",
    "horvath skin and blood": "HorvathSkinBlood",
    "horvathv2": "HorvathSkinBlood",
    "grimage2": "GrimAge2",
    "grimagev2": "GrimAge2",
    "grim age 2": "GrimAge2",
    "grimage": "GrimAge",
    "grimagev1": "GrimAge",
    "phenoage": "PhenoAge",
    "dunedinpoam38": "DunedinPoAm38",
    "dunedinpace": "DunedinPACE",
}
