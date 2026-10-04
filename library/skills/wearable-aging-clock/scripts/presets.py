"""Numbers from Miller et al. area, Nature Communications 2025, wearable PpgAge.

doi:10.1038/s41467-025-64275-4. Full text extracted from the PDF.
AHMS ridge weights are not in the cloned repository.
"""

from __future__ import annotations

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

HEALTHY_N = 6728
TRAIN_N = 5355
TRAIN_FRACTION_PAPER = 0.80
TEST_HEALTHY_N = 1373
GENERAL_N = 120235
EMBEDDING_DIM = 256
MIN_SEGMENTS = 30
# Fig. 3 caption: analysis restricted to chronological age between 18 and 85
AGE_MIN = 18
AGE_MAX = 85
# run_fit_age_model.py uses 18 to 90 and frac_train 0.75 on synthetic ages
CODE_AGE_MAX = 90
CODE_TRAIN_FRACTION = 0.75
# opening results sentence
MAE_POOLED = 2.43
MAE_POOLED_CI = (2.33, 2.53)
# Fig. 3, healthy test
MAE_HEALTHY_MALE = 2.42
MAE_HEALTHY_MALE_CI = (2.30, 2.54)
MAE_HEALTHY_MALE_N = 1115
MAE_HEALTHY_FEMALE = 2.45
MAE_HEALTHY_FEMALE_CI = (2.22, 2.71)
MAE_HEALTHY_FEMALE_N = 258
MAE_GENERAL_MALE = 3.13
MAE_GENERAL_MALE_CI = (3.11, 3.15)
MAE_GENERAL_MALE_N = 77501
MAE_GENERAL_FEMALE = 3.26
MAE_GENERAL_FEMALE_CI = (3.24, 3.29)
MAE_GENERAL_FEMALE_N = 42734
WEIGHTS_PRESENT = False


def ppg_gap(ppg_age: float, chronological_age: float) -> float:
    return ppg_age - chronological_age
