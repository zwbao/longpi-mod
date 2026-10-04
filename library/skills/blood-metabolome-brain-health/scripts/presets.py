"""Ahmad et al., Nature Aging 2026, doi:10.1038/s43587-026-01149-4.

Full text read from the local PDF. The fourteen names are the cognition set named in the results and ordered in the method repository figure script. Adjusted mean differences are model 1 in the main text. They are not multiplied into a personal score. Mediation is Fig. 5.
"""

from __future__ import annotations

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

N_PARTICIPANTS = 1082
N_METABOLITES = 991
N_COGNITION = 14
# Twenty-two metabolites associated with MRI markers, not twenty-two MRI markers.
N_MRI = 22
RSIII_AGE_MEAN = 62.54
RSIII_AGE_SD = 5.91
# model 1 adjusted mean differences, main text.
ERGO_BETA = 0.122
ERGO_P = 4.65e-7
URIDINE_BETA = 0.093
URIDINE_P = 1.0e-4
DEOXYURIDINE_BETA = 0.083
DEOXYURIDINE_P = 5.48e-4
# Fig. 5 mediation.
MEDIATION_PERCENT = 31.5
MEDIATION_CI_LOW = 15.5
MEDIATION_CI_HIGH = 71
ANTACID_BETA = -0.235
AGMP_PPI_BETA = -0.159
VARIANCE_EXPLAINED_MAX = 28.6
FDR = 0.05
WEIGHTS_PRESENT = False

# direction: 1 means higher level went with better cognition; -1 means lower level went with better cognition.
METABOLITES = [
    ("麦角硫因", "ergothioneine", 1, ERGO_BETA),
    ("尿苷", "uridine", 1, URIDINE_BETA),
    ("2-脱氧尿苷", "2-deoxyuridine", 1, DEOXYURIDINE_BETA),
    ("X-11849", "X-11849", 1, None),
    ("X-11847", "X-11847", 1, None),
    ("4-乙烯基愈创木酚硫酸盐", "4-vinylguaiacol sulfate", -1, None),
    ("邻甲酚硫酸盐", "o-cresol sulfate", -1, None),
    ("3-乙酰苯酚硫酸盐", "3-acetylphenol sulfate", -1, None),
    ("3-羟基-2-甲基吡啶硫酸盐", "3-hydroxy-2-methylpyridine sulfate", -1, None),
    ("2-萘酚硫酸盐", "2-naphthol sulfate", -1, None),
    ("4-乙烯基儿茶酚硫酸盐", "4-vinylcatechol sulfate", -1, None),
    ("3-甲基儿茶酚硫酸盐", "3-methylcatechol sulfate", -1, None),
    ("X-25420", "X-25420", -1, None),
    ("X-24418", "X-24418", -1, None),
]

ALIASES = {display: [display, key] for display, key, _direction, _beta in METABOLITES}
ALIASES["2-脱氧尿苷"].extend(["2'-deoxyuridine", "2′-deoxyuridine"])
PPI_ALIASES = [
    "奥美拉唑", "泮托拉唑", "兰索拉唑", "雷贝拉唑", "艾司奥美拉唑",
    "质子泵", "抗酸", "omeprazole", "pantoprazole", "lansoprazole",
    "rabeprazole", "esomeprazole", "antacid", "ppi",
]
