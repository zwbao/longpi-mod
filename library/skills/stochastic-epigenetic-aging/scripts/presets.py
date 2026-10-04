"""Stochastic-fraction numbers from Tong et al., Nature Aging 2024.

personal_report.py reads these constants. Sigma is recorded and not applied.
"""

from __future__ import annotations

BOUNDARY = (
    "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。"
    "名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"
)

DOI = "10.1038/s43587-024-00600-8"
# Methods: pc = 1 - exp(-γ |EffSize|). γ controls the global switch probability.
GAMMA = 9.25
SIGMA = 0.0005
SAMPLES = 22770
COHORTS = 25
HORVATH_CPGS = 353
ZHANG_CPGS = 514
PHENOAGE_CPGS = 513
MESA_MONOCYTES = 1202
YOUNG_N = 43
OLD_N = 11
SIM_N = 195
SIM_AGES = 39
AGE_SPAN = (45, 83)

# Published RR2 summaries. Horvath has two cohort groupings in Figure 3.
FRACTIONS = {
    "Horvath": {"text": "66–75%", "rr2": ((0.75, 0.10), (0.66, 0.11))},
    "Zhang": {"text": "90%", "rr2": ((0.90, 0.08),)},
    "PhenoAge": {"text": "63%", "rr2": ()},
}

ALIASES = {
    "horvath": "Horvath",
    "zhang": "Zhang",
    "phenoage": "PhenoAge",
}
