"""Numbers from Walter et al., Nature Aging 2024.

The senescent-like call uses a one-way FBR escape score cutoff (Fig. 6a).
Supplementary Table 2 stores logFC, not that score.
"""

DOI = "10.1038/s43587-024-00756-3"
TITLE = "肌肉再生的干细胞状态"
FULL_TEXT_READ = True
# Results: 273,923 cells and nuclei across the regeneration atlas.
CELL_N = 273923
# Fig. 6a and Extended Data Fig. 10g,h. One-way FBR Sen Score.
SENESCENT_LIKE_CUTOFF = 2412.562
BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

SCORE_NAMES = (
    "oneway fbr sen score",
    "one-way fbr sen score",
    "oneway_fbr_sen_score",
    "单向fbr衰老分",
    "fbr senescence score",
)
