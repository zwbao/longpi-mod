"""Cytometry gates from visualization.qmd and age groups from the Immunity paper.

Thresholds are expression coefficients, not percentages of cells.
"""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

COHORT_N = 158
AGE_SPAN_LOW = 25
AGE_SPAN_HIGH = 85
GROUP_SIZE_LOW = 21
GROUP_SIZE_HIGH = 45
YOUNG_BELOW = 35
OLD_ABOVE = 64
# Inclusive bounds. The last bin is older than OLD_ABOVE, so its high bound is unused.
AGE_BINS = (
    ("A", 25, 34),
    ("B", 35, 44),
    ("C", 45, 54),
    ("D", 55, 64),
    ("E", 65, None),
)
# visualization.qmd writes subtypes inside rev(threshold features), so CxCR3 is last.
GATE_PRIORITY = ("CxCR3", "CD38", "CD25")
GATE_LABEL = {
    "CxCR3": "CXCR3 hi",
    "CD38": "CD38++",
    "CD25": "CD25+",
}
MATURE_LABEL = "剩余成熟初始细胞"

GATES = {
    "CD8": {"CxCR3": 1.5, "CD38": 2.2, "CD25": 0.75, "PTK7": 0.85},
    "CD4": {"CxCR3": 0.55, "CD38": 2.75, "CD25": 0.7, "PTK7": 0.9},
}

STATES = (
    ("CD38++", "高于该谱系的 CD38 阈值，且 CxCR3 没有高于阈值。仓库与正文都把它当作近期胸腺迁出细胞。"),
    ("CXCR3 hi", "CxCR3 高于该谱系阈值。正文写这一群随年龄增加。"),
    ("CD25+", "CD25 高于该谱系阈值，且前两道门都没有先命中。正文把这一顺序步称为 CD25 lo。"),
    ("剩余成熟初始细胞", "三道门都没有高于阈值。"),
)
