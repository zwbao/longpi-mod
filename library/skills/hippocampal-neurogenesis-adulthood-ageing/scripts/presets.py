"""Cohort counts from the hippocampal neurogenesis paper, Nature 2026.

Nucleus counts are in the age-and-diagnosis results paragraph. The 2.5-fold figure is in the resilience paragraph.
"""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

TOTAL_NUCLEI = 355997
SUPERAGER_MIN_AGE = 80
MEMORY_REFERENCE_AGE_LOW = 50
MEMORY_REFERENCE_AGE_HIGH = 59
SA_IMMATURE_FOLD_AFTER_OUTLIER = 2.5
SA_VS_AD_NEUROBLAST_Q = 0.0002
DEG_ADJUSTED_P = 0.01
DEG_LOG2_FOLD = 1.0
DEG_PERCENT_DIFFERENCE = 0.3

COHORTS = (
    ("YA 年轻认知完好", "8 名 20–40 岁成人，85,977 个核。"),
    ("HA 健康老年", "8 人，73,093 个核。"),
    ("SA SuperAger", "6 人，51,437 个核。定义是年龄不少于 80 岁，情景记忆不低于 50–59 岁。"),
    ("PCI 临床前中间病理", "6 人，58,281 个核。"),
    ("AD 阿尔茨海默病", "10 人，87,209 个核。"),
)
