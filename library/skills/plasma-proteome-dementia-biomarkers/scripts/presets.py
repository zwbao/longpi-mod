BOUNDARY = '这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。'
DISCOVERY_N = 1318
CTRL_N = 374
AD_N = 532
DLB_N = 196
FTD_N = 216
AD_DYSREGULATED = 236
Q_THRESHOLD = 0.05
AUC_DLB_CTRL = 0.85
AUC_DLB_AD = 0.86
AUC_FTD_CTRL = 0.92
AUC_FTD_AD = 0.83
MARKERS = [
    ("GFAP", "沿 AD 连续谱升高；摘要另写 FTD 与较低的 GFAP 有关"),
    ("NFL", "从临床前 AD 到痴呆升高；相对 DLB 时在 FTD 更高"),
    ("MAP3K5", "从临床前 AD 到痴呆下降"),
    ("RET", "从临床前 AD 到痴呆下降"),
    ("FLT3LG", "从临床前 AD 到痴呆下降"),
    ("ITGAV", "在 DLB 的 Aβ 阳性和阴性亚组都降低；在 FTD 中也降低"),
    ("ITGAM", "在 DLB 的 Aβ 阳性和阴性亚组都降低"),
    ("NCAN", "在 FTD 中降低"),
    ("NTRK3", "在 FTD 中降低"),
    ("RGMA", "DLB 相对 FTD 更高"),
    ("DSG2", "DLB 相对 FTD 更高"),
    ("SELE", "FTD 相对 DLB 更高"),
]
ALIASES = {"NEFL": "NFL", "NFL": "NFL", "NfL": "NFL"}
