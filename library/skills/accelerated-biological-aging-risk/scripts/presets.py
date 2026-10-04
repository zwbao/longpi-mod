"""PhenoAge coefficients are Levine et al., Aging 2018, as orig=TRUE in BioAge.

The optional questionnaire, body-mass, alcohol, activity and childhood cutoffs
are Gao et al., Nature Communications 2023. That paper uses phenotypic age for
depression and anxiety and does not publish these coefficients.

The paper prints a rounded xb and gamma = 0.0076927. This module keeps the
unrounded code values and does not store KDM q, k, s, or s_BA, because
kdm_calc.R fits those on NHANES and the clone does not save the fit.
"""

from __future__ import annotations

LEVINE_DOI = "10.18632/aging.101414"
GAO_DOI = "10.1038/s41467-023-38013-7"
DOI = LEVINE_DOI
FULL_TEXT_READ = True

BOUNDARY = (
    "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。"
    "名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"
)

# phenoage_calc.R, orig = TRUE
PHENOTYPE_INTERCEPT = -19.90667
PHENOTYPE_WEIGHTS = {
    "albumin_gL": -0.03359355,
    "creat_umol": 0.009506491,
    "glucose_mmol": 0.1953192,
    "lncrp": 0.09536762,
    "lymph_pct": -0.01199984,
    "mcv_fl": 0.02676401,
    "rdw_pct": 0.3306156,
    "alp_u_l": 0.001868778,
    "wbc_10e3": 0.05542406,
    "age": 0.08035356,
}
MORTALITY_NUMERATOR = -1.51714
GAMMA = 0.007692696
PHENOAGE_LOG_NUMERATOR = -0.0055305
PHENOAGE_LOG_DENOMINATOR = 0.090165
PHENOAGE_OFFSET = 141.50225

# Methods equation, rounded. Not used for the reported phenotypic age.
PAPER_GAMMA_ROUNDED = 0.0076927
PAPER_XB_INTERCEPT_ROUNDED = -19.907

# Cohort facts from the paper. Not applied to one person.
N_BASELINE = 424299
N_FREE_OF_DEPRESSION_ANXIETY = 369745
N_FOLLOWUP_SURVEY = 124976
MEDIAN_FOLLOWUP_YEARS = 8.7
PHQ4_EITHER_MIN = 6
PHQ4_DEPRESSION_MIN = 3
PHQ4_ANXIETY_MIN = 3
PHQ4_ITEM_MAX = 3
# Follow-up questionnaires. Any item ≥1 is positive for that symptom.
# A total ≥10 is positive for depression (PHQ-9) or anxiety (GAD-7).
PHQ9_TOTAL_MIN = 10
GAD7_TOTAL_MIN = 10
ITEM_POSITIVE_MIN = 1
PHQ9_ITEMS = (
    "自杀意念",
    "睡眠问题",
    "精神运动变化",
    "感到不够好",
    "疲劳",
    "情绪低落",
    "注意力问题",
    "食欲变化",
    "兴趣减退",
)
GAD7_ITEMS = (
    "难以控制担忧",
    "坐立不安",
    "难以放松",
    "易怒",
    "过度担忧",
    "不祥预感",
    "紧张焦虑",
)
# BMI = kg / m^2. Classes: <25, 25 to <30, ≥30.
BMI_NORMAL_BELOW = 25
BMI_OBESE_FROM = 30
ALCOHOL_MALE_BELOW_G = 28
ALCOHOL_FEMALE_BELOW_G = 14
ACTIVITY_MODERATE_MIN = 150
ACTIVITY_VIGOROUS_MIN = 75
# The mixed clause is printed as "150 min/week" without a sign. Same cutoff as moderate.
ACTIVITY_MIXED_MIN = 150
# The sentence also repeats "≥90 mmHg SBP". That second term is not applied.
SBP_MMHG = 140
# Childhood Trauma Screener answers, in the paper's order:
# emotional abuse, physical abuse, emotional neglect, sexual abuse, physical neglect.
CHILDHOOD_ABUSE_FROM = 1
CHILDHOOD_EMOTIONAL_NEGLECT_THROUGH = 2
CHILDHOOD_PHYSICAL_NEGLECT_THROUGH = 3
# Table 3, PhenoAge acceleration, incident depression/anxiety.
TABLE3_PHENOAGE_HR = 1.113
TABLE3_PHENOAGE_HR_LOW = 1.096
TABLE3_PHENOAGE_HR_HIGH = 1.130
TABLE3_EVENTS = 16523
# Table 1 means are not zero, so that column is not the regression residual.
TABLE1_PHENOAGE_ACCEL_MEAN = -10.92

KDM_REFERENCE = "NHANES III nonpregnant participants aged 30–75 years, fit separately for men and women"
KDM_BIOMARKERS = (
    "fev1_l",
    "sbp_mmhg",
    "albumin",
    "alp",
    "bun",
    "creatinine",
    "crp",
    "hba1c",
    "total_cholesterol",
)

PHENOAGE_BIOMARKERS = (
    ("albumin_gL", "白蛋白", "g/L"),
    ("creat_umol", "肌酐", "µmol/L"),
    ("glucose_mmol", "血糖", "mmol/L"),
    ("crp_mg_dl", "C反应蛋白", "mg/dL"),
    ("lymph_pct", "淋巴细胞百分比", "%"),
    ("mcv_fl", "平均红细胞体积", "fL"),
    ("rdw_pct", "红细胞分布宽度", "%"),
    ("alp_u_l", "碱性磷酸酶", "U/L"),
    ("wbc_10e3", "白细胞", "10^3/µL"),
)
