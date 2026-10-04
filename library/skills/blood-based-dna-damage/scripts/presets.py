"""Numbers from Sproviero et al., Nature Aging 2025, doi:10.1038/s43587-025-00926-x.

Full text read from the local PDF. Fig. 4 and the Methods state the DEG rule and the length medians. The repository leaves cutoffs i and k unset, so these cutoffs are the paper's, not a second set.
"""

from __future__ import annotations

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Methods and Fig. 1 caption: |log2FC| > 0.322 (1.25-fold) and P-adj < 0.05.
LOG2FC_ABS = 0.322
PADJ_MAX = 0.05
MIN_TOTAL_READS = 10

# Results, visit 1 and visit 8 cohort sizes.
VISIT1_PD = 484
VISIT1_HC = 187
VISIT8_PD = 268
VISIT8_HC = 157
PRODROMAL_KEPT = 53
PRODROMAL_ENROLLED = 58
COMMON_DEGS = 69
OVERLAP_ENRICHMENT = 26

# Fig. 4a iPD visit 1.
FIG4A_UP_N = 576
FIG4A_UP_MEDIAN_BP = 29753
FIG4A_DOWN_N = 455
FIG4A_DOWN_MEDIAN_BP = 19076
FIG4A_P = 0.0555

# Fig. 4b iPD visit 8.
FIG4B_UP_N = 1106
FIG4B_UP_MEDIAN_BP = 25706
FIG4B_DOWN_N = 229
FIG4B_DOWN_MEDIAN_BP = 40692
FIG4B_P = 0.0011

# Fig. 4c prodromal. The figure prints Wilcoxon P = 0.
FIG4C_UP_N = 17200
FIG4C_UP_MEDIAN_BP = 7537
FIG4C_DOWN_N = 5454
FIG4C_DOWN_MEDIAN_BP = 20772
FIG4C_P_PRINTED = 0

# Fig. 5a.
MILD_N = 112
SEVERE_N = 226
FIG5_HC_N = 152
DELTA_UPDRS_MILD_MAX = 1

# Extended Data Fig. 7.
GBA_V8_UP_MEDIAN_BP = 31529
GBA_V8_DOWN_MEDIAN_BP = 17384
LRRK2_V1_UP_MEDIAN_BP = 12216
LRRK2_V1_DOWN_MEDIAN_BP = 17417
LRRK2_V1_P = 0.2509

# Fig. 6d,e PBMC gamma-H2AX.
PBMC_PD_FOCI_MEAN = 1.487
PBMC_PD_FOCI_SD = 0.899
PBMC_HC_FOCI_MEAN = 0.595
PBMC_HC_FOCI_SD = 0.996

WEIGHTS_PRESENT = False
ALIASES = {}
