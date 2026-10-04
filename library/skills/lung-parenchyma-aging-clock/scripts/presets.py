"""Numbers from the lung parenchyma clock, Nature Communications 2026.

doi:10.1038/s41467-026-75427-5. Full text extracted from the PDF.
The fitted XGBoost booster is not in TsankovLab/sc_Aging_clock.
"""

from __future__ import annotations

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

CNMF_PER_CELLTYPE = 30
N_CELLTYPES = 29
MIN_CELLS = 400
EXCLUDED_LOW_COUNT = (
    "Goblet",
    "Mesothelium",
    "pDCs",
    "HSCs",
    "Ionocytes",
    "PNECs",
    "Tuft",
    "Hillock-like",
)
MODULES_REMOVED = 150
N_FEATURES = 480
N_BULK = 578
N_SCRNA = 181
# bulk samples under 20 or over 79 were removed
BULK_AGE_MIN = 20
BULK_AGE_MAX = 79
N_FOLDS = 5
TRAIN_FRACTION = 0.80
SEEDS = (1, 10)
XGBOOST = "2.1.0"
WEIGHTS_PRESENT = False


def code_residual(chronological: float, predicted: float) -> float:
    """ML_utils_XGB.save_residuals_and_predictions uses y_test - predictions."""
    return chronological - predicted
