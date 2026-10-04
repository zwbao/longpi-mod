"""Numbers from the semaglutide epigenetic-age trial, Nature Communications 2026.

doi:10.1038/s41467-026-72861-3. Full text extracted from the PDF.
Group coefficients are not personal weights.
"""

from __future__ import annotations

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

WEEKS = 32
N_SEMAGLUTIDE = 45
N_PLACEBO = 39
MIN_AGE = 18
NCT = "NCT04019197"
# Abstract. Only PhenoAge restates years/year. DunedinPACE restates units.
GROUP_EFFECTS = {
    "PhenoAge": {"estimate": -4.9, "unit": "years/year", "p": 0.004},
    "PCGrimAge": {"estimate": -3.1, "unit": None, "p": 0.007},
    "GrimAgeV2": {"estimate": -2.3, "unit": None, "p": 0.009},
    "OMICmAge": {"estimate": -2.2, "unit": None, "p": 0.009},
    "RetroAge": {"estimate": -2.2, "unit": None, "p": 0.030},
    "DunedinPACE": {"estimate": -0.09, "unit": "units", "p": 0.01, "extra": "9% slower"},
}
WEIGHTS_PRESENT = False


def week32_delta(baseline: float, week32: float) -> float:
    return week32 - baseline
