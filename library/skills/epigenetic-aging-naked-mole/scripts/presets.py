BOUNDARY = (
    "这是研究复现意义上的个人读出，不是治疗建议。"
    "26 个位点到齐时，甲基化年龄按 Supplementary Data 4 的权重计算。"
    "缺位点不填补，不算甲基化年龄。"
    "不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"
)

# Fig. 4. Maximum lifespan used to scale age. Years.
MAX_LIFESPAN = {"nmr": 31.0, "mouse": 4.0, "human": 122.5}
# Fig. 4a-c. Where decreasing and increasing clock sites cross. Cohort observation.
CROSSOVER_YEARS = {"nmr": 11.87, "mouse": 1.66, "human": 70.69}
CROSSOVER_RELATIVE = {"nmr": 0.383, "mouse": 0.414, "human": 0.577}
# Results. Linear clock. Weights of the other 25 sites are in Supplementary Data 4.
CLOCK_INTERCEPT_YEARS = 3.133
N_CLOCK_SITES = 26
CARTPT_WEIGHT = 0.02
N_BLOOD_SAMPLES = 107
N_COMMON_CPGS = 3089098
N_AGE_CORRELATED = 279990
N_BONFERRONI = 758
# Fig. 2b caption says 5-fold. Methods says 10-fold python-glmnet. Kept separate.
CV_FOLDS_METHODS = 10
CV_FOLDS_FIG2B = 5
GLMNET_ALPHA = 0.5
# Results, training correlation of the clock with age.
CLOCK_AGE_R = 0.85
# Fig. 2d.
MOST_NEGATIVE_R = -0.7
MOST_POSITIVE_R = 0.73
# Results. Twelve genes kept. Cartpt omitted in the paper.
CLOCK_GENES = (
    "Tert",
    "Neurl1b",
    "Mab21l2",
    "LOC110349245",
    "Lrba",
    "Cacna1e",
    "Shank1",
    "Bahd1",
    "Prpf19",
    "Pcdh7",
    "Naa30",
    "LOC110346999",
)


def relative_age(age_years: float, species: str) -> float:
    return age_years / MAX_LIFESPAN[species]
