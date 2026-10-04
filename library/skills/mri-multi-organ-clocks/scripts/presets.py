"""MRI multi-organ clocks, doi:10.1038/s41591-025-03999-8. PMC12823390. Fig. 1 and Fig. 2."""

from __future__ import annotations

BOUNDARY = '这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。'

CONSORTIUM_N = 313645
HOLDOUT_N = 500
PROTEINS = 2923
METABOLITES = 327
VARIANTS = 6477810
GWAS_PAIRS = 53
R_LOW = 0.23
R_HIGH = 0.77
MAE_YEARS_ABOUT = 5
PROWAS_HITS = 603
PROWAS_KIDNEY = 301
PROWAS_P = 0.05 / 2923 / 7
METWAS_HITS = 758
WEIGHTS_PRESENT = False

IDP_COUNTS = {
    "brain": 119,
    "heart": 80,
    "adipose": 16,
    "liver": 4,
    "kidney": 3,
    "spleen": 3,
    "pancreas": 3,
}

METWAS_HITS_BY_ORGAN = {
    "spleen": 199,
    "adipose": 196,
    "heart": 139,
    "brain": 97,
    "pancreas": 57,
    "liver": 51,
    "kidney": 19,
}

ORGANS = {
    "brain": "脑",
    "heart": "心脏",
    "liver": "肝",
    "adipose": "脂肪",
    "spleen": "脾",
    "kidney": "肾",
    "pancreas": "胰腺",
}
