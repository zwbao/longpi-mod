"""Laterality index and cohort counts from Korbmacher et al., Nature Communications 2024.

Methods, “Hemispheric differences and age sensitivity”, equation (1):
LI = (L - R) / (L + R), where L and R are any left and right scalar metric.
The paper uses the absolute value only when associating that index with age.
XGBoost brain-age weights are not in the paper text and are not stored here.
"""

from __future__ import annotations

BOUNDARY = (
    "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。"
    "名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"
)

DOI = "10.1038/s41467-024-45282-3"
# Equation (1): LI = (L - R) / (L + R).
LATERALITY_DEFINITION = "LI = (L - R) / (L + R)"


def laterality_index(left: float, right: float) -> float | None:
    """Equation (1). Undefined when the two sides sum to zero."""
    total = left + right
    if total == 0:
        return None
    return (left - right) / total
N_T1 = 48040
N_DMRI = 39637
N_MULTIMODAL = 39507
AGE_MEAN_T1 = 64.86
AGE_SD_T1 = 7.77
CORR_N = 35665
LIHBA_R_MULTIMODAL = -0.123
DMRI_ASYM = (793, 840)
T1_ASYM = (115, 117)
FA_ILF_D = 3.64
CINGULUM_D = 1.95
TRANSVERSE_TEMPORAL_D = 1.81
