"""Hazard-ratio bounds stated in the final cluster-model paragraph.

doi:10.1038/s41591-024-03483-9. Individual point estimates for these eight were not printed, only the bounds.
"""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

XWAS_N = 492567
ENGLAND_N = 436891
PROTEOMIC_N = 45441
EXPOSURES_TESTED = 164
EXPOSURES_REPLICATED = 110
INDEPENDENT_EXPOSURES = 25
MODIFIABLE_EXPOSURES = 23
PRS_EXTRA_MORTALITY_POINTS = 2
EXPOSOME_EXTRA_MORTALITY_POINTS = 17
VEHICLES_HR_EXCLUDED = 0.39
PROTECTIVE_HR_BOUND = 0.8
DETRIMENTAL_HR_BOUND = 1.4

EXPOSURES = (
    ("current_smoker", "现在吸烟", "最终簇模型里 HR > 1.4。"),
    ("council_housing", "住议会公租房（相对自有住房）", "最终簇模型里 HR > 1.4。"),
    ("tired_often", "感到疲倦的频率", "最终簇模型里 HR > 1.4。"),
    ("household_income", "家庭收入", "最终簇模型里 HR < 0.8。"),
    ("employed", "在业", "最终簇模型里 HR < 0.8。"),
    ("ethnicity_asian_black_other", "亚裔、黑人或他族（相对白人）", "最终簇模型里 HR < 0.8。这是文中两个不可改变因素之一。"),
    ("ipaq_activity", "IPAQ 体力活动", "最终簇模型里 HR < 0.8。"),
    ("lives_with_partner", "与伴侣同住", "最终簇模型里 HR < 0.8。"),
)
