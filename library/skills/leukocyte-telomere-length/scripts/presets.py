"""Codd et al., Nature Aging 2022, doi:10.1038/s43587-021-00166-9.

Author manuscript (Figshare 19228749). After technical adjustment the paper
log-transforms the T/S ratio and z-standardises it. Table 2 gives the quartile
cuts on that z scale. Table 3 model 1 gives the age and male coefficients in
the same units. The mean and SD of the log T/S ratio are not printed, so a raw
ratio cannot be placed on this scale.
"""

from __future__ import annotations

from decimal import Decimal

BOUNDARY = (
    "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。"
    "名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"
)

DOI = "10.1038/s43587-021-00166-9"
FULL_TEXT_READ = True
PARTICIPANTS = 474074
AGE_SD_PER_YEAR = Decimal("-0.024")
MALE_SD = Decimal("-0.178")
Q1_BELOW = Decimal("-0.65")
Q2_BELOW = Decimal("-0.002")
Q4_AT = Decimal("0.65")
