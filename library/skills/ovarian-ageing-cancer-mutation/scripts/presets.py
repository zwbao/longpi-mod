"""ANM effects from the main text, plus Supplementary Table 2 betas.

The BOLT column used here is “Age at natural menopause, winsorized at 34”.
Its ZNF518A high-confidence protein-truncating beta is -5.60889, which is the
-5.61 years printed in the main text. Reprogen and REGENIE columns are not used.
"""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# UK Biobank women in the discovery burden test. Cohort size, not a personal result.
DISCOVERY_WOMEN = "106973"

# BRIDGES replication for PALB2. Not the discovery beta.
PALB2_BRIDGES_YEARS = "1.78"

EFFECTS = {
    "CHEK2": {
        "mask": "damaging",
        "direction": "晚",
        "years": "1.57",
        "ci": "1.23 到 1.92",
        "scope": "九个全外显子显著基因之一。",
    },
    "HELB": {
        "mask": "hc-ptv",
        "direction": "晚",
        "years": "1.84",
        "ci": "1.08 到 2.60",
        "scope": "九个全外显子显著基因之一。",
    },
    "HROB": {
        "mask": "hc-ptv",
        "direction": "早",
        "years": "2.89",
        "ci": "1.86 到 3.92",
        "scope": "九个全外显子显著基因之一。",
    },
    "BRCA2": {
        "mask": "hc-ptv",
        "direction": "早",
        "years": "1.18",
        "ci": "0.72 到 1.65",
        "scope": "九个全外显子显著基因之一。",
    },
    "ETAA1": {
        "mask": "hc-ptv",
        "direction": "早",
        "years": "2.28",
        "ci": "1.39 到 3.17",
        "scope": "九个全外显子显著基因之一。",
    },
    "ZNF518A": {
        "mask": "hc-ptv",
        "direction": "早",
        "years": "5.61",
        "ci": "4.04 到 7.18",
        "scope": "九个全外显子显著基因之一。",
        "menarche": "初潮晚 0.56 年（区间 0.14 到 0.98 年）。",
    },
    "SAMHD1": {
        "mask": "damaging",
        "direction": "晚",
        "years": "1.35",
        "ci": "0.81 到 1.89",
        "scope": "九个全外显子显著基因之一。",
    },
    "BRCA1": {
        "mask": "hc-ptv",
        "direction": "早",
        "years": "2.1",
        "ci": "1.2 到 3.0",
        "scope": "不在那九个全外显子显著基因里。正文在更宽的基因负担窗口写出了蛋白截短变异的年数。",
    },
    "SLCO4A1": {
        "mask": "damaging",
        "direction": "早",
        "years": "1.13",
        "ci": "0.6 到 1.64",
        "scope": "不在那九个全外显子显著基因里。正文在更宽的基因负担窗口写出了 damaging 变异的年数。",
    },
}

# Supplementary Table 2, winsorized-at-34 BOLT Beta and SE. Negative beta is earlier ANM.
TABLE_BETA = {
    ("PALB2", "hc-ptv"): ("-1.38744", "0.291803", True),
    ("PALB2", "damaging"): ("-0.58653", "0.1826", False),
    ("PALB2", "missense"): ("-0.0707727", "0.233621", False),
    ("PNPLA8", "hc-ptv"): ("-3.02668", "0.572596", True),
    ("PNPLA8", "damaging"): ("-0.959837", "0.225045", False),
    ("PNPLA8", "missense"): ("-0.581612", "0.244607", False),
}

MASK_LABEL = {
    "hc-ptv": "高置信蛋白截短",
    "damaging": "damaging",
    "missense": "错义",
}
