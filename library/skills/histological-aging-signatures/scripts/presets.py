"""Numbers from the histological tissue-clock paper, Nature Medicine 2026.

doi:10.1038/s41591-026-04566-5. Full text extracted from the PDF.
Fitted slide-model weights are on Zenodo, not in the cloned source tree.
"""

from __future__ import annotations

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

N_SLIDES = 25712
N_TISSUES = 40
N_PEOPLE = 983
# prose after Fig. 1d
MAE_YEARS = 4.88
R2 = 0.69
N_UNDERPOWERED = 4
UNDERPOWERED_BELOW = 100
N_TELOMERE = 6197
TELOMERE_FRACTION = 0.252
WEIGHTS_PRESENT = False


def age_gap(predicted: float, chronological: float) -> float:
    return predicted - chronological
