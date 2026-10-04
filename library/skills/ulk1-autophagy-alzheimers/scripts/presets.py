"""Pan et al., Nature Aging 2026, doi:10.1038/s43587-026-01108-z.

Full text read from the local PDF. Declines are Fig. 1a,b. Compound concentrations are the cell-assay doses in the text around Fig. 7, not doses for a person.
"""

from __future__ import annotations

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

COGNORM_N = 75
NORCOG_N = 316
# Fig. 1a,b: percent lower at 4-year follow-up in cognitively unimpaired participants.
SERUM_PERCENT_LOWER = 41.35
CSF_PERCENT_LOWER = 19.18
FOLLOWUP_YEARS = 4
# Fig. 7 / Extended Data Fig. 10 assay concentrations.
RAC_BL918_UM_MIN = 0.5
RAC_BL918_UM_MAX = 5.0
RAC_BL918_MITOPHAGY_FOLD = 2.7
LYN1604_UM = 4.0
XST14_UM = 5.0
WEIGHTS_PRESENT = False
COMPOUNDS = [
    "Rac-BL-918",
    "LYN-1604",
    "SBI-0206965",
    "XST-14",
]
ALIASES = {
    "Rac-BL-918": ["Rac-BL-918", "BL-918", "BL918"],
    "LYN-1604": ["LYN-1604", "LYN1604", "LYN-1604 dihydrochloride"],
    "SBI-0206965": ["SBI-0206965", "SBI0206965"],
    "XST-14": ["XST-14", "XST14"],
}
