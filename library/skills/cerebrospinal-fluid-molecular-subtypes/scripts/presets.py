"""Tijms et al., Nature Aging 2024. Table 1 and Methods. No factorization loadings in the full text."""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

AD_N = 419
CONTROL_N = 187
PROTEINS_DIFFERENT = 1058
EXCLUDED_NO_STANDARD = 113
INCLUDED_N = 609
TREM2_EXAMPLE = "TREM2 R47H"
# Fig. 3a mean frequencies in replication cohorts
REPLICATION_PERCENT = (27.9, 35.5, 5.8, 17.1, 16.6)
# Table 1: label, n, mean age, sd
SUBTYPES = (
    (1, "神经元可塑性偏高", 137, 64.71, 6.82),
    (2, "先天免疫激活", 124, 69.38, 8.35),
    (3, "RNA调控异常", 24, 64.46, 8.73),
    (4, "脉络丛功能异常", 78, 64.28, 8.09),
    (5, "血脑屏障受损", 56, 66.16, 8.11),
)
WEIGHTS_PRESENT = False
