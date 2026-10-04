"""Zhang et al., Nature Communications 2026, doi:10.1038/s41467-026-70707-6.

Full text read from the local PDF. The difference is EWM-FDG minus AWM-FDG as defined in the results. Age correlations are the MCSA and ADNI figures in the text.
"""

from __future__ import annotations

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

N_PARTICIPANTS = 3142
N_VISITS = 15287
MCSA_N = 1989
MCSA_AGE_MEAN = 71.4
MCSA_AGE_SD = 10.1
ADNI_N = 1153
ADNI_AGE_MEAN = 72.8
ADNI_AGE_SD = 7.5
# Age correlations with FDG SUVR.
MCSA_EWM_R = -0.51
MCSA_EWM_P = 5.3e-132
ADNI_EWM_R = -0.34
MCSA_AWM_R = 0.39
ADNI_AWM_R = 0.12
WEIGHTS_PRESENT = False
REGIONS = ["预期白质", "非典型白质"]
ALIASES = {}
