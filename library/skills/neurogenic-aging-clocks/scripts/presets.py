"""Cross-cohort clock performance from Buckley, Sun et al., Nature Aging 2023.

personal_report.py reads these constants. Glmnet coefficients are not here.
"""

from __future__ import annotations

BOUNDARY = (
    "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。"
    "名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"
)

DOI = "10.1038/s43587-022-00335-4"
MICE_N = 28
AGE_MIN_MONTHS = 3
AGE_MAX_MONTHS = 29
N_AGES = 26
CELLS_PER_PSEUDO = 15
ENSEMBLE_REPEATS = 20
R_MIN = 0.71
R_MAX = 0.92
ERROR_MIN = 1.6
ERROR_MAX = 5.4

# Bootstrap cross-cohort numbers printed in the main text. Others are only the range.
CELL_TYPES = (
    "oligodendrocyte",
    "microglia",
    "endothelial",
    "astrocyte-qNSC",
    "aNSC-NPC",
    "neuroblast",
)
BOOTSTRAP = {
    "oligodendrocyte": (0.91, 1.6),
    "microglia": (0.92, 2.1),
}

# Heterochronic parabiosis, aNSC-NPC, months of rejuvenation. Figure 4.
PARABIOSIS = {
    "cells": 25595,
    "mice": 22,
    "cohorts": 2,
    "chrono": (5.38, 3.66, 4.52),
    "bio": (3.57, 1.44, 2.51),
    "p_cohort2_chrono": 0.019,
    "age_gap": (21.0, 15.5),
}
EXERCISE_YOUNG_MONTHS = 4.5
EXERCISE_OLD_MONTHS = 21.5
EXERCISE_WEEKS = 5

ALIASES = {
    "oligodendrocyte": "oligodendrocyte",
    "oligo": "oligodendrocyte",
    "少突胶质": "oligodendrocyte",
    "microglia": "microglia",
    "小胶质": "microglia",
    "endothelial": "endothelial",
    "内皮": "endothelial",
    "astrocyte-qnsc": "astrocyte-qNSC",
    "astrocyte": "astrocyte-qNSC",
    "星形胶质": "astrocyte-qNSC",
    "ansc-npc": "aNSC-NPC",
    "ansc": "aNSC-NPC",
    "neuroblast": "neuroblast",
    "神经母细胞": "neuroblast",
}
