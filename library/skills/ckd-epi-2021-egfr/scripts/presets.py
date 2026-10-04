"""Constants of the CKD-EPI 2021 race-free eGFR equations and the KDIGO 2024 categories.

Source [P]: Inker LA, Eneanya ND, Coresh J, et al. New creatinine- and cystatin
C-based equations to estimate GFR without race. N Engl J Med 2021;385:1737-1749,
doi:10.1056/NEJMoa2102953. Table 2 prints every coefficient with the formula

    eGFR = mu x min(Scr/kappa, 1)^a1 x max(Scr/kappa, 1)^a2
              x min(Scys/0.8, 1)^b1 x max(Scys/0.8, 1)^b2 x c^Age x d[if female]

with kappa 0.7 for women and 0.9 for men, Scr in mg/dL and Scys in mg/L.
Supplementary Appendix Table S10 (pp. 63-64) prints the same equations case by
case and the factor 88.4 between mg/dL and umol/L; Table S11 (pp. 65-66) prints
eGFR for simulated patients, which the tests reproduce.

Source [K]: KDIGO 2024 Clinical Practice Guideline for the Evaluation and
Management of Chronic Kidney Disease. Kidney Int 2024;105(4S):S117-S314,
doi:10.1016/j.kint.2023.10.018. Tables 2 and 3 (p. S137) for the GFR and
albuminuria categories, Table 11 (p. S184) for rounding, Figure 13 (p. S197) for
monitoring frequency, Figure 48 (p. S255) for referral, and the practice
points quoted in references/contract.md.

The 2012 cystatin C-only equation (eGFRcys, also printed in [P] Table 2) is not
computed: neither [P] nor its source paper (Inker 2012, doi:10.1056/NEJMoa1114248)
prints a worked eGFRcys value to test against. KDIGO Recommendation 1.1.2.1 says
to stage from eGFRcr-cys when cystatin C is available, which this skill does.
"""

from __future__ import annotations

# [P] Table 2, row "2021 CKD-EPI creatinine (2009 CKD-EPI creatinine fit without race); eGFRcr(AS), new".
CR_2021 = {
    "mu": 142,
    "kappa": {"female": 0.7, "male": 0.9},
    "a1": {"female": -0.241, "male": -0.302},
    "a2": -1.200,
    "age": 0.9938,
    "female": 1.012,
}

# [P] Table 2, row "2021 CKD-EPI creatinine-cystatin C (2012 CKD-EPI creatinine-cystatin C fit
# without race); eGFRcr-cys(AS), new".
CR_CYS_2021 = {
    "mu": 135,
    "kappa": {"female": 0.7, "male": 0.9},
    "a1": {"female": -0.219, "male": -0.144},
    "a2": -0.544,
    "cys_knot": 0.8,
    "b1": -0.323,
    "b2": -0.778,
    "age": 0.9961,
    "female": 0.963,
}

# [P] Table S10 footnote: "To convert serum creatinine from mg/dL to umol/L, multiply by 88.4."
UMOL_L_PER_MG_DL = 88.4

# [P] Table S11 (simulated patients), panel a, eGFRcr (AS) (new), identical for the Black and
# non-Black rows. Keys: (sex, age); values for Scr 0.6, 1, 1.5, 2 mg/dL.
S11_SCR = (0.6, 1.0, 1.5, 2.0)
S11_CR = {
    ("male", 50): (118, 92, 56, 40),
    ("male", 75): (101, 79, 48, 34),
    ("female", 50): (109, 69, 42, 30),
    ("female", 75): (94, 59, 36, 26),
}
# Panel b, eGFRcr-cys (AS) (new), non-Black rows. Keys: (cystatin C mg/L, sex, age).
S11_CR_CYS = {
    (1.0, "male", 50): (98, 88, 70, 60),
    (1.0, "male", 75): (89, 79, 64, 55),
    (1.0, "female", 50): (92, 74, 59, 51),
    (1.0, "female", 75): (84, 67, 54, 46),
    (1.5, "male", 50): (72, 64, 51, 44),
    (1.5, "male", 75): (65, 58, 47, 40),
    (1.5, "female", 50): (67, 54, 43, 37),
    (1.5, "female", 75): (61, 49, 39, 33),
}

# [K] Table 2: GFR categories (ml/min per 1.73 m2). Lower bound, category, KDIGO term, plain Chinese.
GFR_CATEGORIES = (
    (90, "G1", "Normal or high", "正常或偏高"),
    (60, "G2", "Mildly decreased", "轻度下降（相对年轻成人）"),
    (45, "G3a", "Mildly to moderately decreased", "轻到中度下降"),
    (30, "G3b", "Moderately to severely decreased", "中到重度下降"),
    (15, "G4", "Severely decreased", "重度下降"),
    (float("-inf"), "G5", "Kidney failure", "肾衰竭范围"),
)

# [K] Table 3: albuminuria categories, ACR columns "(approximately equivalent)".
# A1 <30 mg/g (<3 mg/mmol); A2 30-300 mg/g (3-30 mg/mmol); A3 >300 mg/g (>30 mg/mmol).
ACR_CUTS = {"mg/g": (30.0, 300.0), "mg/mmol": (3.0, 30.0)}
ALBUMINURIA_TERMS = {
    "A1": ("Normal to mildly increased", "正常到轻度升高"),
    "A2": ("Moderately increased", "中度升高"),
    "A3": ("Severely increased", "重度升高"),
}

# [K] Figure 13: guide to the number of times per year to monitor GFR and albuminuria in people
# with CKD, by GFR category (rows) and albuminuria category (columns A1, A2, A3).
MONITORING_PER_YEAR = {
    "G1": ("1", "1", "3"),
    "G2": ("1", "1", "3"),
    "G3a": ("1", "2", "3"),
    "G3b": ("2", "3", "3"),
    "G4": ("3", "3", "4+"),
    "G5": ("4+", "4+", "4+"),
}

# [K] Table 11: "Reported eGFR levels <60 ml/min per 1.73 m2 should be flagged as being low."
LOW_EGFR = 60
# [K] Figure 48: "eGFR <30 ml/min per 1.73 m2" is a circumstance for referral to specialist kidney care.
REFERRAL_EGFR = 30

# [P] Methods: "All the participants were 18 years of age or older."
MIN_AGE = 18

BOUNDARY = (
    "eGFR 是按一次化验算出的估计值，分档按 KDIGO 2024 指南。一次结果不能确定有没有慢性肾脏病，"
    "是否患病、要不要用药或调整药量，由医生结合复查和其他检查判断。"
)
