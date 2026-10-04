"""Rules from Ding et al., Nature Medicine 2026, and the cellage apply script.

doi:10.1038/s41591-026-04446-y. Full text extracted from the PDF.
Coefficients are the SomaScan table shipped in dingdaisy/cellage.
"""

from __future__ import annotations

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Apply Models instructions and demo_apply_cell_clock.R / cell_type_age_gap.R
SEX_FEMALE = 1
SEX_MALE = 0
MIN_PROTEIN_FEATURES = 4
TRAIN_R_MIN = 0.25
TEST_R_MIN = 0.15
LOWESS_F = 2 / 3
MIN_HEALTHY_CONTROLS = 5
WEIGHTS_PRESENT = True
