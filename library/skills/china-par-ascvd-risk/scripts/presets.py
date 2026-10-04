"""Constants of the China-PAR 10-year ASCVD risk equations.

Source [P]: Yang X, Li J, Hu D, et al. Circulation 2016;134:1430-1440,
doi:10.1161/CIRCULATIONAHA.116.022367, with its Data Supplement, as the
33-page PDF on the official China-PAR site:
https://www.cvdrisk.com.cn/uploadedFile/20171227114818843.pdf
Page numbers are PDF pages. The same 26 two-decimal coefficients appear in
BMC Cardiovasc Disord 2020 (doi:10.1186/s12872-020-01425-0, Supplemental
Table 1) and BMC Public Health 2020 (doi:10.1186/s12889-020-09579-4, Table S1).

Two constants are derived from numbers the paper prints, because the printed
ones are too coarse to reproduce the paper's own results (details and checks
in references/contract.md):

- Men: the six coefficients of the continuous terms come from Supplemental
  Table 1's "Coefficient x Value" column, which the authors computed with
  unrounded coefficients, divided by the example's own values. Each rounds to
  the printed coefficient. With them the model reproduces Table 2 within 1%;
  with the printed two-decimal ones it runs about 6% high.
- Women: the 10-year baseline survival is printed only as 0.99, which puts the
  paper's own results about a third too low. S10 = 0.9851 is solved from the
  paper's women's worked example (individual sum 119.22, risk 10.1%) and
  reproduces Table 2 within 1%.
"""

from __future__ import annotations

import math

# Supplemental Table 1, [P] p.14. Continuous variables are natural logs;
# total and HDL cholesterol in mg/dL; SBP in mmHg; waist in cm; 0/1 flags.
MEN_PRINTED = {
    "ln_age": 31.97,
    "ln_sbp_treated": 27.39,
    "ln_sbp_untreated": 26.15,
    "ln_tc": 0.62,
    "ln_hdl": -0.69,
    "ln_waist": -0.71,
    "smoker": 3.96,
    "diabetes": 0.36,
    "north": 0.48,
    "urban": -0.16,
    "family_history": 6.22,
    "ln_age_x_ln_sbp_treated": -6.02,
    "ln_age_x_ln_sbp_untreated": -5.73,
    "ln_age_x_smoker": -0.94,
    "ln_age_x_family_history": -1.53,
}
WOMEN = {
    "ln_age": 24.87,
    "ln_sbp_treated": 20.71,
    "ln_sbp_untreated": 19.98,
    "ln_tc": 0.06,
    "ln_hdl": -0.22,
    "ln_waist": 1.48,
    "smoker": 0.49,
    "diabetes": 0.57,
    "north": 0.54,
    "ln_age_x_ln_sbp_treated": -4.53,
    "ln_age_x_ln_sbp_untreated": -4.36,
}

# Supplemental Table 1's worked example (men): each "Coefficient x Value" was
# computed with the unrounded coefficient, so dividing by the example's own
# value recovers it to about four significant digits.
_EX_LN_AGE = math.log(60)
_EX_LN_SBP = math.log(130)
MEN_TERM_VALUES = {
    "ln_age": (130.88, _EX_LN_AGE),
    "ln_sbp_untreated": (127.28, _EX_LN_SBP),
    "ln_tc": (3.32, math.log(210)),
    "ln_hdl": (-2.78, math.log(55)),
    "ln_waist": (-3.12, math.log(80)),
    "ln_age_x_ln_sbp_untreated": (-114.21, _EX_LN_AGE * _EX_LN_SBP),
}
MEN = dict(MEN_PRINTED, **{key: product / value for key, (product, value) in MEN_TERM_VALUES.items()})

# Mean (coefficient x value), Supplemental Table 1, [P] p.14.
MEAN_MEN = 140.68
MEAN_WOMEN = 117.26

# 10-year baseline survival. Men: 0.9707 is the value in the worked formula of
# Supplemental Table 2, [P] p.16 (Table 1 prints 0.97). Women: Table 1 prints
# 0.99, which does not reproduce the paper; 0.9851 solves
# 1 - S10 ** exp(119.22 - 117.26) = 10.1% (the women's worked example,
# Supplemental Table 1) and reproduces Table 2 within 1%.
S10_MEN = 0.9707
S10_WOMEN_PRINTED = 0.99
S10_WOMEN = 0.9851

# Worked example, [P] p.4 and Table 2, pp.14-16: age 60, untreated SBP 130 mmHg,
# TC 210 mg/dL, HDL-C 55 mg/dL, waist 80 cm, non-smoker, diabetes, urban
# northern China, no family history.
EXAMPLE = {"age": 60, "sbp": 130, "treated": False, "tc": 210, "hdl": 55, "waist": 80,
           "smoker": False, "diabetes": True, "north": True, "urban": True, "family_history": False}
EXAMPLE_MEN_TERMS = [130.88, 127.28, 3.32, -2.78, -3.12, 0.36, 0.48, -0.16, -114.21]
EXAMPLE_MEN_SUM = 142.04
EXAMPLE_WOMEN_SUM = 119.22
# Table 2: 10-year risk (%) for the same profile at other ages.
TABLE2 = {"men": {40: 2.2, 50: 5.4, 60: 11.0, 70: 19.6}, "women": {40: 2.4, 50: 5.4, 60: 10.1, 70: 17.1}}

# 2019 guideline (中国心血管病风险评估和管理指南, 中国循环杂志 2019;34(1), Appendix 1):
# 40-year-old man, northern urban, waist 80 cm, TC 5.2 mmol/L, HDL-C 1.3 mmol/L,
# BP 145/80 untreated, no diabetes, non-smoker, family history: the official
# calculator gives 4.7% (low).
GUIDELINE_EXAMPLE = {"age": 40, "sbp": 145, "treated": False, "tc_mmol": 5.2, "hdl_mmol": 1.3, "waist": 80,
                     "smoker": False, "diabetes": False, "north": True, "urban": True, "family_history": True}
GUIDELINE_EXAMPLE_RISK = 4.7

# The paper converts cholesterol with mg/dL x 0.0259 = mmol/L ([P] p.3).
MMOL_TO_MG_DL = 1 / 0.0259

# 10-year risk categories, 2019 guideline Figure 1 (printed p.6).
CATEGORIES = ((5.0, "低危"), (10.0, "中危"), (float("inf"), "高危"))

DERIVATION_AGES = (35, 74)

BOUNDARY = (
    "China-PAR 给出的是和你条件相同的中国成人的平均 10 年风险，是模型估计，不是诊断，也不决定是否用药。"
    "正式评估以医生或 cvdrisk.com.cn 官方计算器为准。"
)
