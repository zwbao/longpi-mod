"""Higgins-Chen et al., Nature Aging 2022, doi:10.1038/s43587-022-00248-2.

Full text read from NCBI PMC9586209 XML after EuropePMC fullTextXML returned HTTP 500. Replicate deviations are Fig. 1 and Fig. 3. The cloned repository does not contain CalcAllPCClocks.RData, so PC ages are not computed.
"""

from __future__ import annotations

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

REPLICATE_PAIRS = 36
AGE_MIN = 37.3
AGE_MAX = 74.6
N_CLOCK_CPGS = 1273
N_PC_CPGS = 78464
# Fig. 1 Horvath1 CpG clock.
HORVATH1_MEDIAN = 1.8
HORVATH1_MAX = 4.8
# Fig. 1 other CpG clocks, ranges, not a single clock.
OTHER_MEDIAN_LOW = 0.9
OTHER_MEDIAN_HIGH = 2.4
OTHER_MAX_LOW = 4.5
OTHER_MAX_HIGH = 8.6
PHENOAGE_MEDIAN = 2.4
PHENOAGE_MAX = 8.6
GRIMAGE_ICC = 0.989
# Fig. 3 PC clocks.
PC_MEDIAN_LOW = 0.3
PC_MEDIAN_HIGH = 0.8
PCPHENOAGE_MEDIAN = 0.6
PCPHENOAGE_MAX = 1.6
BETA_M_ICC_R = 0.987
BONFERRONI_P = 1.057e-7
# Code file, not a paper table.
CSV_ROWS = 30084
RDATA_PRESENT = False
WEIGHTS_PRESENT = False
CLOCKS = [
    "Horvath1",
    "Horvath2",
    "Hannum",
    "PhenoAge",
    "GrimAge",
    "DNAmTL",
    "PCHorvath1",
    "PCHorvath2",
    "PCHannum",
    "PCPhenoAge",
    "PCGrimAge",
    "PCDNAmTL",
]
ALIASES = {
    "Horvath1": ["Horvath1"],
    "PCHorvath1": ["PCHorvath1"],
    "PhenoAge": ["PhenoAge"],
    "PCPhenoAge": ["PCPhenoAge"],
    "GrimAge": ["GrimAge"],
    "PCGrimAge": ["PCGrimAge"],
    "Hannum": ["Hannum"],
    "PCHannum": ["PCHannum"],
    "Horvath2": ["Horvath2"],
    "PCHorvath2": ["PCHorvath2"],
    "DNAmTL": ["DNAmTL"],
    "PCDNAmTL": ["PCDNAmTL"],
}
