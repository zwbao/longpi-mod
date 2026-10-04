BOUNDARY = '这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。'
COHORT_N = 2276
MEDIAN_AGE = 63.4
MEDIAN_INTERVAL_DAYS = 286
DAYS_PER_YEAR = 365.25
# Interval, adjusted hazard ratio, and the FAR cutoff used for that interval.
# Short-interval n=908 is the Cox test set in Fig. 3, not the Fig. 2b distribution n=1362.
BINS = {
    "short": (10, 365, 1.25, 1.03, 1.51, 908),
    "mid": (366, 730, 1.37, 1.00, 1.86, 549),
    "long": (731, 1460, 1.65, 1.22, 2.22, 365),
}
CUTOFF = {"short": 20, "mid": 10, "long": 1}


def far_value(face1: float, face2: float, days: float) -> float:
    return (face2 - face1) / (days / DAYS_PER_YEAR)


def interval_bin(days: float):
    for name, (low, high, point, ci_low, ci_high, n) in BINS.items():
        if low <= days <= high:
            return name, point, ci_low, ci_high, n
    return None
