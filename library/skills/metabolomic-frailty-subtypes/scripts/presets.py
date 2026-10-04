"""Numbers copied from Xiao et al., npj Digital Medicine 2025, Table 1 and Table 2.

personal_report.py reads these constants. Do not restate them in SKILL.md headings.
"""

from __future__ import annotations

BOUNDARY = (
    "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。"
    "名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"
)

DOI = "10.1038/s41746-025-02075-2"
UKB_RECRUITED = 502401
INCLUDED_N = 160407
FRAIL_N = 28196
NONFRAIL_N = 132211
FOLLOWUP_YEARS = 13.8
NMR_BIOMARKERS = 251
FI_ITEMS = 49
FI_NONFRAIL_MAX = 0.10
FI_FRAIL_MIN = 0.21
TRAIN_FRACTION = 0.7
XGB_AUC_TRAIN = 0.785
XGB_AUC_TEST = 0.757
PC1_VARIANCE = 0.4454
PC2_VARIANCE = 0.1663
CLUSTER_NMI = 0.864
CLUSTER_ARI = 0.881
BOOTSTRAP_RUNS = 100
SUBTYPE_N = {"I": 8409, "II": 6971, "III": 7477, "IV": 5339}

# Table 2 means. Order: overall, non-frail, subtype I, II, III, IV.
# Group standard deviations are stored but are not used as weights.
METABOLITES = {
    "GlycA": {
        "display": "GlycA",
        "mean": (0.80, 0.79, 0.77, 0.93, 0.84, 0.96),
        "sd": (0.12, 0.11, 0.09, 0.11, 0.10, 0.12),
    },
    "LA/FA": {
        "display": "LA/FA",
        "mean": (29.12, 29.48, 29.95, 29.33, 25.96, 23.04),
        "sd": (3.41, 3.23, 2.72, 2.68, 2.28, 2.60),
    },
    "MUFA/FA": {
        "display": "MUFA/FA",
        "mean": (23.60, 23.31, 21.97, 25.27, 25.10, 29.00),
        "sd": (2.67, 2.53, 1.43, 1.61, 1.55, 1.79),
    },
    "Alb": {
        "display": "白蛋白",
        "mean": (39.46, 39.63, 38.42, 39.73, 37.76, 38.87),
        "sd": (3.37, 3.32, 3.32, 3.58, 3.46, 3.46),
    },
    "Val": {
        "display": "缬氨酸",
        "mean": (0.21, 0.21, 0.19, 0.22, 0.21, 0.25),
        "sd": (0.04, 0.04, 0.04, 0.04, 0.04, 0.05),
    },
    "DHA/FA": {
        "display": "DHA/FA",
        "mean": (2.01, 2.04, 2.25, 1.61, 1.92, 1.38),
        "sd": (0.68, 0.68, 0.68, 0.43, 0.57, 0.49),
    },
    "PUFA/MUFA": {
        "display": "PUFA/MUFA",
        "mean": (1.83, 1.87, 2.05, 1.62, 1.62, 1.22),
        "sd": (0.34, 0.33, 0.22, 0.18, 0.18, 0.16),
    },
    "LA": {
        "display": "亚油酸",
        "mean": (3.48, 3.51, 3.20, 4.09, 2.86, 3.32),
        "sd": (0.69, 0.67, 0.57, 0.62, 0.47, 0.69),
    },
    "XS-VLDL-FC_%": {
        "display": "XS-VLDL-FC_%",
        "mean": (16.05, 16.10, 16.26, 16.18, 15.71, 14.89),
        "sd": (0.60, 0.56, 0.42, 0.44, 0.47, 0.72),
    },
    "L-HDL-PL_%": {
        "display": "L-HDL-PL_%",
        "mean": (50.41, 50.07, 49.41, 50.28, 53.25, 56.48),
        "sd": (2.96, 2.65, 1.79, 2.46, 2.66, 3.82),
    },
    "XS-VLDL-CE_%": {
        "display": "XS-VLDL-CE_%",
        "mean": (35.39, 35.91, 37.03, 34.85, 31.18, 26.61),
        "sd": (4.18, 3.83, 2.78, 2.84, 2.79, 3.74),
    },
}

