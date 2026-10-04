"""Sun et al., Nature Materials 2025, doi:10.1038/s41563-025-02234-6.

Numbers below are printed in the article. They are not refit from the source-data points.
"""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Fig. 2e, native tissue Young's modulus, kPa. Standard deviations stay out of the personal report.
NATIVE_YOUNG_KPA = 13.1
NATIVE_AGED_KPA = 38.6
# Fig. 2f, scaffold Young's modulus, kPa.
SCAFFOLD_SOFT_KPA = 11.5
SCAFFOLD_STIFF_KPA = 39.6
# Extended Data Fig. 4: DEGs are FC > 1.5 or < 2/3 and p < 0.05.
FC_HIGH = 1.5
FC_LOW_NUM = 2
FC_LOW_DEN = 3
P_MAX = 0.05
# Fig. 3a cohort count. Not printed in the personal report.
COHORT_UP_GENES = 490

CONDITIONS = {
    ("young", "soft"): "SoftY",
    ("young", "stiff"): "StiffY",
    ("aged", "soft"): "SoftA",
    ("aged", "stiff"): "StiffA",
}
