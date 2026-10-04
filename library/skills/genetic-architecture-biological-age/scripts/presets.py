"""Constants read from Wen et al., Nature Aging 2024 (PMC11446180).

BAG is defined as machine-learning-predicted age minus chronological age.
The support-vector weights are not in this paper. No method repository was
listed, so no weights are stored here.
"""

from __future__ import annotations

DOI = "10.1038/s43587-024-00662-8"
FULL_TEXT_READ = True

BOUNDARY = (
    "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。"
    "名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"
)

GWAS_P = 5e-8
EYE_MISSING_RATE = 0.20
EYE_OUTLIER_SD = 6
EYE_MEASURES_START = 88
EYE_MEASURES_EXCLUDED = 28
EYE_MEASURES_KEPT = 60
N_FEATURES_NINE_ORGANS = 2444
SVM_FOLDS = 20

# Methods: brain, cardiovascular, eye, hepatic, immune, metabolic,
# musculoskeletal, pulmonary, renal. Locus counts are the European GWAS.
ORGANS = (
    ("brain", "脑", 11, 0.47),
    ("cardiovascular", "心血管", 44, 0.27),
    ("eye", "眼", 17, 0.38),
    ("hepatic", "肝", 41, 0.23),
    ("immune", "免疫", 61, 0.21),
    ("metabolic", "代谢", 76, 0.29),
    ("musculoskeletal", "肌肉骨骼", 24, 0.24),
    ("pulmonary", "肺", 67, 0.36),
    ("renal", "肾", 52, 0.31),
)

ALIASES = {
    "brain": "brain",
    "脑": "brain",
    "cardiovascular": "cardiovascular",
    "心血管": "cardiovascular",
    "eye": "eye",
    "眼": "eye",
    "hepatic": "hepatic",
    "肝": "hepatic",
    "immune": "immune",
    "免疫": "immune",
    "metabolic": "metabolic",
    "代谢": "metabolic",
    "musculoskeletal": "musculoskeletal",
    "肌肉骨骼": "musculoskeletal",
    "pulmonary": "pulmonary",
    "肺": "pulmonary",
    "renal": "renal",
    "肾": "renal",
}
