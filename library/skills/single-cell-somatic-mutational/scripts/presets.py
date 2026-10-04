"""Ren et al., Nature Aging 2025, doi:10.1038/s43587-025-01011-z.

Full text read from the local PDF. Rates are the LME slopes in the results (Fig. 1). The burden formula is the Methods equation. Inclusion cutoffs are sensitivity >= 20% and coverage >= 15%.
"""

from __future__ import annotations

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

N_CELLS = 100
N_DONORS = 17
N_OA = 9
N_NON_OA = 8
AGE_MIN = 26
AGE_MAX = 90
SNV_CALLED = 42442
INDEL_CALLED = 1763
MEAN_SNV_BURDEN = 2296
MEAN_INDEL_BURDEN = 276
# Methods: minimum depth.
SNV_DEPTH = 20
INDEL_DEPTH = 30
# Methods: qualified samples.
MIN_SENSITIVITY = 0.20
MIN_COVERAGE = 0.15
# Cohort calling sensitivity, mean ± sd.
SNV_SENSITIVITY_MEAN = 0.55
SNV_SENSITIVITY_SD = 0.10
INDEL_SENSITIVITY_MEAN = 0.29
INDEL_SENSITIVITY_SD = 0.05
# All cells, Fig. 1b,c.
ALL_SNV_PER_YEAR = 33
ALL_SNV_P = 0.0001
ALL_INDEL_PER_YEAR = 5
ALL_INDEL_P = 0.0078
# Separate LMEs.
NON_OA_SNV = 56
NON_OA_SNV_P = 0.00418
NON_OA_INDEL = 10
NON_OA_INDEL_P = 0.0361
OA_NONLESION_SNV = 26
OA_NONLESION_SNV_P = 0.0407
OA_NONLESION_INDEL = 2
OA_NONLESION_INDEL_P = 0.1170
OA_LESION_SNV = 19
OA_LESION_SNV_P = 0.0424
OA_LESION_INDEL = 2
OA_LESION_INDEL_P = 0.0121
INTERACTION_SNV_P = 0.0139
INTERACTION_INDEL_P = 0.0413
WEIGHTS_PRESENT = False
ALIASES = {}
