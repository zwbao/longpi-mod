"""Magkouta et al., Nature Aging 2025, doi:10.1038/s43587-024-00747-4.

Selectivity index is LC50 divided by IC50, as the Fig. 3 legend states. Mouse amounts are per mouse in the in vivo paragraph. The first viability cell in Supplementary Note 3 is 130.8657 and is not a fitted IC50.
"""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

PALBOCICLIB_MG_PER_MOUSE = 2.5
MGL392_MG_PER_MOUSE = 0.015
DASATINIB_MG_PER_MOUSE = 0.125
QUERCETIN_MG_PER_MOUSE = 1.25
NOTE3_VIABILITY = "130.8657"

ALIASES = {
    "mGL392": ["mGL392", "mgl392"],
    "GL392": ["GL392", "gl392"],
    "GL9": ["GL9", "gl9", "苏丹黑", "sudan black", "sudanblack"],
    "达沙替尼": ["达沙替尼", "dasatinib", "sprycel"],
    "槲皮素": ["槲皮素", "quercetin"],
    "帕博西尼": ["帕博西尼", "palbociclib", "ibrance"],
}
