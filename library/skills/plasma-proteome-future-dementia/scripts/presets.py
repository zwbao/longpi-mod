"""Guo et al., Nature Aging 2024, doi:10.1038/s43587-023-00565-0.

Author manuscript from the Warwick repository. The protein risk score is a
LightGBM model. Its weights are not printed, so none are invented. The four
proteins below are the ones the paper says associate most consistently with
incident dementia. Cohort AUCs and the GFAP fold are not personal weights.
"""

from __future__ import annotations

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

FULL_TEXT_READ = True
N_ADULTS = 52645
N_INCIDENT = 1417
FOLLOWUP_YEARS = 14.1
N_PROTEINS = 1463
ACD_AUC = 0.891
AD_AUC = 0.872
VAD_AUC = 0.912
GFAP_FOLD = 2.32
WEIGHTS_PRESENT = False
PROTEINS = [
    ("GFAP", "胶质纤维酸性蛋白"),
    ("NEFL", "神经丝轻链"),
    ("GDF15", "生长分化因子 15"),
    ("LTBP2", "潜在转化生长因子结合蛋白 2"),
]
ALIASES = {
    "胶质纤维酸性蛋白": ["GFAP", "胶质纤维酸性蛋白"],
    "神经丝轻链": ["NEFL", "NfL", "神经丝轻链"],
    "生长分化因子 15": ["GDF15", "生长分化因子 15"],
    "潜在转化生长因子结合蛋白 2": ["LTBP2", "潜在转化生长因子结合蛋白 2"],
}
