"""Cui et al., Nature Aging 2025. Group sizes from the figure legends. XGBoost grid from the method notebook, unused for scoring."""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

DONORS = 35
CELLS = 214369
GROUP_N = {"20": 3, "30": 4, "40": 10, "50": 8, "60": 10}
FIG6C_AGE = 45
FIG6D_AGE = 40
BMI_CUT = 30
MAX_DEPTH = 5
N_ESTIMATORS = 8000
LEARNING_RATES = (0.03, 0.05)
WEIGHTS_PRESENT = False
