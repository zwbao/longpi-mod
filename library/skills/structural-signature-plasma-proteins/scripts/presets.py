"""Son et al., Nature Aging 2026, doi:10.1038/s43587-026-01078-2.

Full text read from NCBI efetch of PMC13004671. The 93.2 / 92.0 / 91.1 figures are means across 879 peptides, not means of C1QA, CLUS, or ApoB. The deep-learning weights are not printed. The model sentence names peptides GFCDTTNKGLF, SVDCSTNNPSQAKL, and AVLCEFISQSIKSF. A figure spells the C1QA peptide GFCDTTNLKGLF.
"""

from __future__ import annotations

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

N_SAMPLES = 520
KU_N = 320
UCSD_N = 200
PANEL_SAMPLES = 470
N_ALGORITHMS = 18
PANEL_ACCURACY = 83.44
HEALTHY_ACCESS = 93.2
HEALTHY_N = 227
MCI_ACCESS = 92.0
MCI_N = 135
AD_ACCESS = 91.1
AD_N = 158
LABELED_PEPTIDES = 879
WEIGHTS_PRESENT = False
PANEL = [
    ("C1QA", "补体 C1q A 链"),
    ("CLUS", "丛集蛋白"),
    ("APOB", "载脂蛋白 B"),
]
# Model sentence in the results. The figure spells C1QA as GFCDTTNLKGLF.
PEPTIDES = {
    "C1QA": "GFCDTTNKGLF",
    "CLUS": "SVDCSTNNPSQAKL",
    "APOB": "AVLCEFISQSIKSF",
}
GROUP_MEANS = (
    ("健康", HEALTHY_ACCESS),
    ("MCI", MCI_ACCESS),
    ("AD", AD_ACCESS),
)
ALIASES = {
    "补体 C1q A 链": ["C1QA", "补体 C1q A 链"],
    "丛集蛋白": ["CLUS", "clusterin", "丛集蛋白"],
    "载脂蛋白 B": ["APOB", "ApoB", "载脂蛋白 B"],
}
