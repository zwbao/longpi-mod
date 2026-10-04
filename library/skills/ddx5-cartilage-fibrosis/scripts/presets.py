"""Liu et al., Nature Aging 2024, doi:10.1038/s43587-024-00624-0.

Splicing cutoffs are the two rules printed in the article, not a refit.
"""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Results: 117 DASEs in OA cartilage, delta PSI > 20% and FDR < 0.0001.
PSI_MIN = 0.20
FDR_CARTILAGE = 0.0001
# Results: 116 DASEs in ATDC5 knockdown, delta PSI > 20% and FDR < 1e-8.
FDR_CELL = 1e-8
# Results: proteins with a 1.2-fold change and FDR < 0.05.
PROTEIN_FOLD = 1.2
PROTEIN_FDR = 0.05
# Proteomics count in the article. Not printed in the personal report.
COHORT_PROTEINS = 7279

NAMED = (
    "DDX5",
    "COL1",
    "COL1A1",
    "COL1A2",
    "COL2",
    "COL2A1",
    "COL3A1",
    "ACTA2",
    "MMP13",
    "NOS2",
    "ADAMTS4",
    "ADAMTS5",
    "SOD3",
    "FN1",
    "PLOD2",
    "TGFBR1",
    "DDX17",
)
