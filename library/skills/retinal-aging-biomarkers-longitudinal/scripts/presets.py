"""Retinal-age constants from the paper and from Zakiyi/RLDL run_inference.py.

The 2.79-year band is the healthy-cohort MAE. Outcome HRs are per 1 year in fully adjusted model 2.
"""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

MAE_YEARS = 2.79
PEARSON_CHN = 0.954
PEARSON_UKB = 0.885
AGE_OFFSET = 15
START_AGE = 0
END_AGE = 77
N_BINS = 77
UKB_B_N = 45436
HR_MORTALITY_1Y = 1.03
HR_MORTALITY_5Y = 1.16
HR_MORTALITY_10Y = 1.35

OUTCOMES = (
    ("白内障", "每增加 1 年的 HR 1.11（1.09–1.12）。Fig. 6 完全调整模型。"),
    ("青光眼", "每增加 1 年的 HR 1.09（1.06–1.11）。Fig. 6 完全调整模型。"),
    ("年龄相关性黄斑变性", "每增加 1 年的 HR 1.08（1.05–1.11）。Fig. 6 完全调整模型。"),
    ("癫痫", "每增加 1 年的 HR 1.06（1.01–1.10）。Fig. 6 完全调整模型。"),
    ("卒中", "每增加 1 年的 HR 1.04（1.01–1.06）。Fig. 6 完全调整模型。"),
    ("心衰", "每增加 1 年的 HR 1.03（1.01–1.06）。Fig. 6 完全调整模型。"),
    ("冠心病", "每增加 1 年的 HR 1.03（1.02–1.04）。Fig. 6 完全调整模型。"),
    ("全因死亡", "每增加 1 年的 HR 1.03（1.01–1.05）。UKB 队列 B 的完全调整模型。"),
    ("房颤", "每增加 1 年的 HR 1.02（1.00–1.04）。Fig. 6 完全调整模型。"),
    ("高胆固醇", "每增加 1 年的 HR 1.02（1.01–1.04）。Fig. 6 完全调整模型。"),
    ("高血压", "每增加 1 年的 HR 1.01（1.00–1.02）。Fig. 6 完全调整模型。"),
)
