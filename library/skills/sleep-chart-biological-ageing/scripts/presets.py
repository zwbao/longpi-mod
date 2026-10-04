"""Numbers from the sleep-chart author manuscript, Nature 2026.

doi:10.1038/s41586-026-10524-5. Full text from PMC OAI record PMC13321099.
No method repository is listed.
"""

from __future__ import annotations

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Results: short (<6 h), long (>8 h), normal ([6, 8] h)
SHORT_BELOW = 6.0
LONG_ABOVE = 8.0
N_BAGS = 23
BAG_P_THRESHOLD = 0.05 / 23
N_SIGNIFICANT_NONLINEAR = 9
# brain ProtBAG sample minimum of the smoothed curve, not the bin edge
BRAIN_MIN_HOURS_FEMALE = 7.82
BRAIN_MIN_HOURS_MALE = 7.70
BRAIN_EDF = 3.61
SAMPLE_MIN_FEMALE = (6.5, 7.8)
SAMPLE_MIN_MALE = (6.4, 7.7)
# Fig. 3b all-cause mortality
MORTALITY_SHORT_HR = 1.50
MORTALITY_SHORT_CI = (1.44, 1.55)
MORTALITY_LONG_HR = 1.40
MORTALITY_LONG_CI = (1.36, 1.44)
WEIGHTS_PRESENT = False


def sleep_bin(hours: float) -> str:
    if hours < SHORT_BELOW:
        return "短"
    if hours > LONG_ABOVE:
        return "长"
    return "正常"
