from __future__ import annotations

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Fig. 4. eFRS = intercept + sum(coefficient * methylation beta).
# Methods call these explanatory variables methylation beta values.
EFRS = (
    ("intercept", 0.204),
    ("cg00921350", -0.209),
    ("cg01234420", -0.100),
    ("cg02867102", -0.016),
    ("cg03725309", -0.293),
    ("cg04955914", -0.146),
    ("cg07312601", -0.084),
    ("cg07349348", 0.158),
    ("cg08463758", 0.137),
    ("cg10408430", 0.248),
    ("cg11700584", -0.101),
    ("cg12510708", -0.049),
    ("cg13570972", 0.064),
    ("cg15058210", -0.057),
    ("cg15380836", -0.180),
    ("cg17860366", -0.144),
    ("cg17971578", 0.315),
    ("cg18791730", -0.075),
    ("cg19267254", -0.176),
    ("cg21656937", -0.025),
    ("cg23458887", -0.077),
)
# Methods. Frailty index cuts, not eFRS cuts.
# non-frail if FI ≤ 0.100; pre-frail if 0.100 < FI < 0.250; frail if FI ≥ 0.250.
FI_NONFRAIL_MAX = 0.100
FI_FRAIL_MIN = 0.250
# Methods. Number of deficits in each cohort's frailty index. The item lists are in the supplements.
ESTHER_DEFICITS = 31
KORA_DEFICITS = 33
# Fig. 4 sample sizes.
SUBSET_I = 998
SUBSET_II = 730
SUBSET_III = 538
KORA_N = 1010
EWAS_CPGS = 422524
DISCOVERY_FDR = 2220
VALIDATED_CPGS = 65
# Results, KORA-age baseline, quartile 3 and 4 versus quartile 1. Not personal cutpoints.
KORA_Q3_OR = 1.99
KORA_Q4_OR = 2.77


def efrs(betas: dict[str, float]) -> float | None:
    for site, _coef in EFRS:
        if site == "intercept":
            continue
        if site not in betas:
            return None
        if betas[site] < 0 or betas[site] > 1:
            return None
    total = 0.0
    for site, coef in EFRS:
        if site == "intercept":
            total += coef
        else:
            total += coef * betas[site]
    return total


def frailty_proportion(present: int, total: int) -> float | None:
    # Methods: FI is the proportion of presented deficits.
    if present < 0 or present > total or total <= 0:
        return None
    return present / total


def frailty_band(fi: float) -> str:
    if fi <= FI_NONFRAIL_MAX:
        return "非衰弱"
    if fi < FI_FRAIL_MIN:
        return "衰弱前期"
    return "衰弱"
