"""Yi et al., Nature Aging 2025, doi:10.1038/s43587-025-00961-8.

Group cutoffs are the clinical-cohort paragraph in the methods.
"""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Methods: high group is at least 1500 pg/ml. Normal group is 250 to 680 pg/ml.
HIGH_PG_ML = 1500
NORMAL_LOW_PG_ML = 250
NORMAL_HIGH_PG_ML = 680
# Cohort size in the article. Not printed in the personal report.
COHORT_N = 1068

# Methods sequences. The collagen peptide is hyphenated across a line break as EKAH-DGGR.
E_MOTIF = "VGVAPGVGVAPG"
E_HEXAMER = "VGVAPG"
SCRAMBLED = "VVGPGAVVGPGA"
POLY_AK = "AAAAAAKAAAKAAK"
COLLAGEN_PEPTIDE = "EKAHDGGR"
