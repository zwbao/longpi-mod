"""Regan, Lu et al., Nature Aging 2022, doi:10.1038/s43587-022-00308-7.

Fly concentrations are the lifespan-assay sentence. The mouse sentence says 42 mg kg−1 body weight. Supplementary Table 1 Cox block uses a decimal comma; the rapamycin coefficient is −0.531 and the cohort dead count is 612.
"""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

FLY_DOSES_UM = (50, 200, 400)
MOUSE_MG_PER_KG = 42
RU486_UM = 100
DEAD_N = 612
COX_RAPAMYCIN = -0.531

ALIASES = {
    "雷帕霉素": ["雷帕霉素", "rapamycin", "sirolimus", "西罗莫司"],
}
