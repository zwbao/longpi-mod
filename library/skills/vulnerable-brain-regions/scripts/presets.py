"""Table 3 joint-model correlations from Manuello, Cox et al., Nature Communications 2024.

r values are cohort correlations, not weights applied to a personal measurement.
"""

from __future__ import annotations

BOUNDARY = (
    "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。"
    "名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"
)

DOI = "10.1038/s41467-024-46344-2"
JOINT_N = 35527
MODEL_R2 = 0.0145
F_STAT = 43.5
# display, r, p, aliases. Order is Table 3.
MRFS = (
    ("医生诊断的糖尿病", -0.054, 1.13e-24, ("糖尿病", "diabetes")),
    ("2005年二氧化氮", -0.049, 5.39e-20, ("二氧化氮", "nitrogen", "no2", "空气污染", "pollution")),
    ("饮酒频率", -0.045, 3.81e-17, ("饮酒", "alcohol", "酒精")),
    ("睡眠时长", -0.028, 1.39e-07, ("睡眠", "sleep")),
    ("腰围", -0.027, 2.99e-07, ("腰围", "waist")),
    ("既往吸烟", -0.027, 3.14e-07, ("吸烟", "抽烟", "smoking", "tobacco")),
    ("降压药", -0.025, 1.61e-06, ("降压", "blood pressure", "血压药")),
    ("爬楼梯频率", 0.020, 2.34e-04, ("爬楼梯", "stair")),
    ("听力困难", -0.014, 1.09e-02, ("听力", "hearing")),
    ("止痛药", -0.010, 5.12e-02, ("止痛", "pain")),
    ("社交场合", -0.007, 1.83e-01, ("社交", "pub", "social")),
    ("降胆固醇药", -0.007, 1.97e-01, ("胆固醇", "cholesterol", "他汀")),
)
JOINT_SIGNIFICANT = ("医生诊断的糖尿病", "2005年二氧化氮", "饮酒频率")
