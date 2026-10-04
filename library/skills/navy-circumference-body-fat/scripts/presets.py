"""Constants of the U.S. Navy circumference body-fat equations and the waist cut-offs.

[M] Hodgdon JA, Beckett MB. Prediction of percent body fat for U.S. Navy men from
    body circumferences and height. Naval Health Research Center, San Diego,
    Report No. 84-11, 1984. DTIC ADA143890. Approved for public release.
[W] Hodgdon JA, Beckett MB. Prediction of percent body fat for U.S. Navy women
    from body circumferences and height. Naval Health Research Center, San Diego,
    Report No. 84-29, 1984. DTIC ADA146456. Approved for public release.

Both reports print the regression on body density with "body circumferences and
height measured in cm" ([M] p. 12, [W] p. 12), and convert density to percent
fat with Siri (1961), %BF = 100[(4.95/BD) - 4.50] ([M] Table 1, [W] Table 1).
Only their Appendix A field tables are in inches. The percent-fat equations in
inches that circulate online (86.010 / 70.041 / 36.76 and 163.205 / 97.684 /
78.387) are not printed in either report and are not used here.

[B] Browning LM, Hsieh SD, Ashwell M. Nutr Res Rev 2010;23:247-269,
    doi:10.1017/S0954422410000144 (systematic review: mean WHtR boundary 0.50 for
    men and women). [A] Ashwell M, Hsieh SD. Int J Food Sci Nutr 2005;56:303-307,
    doi:10.1080/09637480500195066 (proposal of the 0.5 boundary).
[O] WHO. Waist circumference and waist-hip ratio: report of a WHO expert
    consultation, Geneva, 8-11 December 2008. WHO, 2011. ISBN 978 92 4 150149 1.
    Annex Table A1.
[C] WS/T 428-2013 成人体重判定. 中华人民共和国国家卫生和计划生育委员会 2013-04-18 发布,
    2013-10-01 实施. 表 2 成人中心型肥胖分类.
"""

from __future__ import annotations

# [M] p. 12: BODY DENSITY = -[.19077 x LOG10(ABDOMEN II CIRC. - NECK CIRC.)] + [.15456 x LOG10(HEIGHT)] + 1.0324
# Abdomen II is "At the level of the umbilicus" ([M] p. 6); neck "Just inferior to the larynx" ([M] p. 5); hip "At the
# level of the greatest protrusion of the gluteal muscles" ([M] p. 6; [W] lists no hip site).
MEN = {"a": 0.19077, "b": 0.15456, "c": 1.0324}
# [W] p. 12: BODY DENSITY = -[.35004 x LOG10(ABDOMEN I + HIP - NECK)] + [.22100 x LOG10(HEIGHT)] + 1.29579
# Abdomen I is "At the level of minimal abdominal width, approximately midway between the xyphoid and the
# umbilicus" ([W] pp. 5-6).
WOMEN = {"a": 0.35004, "b": 0.22100, "c": 1.29579}
# [M] and [W] Table 1 footnote: %Fat from Siri, 1961: %BF = 100[(4.95/Body Density) - 4.50].
SIRI = (4.95, 4.50)

# Derivation samples, correlations and standard errors ([M] and [W] summaries and section 2.1).
DERIVATION = {
    "male": {"n": 602, "ages": (18, 56), "see_pct": 3.52, "r": 0.90},
    "female": {"n": 214, "ages": (18, 44), "see_pct": 3.72, "r": 0.85},
}

CM_PER_INCH = 2.54

# Appendix A "PERCENT FAT ESTIMATION" tables, inches. Keys: (circumference value, height); value: printed %BF.
# Men ([M] p. 20): circumference value = abdomen II - neck.
MEN_TABLE_CELLS = {(16.0, 65.0): 13, (20.0, 68.0): 20, (25.0, 69.5): 28, (30.0, 66.0): 37}
# Women ([W] p. 19): circumference value = abdomen I + hip - neck. Cells in the 15-40 %BF band.
WOMEN_TABLE_CELLS = {(45.0, 60.0): 18, (50.0, 62.0): 24, (55.0, 59.0): 33}
# A lean cell where the printed women's table runs below the printed equation (see references/contract.md).
WOMEN_TABLE_LEAN_CELL = ((36.0, 62.5), 0)

# [B] abstract: "Mean boundary values for WHtR ... were 0.50 for men and 0.50 for women"; [A]: "A boundary value of
# WHTR = 0.5 indicates increased risk for men and women."
WHTR_BOUNDARY = 0.5

# [O] Annex Table A1: "Waist-hip ratio >=0.90 cm (M); >=0.85 cm (W) Substantially increased" (risk of metabolic
# complications). The "cm" is a typo in the table; the ratio has no unit.
WHR_CUTOFF = {"male": 0.90, "female": 0.85}

# [C] 表 2：中心型肥胖前期 85<=男性腰围<90、80<=女性腰围<85；中心型肥胖 男性腰围>=90、女性腰围>=85（cm）。
CN_WAIST = {"male": (85.0, 90.0), "female": (80.0, 85.0)}
CN_LABELS = ("未达切点", "中心型肥胖前期", "中心型肥胖")

WHTR_LABELS = ("低于 0.5", "0.5 及以上")
WHR_LABELS = ("低于切点", "达到切点")

BOUNDARY = (
    "体脂率是用围度和身高估算的，不是直接测量；腰围、腰臀比和腰围身高比的分档是筛查切点，不是诊断。"
    "是否需要检查或治疗，由医生结合血压、血糖、血脂等判断。"
)
