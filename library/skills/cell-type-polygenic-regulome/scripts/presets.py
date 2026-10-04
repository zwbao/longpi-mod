"""Ma et al., Nature Aging 2026, doi:10.1038/s43587-025-01027-5.

Full text read from the local PDF. TRS = GRS + CTS - s.d.(GRS, CTS). The s.d. term matches alternativeRegulonScore in scMORE_reproduce: root sum of squares around the two-value mean, alpha = 1. Theta 0.5 is the default used when collapsing a TF and its targets, and is not applied again to already aggregated CTS and GRS.
"""

from __future__ import annotations

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

N_TRAITS = 31
N_EREGULONS_PD = 77
N_CELL_TYPES = 7
THETA = 0.5
ALPHA = 1.0
MC_CONTROLS = 1000
P_CUTOFF = 0.05
LYMPHOCYTE_N = 171643
FIG2_REGULONS = ("ZEB1", "IKZF1", "FOXO1", "ZNF721")
WEIGHTS_PRESENT = False
ALIASES = {}
