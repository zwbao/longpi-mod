"""Hartono et al., Nature Aging 2026, doi:10.1038/s43587-026-01116-z.

The limit of detection is the methods sentence: mean background plus 3 s.d.
"""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Methods: LoD = mean background + 3 standard deviations.
SD_MULTIPLIER = 3
# Mouse weight range in the bleomycin methods. Not printed in the personal report.
COHORT_WEIGHT = "20 to 25"

CLEAVABLE = "AZIDOACETYLKGRPLALWRSGGGC"
CLEAVABLE_CORE = "KGRPLALWRSGGGC"
CONTROL = "AZIDOACETYLKGGGGGGGC"
CONTROL_CORE = "KGGGGGGGC"
