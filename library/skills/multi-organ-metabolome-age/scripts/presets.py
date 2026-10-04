"""Wen et al., Nature Communications 2025, doi:10.1038/s41467-025-59964-z. PMC12106725."""

from __future__ import annotations

BOUNDARY = '这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。'

UKB_N = 274247
METABOLITES = 107
CN_N = 34354
CN_REST_N = 29354
CN_TEST_N = 5000
PATIENT_N = 239893
R_LOW = 0.25
R_HIGH = 0.42
MAE_YEARS_ABOUT = 6
GWAS_PAIRS = 405
GWAS_P = 5e-8 / 5
H2_LOW = 0.09
H2_HIGH = 0.18
GC_IMMUNE_HEPATIC = 0.78
LDSC_INTERCEPT = 1.05
WEIGHTS_PRESENT = False

ORGANS = {
    "digestive": "消化",
    "hepatic": "肝",
    "immune": "免疫",
    "endocrine": "内分泌",
    "metabolic": "代谢",
}
