"""Assay formulas from Xiang et al., Nature Aging 2025.

Mouse doses stay here and are not copied into the personal report.
"""

DOI = "10.1038/s43587-025-00907-0"
TITLE = "衰老巨噬细胞与肌萎缩"
FULL_TEXT_READ = True
# Human OA muscle cohort named in the results. Kept out of the report.
OA_PATIENT_N = 15
# Fig. 8 scheme. Mouse experiment, not a personal dose.
MOUSE_COQ10_UG_PER_G = 10
BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

COMPOUNDS = (
    ("辅酶Q10", ("辅酶q10", "coq10", "coenzyme q10", "ubiquinone", "ubiquinol")),
    ("达沙替尼", ("dasatinib",)),
    ("槲皮素", ("quercetin",)),
    ("liproxstatin-1", ("liproxstatin", "lip-1")),
    ("L-天冬酰胺", ("天冬酰胺", "asparagine", "l-asparagine")),
    ("MHY1485", ("mhy1485",)),
)
