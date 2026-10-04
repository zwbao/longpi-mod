"""Gupta et al., Nature 2026, doi:10.1038/s41586-026-10569-6.

Age and substitution classes are the ones printed in the main text.
"""

BOUNDARY = (
    "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。"
    "名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"
)

TITLE = "血液线粒体突变累积"
DOI = "10.1038/s41586-026-10569-6"
FULL_TEXT_READ = True

# Individuals with whole-genome sequences. Not printed in the personal report.
PARTICIPANTS = 736038

AGE_AFTER = 60
HET_REMOVE_BELOW = "0.05"

GERMLINE = ("TERT", "TCL1A", "SMC4")
RVAS = ("ASXL1", "DNMT3A", "TET2", "SRSF2", "JAK2", "CHEK2", "NEMF")
