"""Brandhorst et al., Nature Communications 2024, doi:10.1038/s41467-024-45260-9. PMC10879164. Fig. 3A and Table S3 prose."""

from __future__ import annotations

BOUNDARY = '这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。'

NHANES_N = 10519
COMPLETERS = 52
MEDIAN_DECREASE_NEARLY = 2.5
MEAN_DECREASE_ABOUT = 1.5
MODAL_DECREASE_JUST_OVER = 3.5
CONTROL_N = 19
CONTROL_MEAN_INCREASE = 0.78
CONTROL_SD = 3.57
SECOND_TRIAL_MEDIAN_DECREASE = 2.7
POOLED_N = 86
POOLED_MEDIAN_DECREASE = 2.6
AT_RISK_BASELINE = 43.3
AT_RISK_FOLLOWUP = 40.4
LE_BASELINE = 82.93
LE_FOLLOWUP = 83.73
BMI_AT_RISK = 25
GLUCOSE_AT_RISK = 99
WEIGHTS_PRESENT = True

BIOMARKERS = (
    "白蛋白",
    "碱性磷酸酶",
    "血清肌酐",
    "C反应蛋白",
    "糖化血红蛋白",
    "收缩压",
    "总胆固醇",
)

# Equation 5 in the Zenodo estimation note: change from baseline biological age to the post-cycle value.
CHANGE_INTERCEPT = 0.1017
CHANGE_ON_BIOAGE = -0.1906
CHANGE_ON_AGE = 0.1227
# Supplementary Table 2. Biomarker = q + k * age; s is the biomarker residual RMSE.
# The age-gap variance s_BA^2 in equation 1 is not printed, so these three columns are not turned into a biological age.
KDM = {
    "白蛋白": {"unit": "g/dL", "s": 0.334481, "k": -0.00544, "q": 4.423451},
    "碱性磷酸酶": {"unit": "u/L", "s": 29.44492, "k": 0.443863, "q": 60.44123},
    "血清肌酐": {"unit": "mg/dL", "s": 0.271155, "k": 0.003463, "q": 0.908423},
    "C反应蛋白": {"unit": "mg/dL", "s": 0.615577, "k": 0.004941, "q": 0.179063},
    "糖化血红蛋白": {"unit": "%", "s": 0.943548, "k": 0.017761, "q": 4.5679},
    "收缩压": {"unit": "mmHg", "s": 14.94318, "k": 0.677014, "q": 90.99925},
    "总胆固醇": {"unit": "mg/dL", "s": 40.3238, "k": 0.793224, "q": 170.8787},
}
S_BA_PUBLISHED = False