GROUP_INDEX = {"overall": 0, "nonfrail": 1, "I": 2, "II": 3, "III": 4, "IV": 5}
SUBTYPE_NAME = {
    "I": "LGVF（低 GlycA 和缬氨酸）",
    "II": "HALF（高白蛋白和亚油酸）",
    "III": "LALF（低白蛋白和亚油酸）",
    "IV": "HGVF（高 GlycA 和缬氨酸）",
}
HIGH_RISK = ("III", "IV")

# Cox HRs versus subtype I, adjusted for age, sex, ethnicity, smoking, drinking, SBP, DBP. Figure 3.
HR_VS_I = {
    "冠心病": {"III": (1.13, 1.04, 1.24), "IV": (1.15, 1.04, 1.26)},
    "心力衰竭": {"III": (1.22, 1.09, 1.36), "IV": (1.18, 1.05, 1.33)},
    "MACE": {"III": (1.19, 1.04, 1.35), "IV": (1.29, 1.12, 1.48)},
    "心肌梗死": {"III": (1.35, 1.21, 1.51), "IV": (1.33, 1.18, 1.50)},
    "2型糖尿病": {"III": (2.24, 2.01, 2.49), "IV": (3.00, 2.69, 3.34)},
    "MASLD": {"III": (1.42, 1.20, 1.68), "IV": (1.85, 1.56, 2.20)},
    "COPD": {"III": (1.11, 1.02, 1.21), "IV": (1.15, 1.05, 1.26)},
    "严重肝病": {"III": (1.23, 0.94, 1.60), "IV": (1.45, 1.10, 1.91)},
    "外周动脉疾病": {"III": (1.23, 1.09, 1.39), "IV": (1.21, 1.06, 1.38)},
    "终末期肾病": {"III": (1.83, 1.31, 2.56), "IV": (2.49, 1.77, 3.49)},
    "肾癌": {"III": (1.05, 0.69, 1.60), "IV": (1.16, 0.74, 1.81)},
    "肺癌": {"III": (1.25, 1.03, 1.53), "IV": (1.38, 1.11, 1.72)},
    "腹主动脉瘤": {"III": (1.16, 0.89, 1.50), "IV": (1.29, 0.97, 1.70)},
    "全因死亡": {"III": (1.19, 1.10, 1.29), "IV": (1.25, 1.14, 1.36)},
}

# Healthy diet: one point per favorable factor. Score >= 4 is the paper's healthy category.
DIET_RULES = (
    ("fruit", "水果", "ge", 3.0, "份/天"),
    ("vegetables", "蔬菜", "ge", 3.0, "份/天"),
    ("fish", "鱼", "ge", 2.0, "份/周"),
    ("processed_meat", "加工肉", "le", 1.0, "份/周"),
    ("red_meat", "红肉", "le", 1.5, "份/周"),
    ("whole_grains", "全谷物", "ge", 3.0, "份/天"),
    ("refined_grains", "精制谷物", "le", 1.5, "份/天"),
)
DIET_HEALTHY_MIN = 4

ALIASES = {
    "glyca": "GlycA",
    "glycoprotein acetylation": "GlycA",
    "la/fa": "LA/FA",
    "linoleic acid to total fatty acids": "LA/FA",
    "mufa/fa": "MUFA/FA",
    "alb": "Alb",
    "albumin": "Alb",
    "白蛋白": "Alb",
    "val": "Val",
    "valine": "Val",
    "缬氨酸": "Val",
    "dha/fa": "DHA/FA",
    "pufa/mufa": "PUFA/MUFA",
    "la": "LA",
    "linoleic acid": "LA",
    "亚油酸": "LA",
    "xs-vldl-fc_%": "XS-VLDL-FC_%",
    "xs-vldl-fc": "XS-VLDL-FC_%",
    "l-hdl-pl_%": "L-HDL-PL_%",
    "l-hdl-pl": "L-HDL-PL_%",
    "xs-vldl-ce_%": "XS-VLDL-CE_%",
    "xs-vldl-ce": "XS-VLDL-CE_%",
}
