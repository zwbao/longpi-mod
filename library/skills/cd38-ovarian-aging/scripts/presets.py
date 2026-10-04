"""Human age windows and organ directions from Yang et al., Nature Aging 2024.

Supplementary Table 2 mean ages are cohort summaries. The middle-age cell
read back as 3700±2.08 and is not used.
"""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

YOUNG_MEAN = "23.80"
BROKEN_MIDDLE_AGE = "3700"

ORGANS = {
    "ovary": "正文写中年卵巢的 CD38 表达和活性升高，NAD+ 下降。",
    "liver": "正文写卵巢以外的组织没有这种 CD38 升高和 NAD+ 下降。",
    "muscle": "正文写卵巢以外的组织没有这种 CD38 升高和 NAD+ 下降。",
    "brain": "正文写卵巢以外的组织没有这种 CD38 升高和 NAD+ 下降。",
    "heart": "正文写卵巢以外的组织没有这种 CD38 升高和 NAD+ 下降。",
    "kidney": "正文写卵巢以外的组织没有这种 CD38 升高和 NAD+ 下降。",
    "lung": "正文写卵巢以外的组织没有这种 CD38 升高和 NAD+ 下降。",
}

ORGAN_ALIASES = {
    "ovary": "ovary",
    "卵巢": "ovary",
    "liver": "liver",
    "肝": "liver",
    "肝脏": "liver",
    "muscle": "muscle",
    "肌肉": "muscle",
    "brain": "brain",
    "脑": "brain",
    "heart": "heart",
    "心脏": "heart",
    "kidney": "kidney",
    "肾": "kidney",
    "肾脏": "kidney",
    "lung": "lung",
    "肺": "lung",
}

ORGAN_NAME = {
    "ovary": "卵巢",
    "liver": "肝",
    "muscle": "肌肉",
    "brain": "脑",
    "heart": "心脏",
    "kidney": "肾",
    "lung": "肺",
}

COMPOUNDS = {
    "78c": "正文在八个月小鼠里用 78c 抑制 CD38，卵巢 NAD+ 升高。试剂表只有货号，没有剂量列。这不是用法。",
    "fk866": "正文写 FK866 抑制 NAMPT，会压低 78c 引起的卵巢 NAD+ 升高。试剂表没有剂量列。",
}
