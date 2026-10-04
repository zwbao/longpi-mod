"""Juricic, Lu, Leech et al., Nature Aging 2022, doi:10.1038/s43587-022-00278-w.

Fly food concentration is the Methods sentence. Mouse food concentrations are the two husbandry regimens. Fig. 1 caption states N = 400 flies per condition. Supplementary Table 1 gives a cohort Cox risk ratio for chronic rapamycin versus control; that is not a personal weight.
"""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

FLY_FOOD_UM = 200
MOUSE_EARLY_PPM = 14
MOUSE_LATE_PPM = 42
FLY_N = 400
COHORT_RISK_RATIO = 0.4309059

ALIASES = {
    "雷帕霉素": ["雷帕霉素", "rapamycin", "sirolimus", "西罗莫司"],
}
