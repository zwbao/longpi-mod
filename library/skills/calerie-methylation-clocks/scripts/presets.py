"""ITT effects from Waziry et al., Nature Aging 2023.

personal_report.py reads these constants.
"""

from __future__ import annotations

BOUNDARY = (
    "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。"
    "名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"
)

DOI = "10.1038/s43587-022-00357-y"
RANDOMIZED_N = 220
CR_N = 145
AL_N = 75
DNAM_N = 197
DNAM_CR = 128
DNAM_AL = 69
MEAN_AGE = 38
AGE_SD = 7
WOMEN_FRACTION = 0.70
PRESCRIBED_CR = 0.25
ACHIEVED_CR_MEAN = 11.9
ACHIEVED_CR_SEM = 0.7
P_THRESHOLD = 0.005
PACE_REDUCTION = "2–3%"

# Cohen's d for CR versus ad libitum. (d, ci_low, ci_high, p_text)
CLOCKS = {
    "DunedinPACE": {
        "display": "DunedinPACE",
        "m12": (-0.29, -0.45, -0.13, "<0.003"),
        "m24": (-0.25, -0.41, -0.09, "<0.003"),
    },
    "PCPhenoAge": {
        "display": "PC PhenoAge",
        "m12": (-0.03, -0.19, 0.12, ">0.50"),
        "m24": (0.05, -0.11, 0.20, ">0.50"),
    },
    "PCGrimAge": {
        "display": "PC GrimAge",
        "m12": (-0.04, -0.16, 0.07, ">0.40"),
        "m24": (0.05, -0.07, 0.17, ">0.40"),
    },
}

# DunedinPACE dose split and instrumental-variable 20% CR. Not applied to a person.
DOSE = {
    "gt10_m12": -0.33,
    "gt10_m24": -0.33,
    "lt10_m12": -0.19,
    "lt10_m24": -0.14,
    "iv20_m12": (-0.43, -0.67, -0.19),
    "iv20_m24": (-0.40, -0.67, -0.12),
}

ALIASES = {
    "dunedinpace": "DunedinPACE",
    "dunedin pace": "DunedinPACE",
    "pace": "DunedinPACE",
    "pcphenoage": "PCPhenoAge",
    "phenoage": "PCPhenoAge",
    "pc phenoage": "PCPhenoAge",
    "pcgrimage": "PCGrimAge",
    "grimage": "PCGrimAge",
    "pc grimage": "PCGrimAge",
}
