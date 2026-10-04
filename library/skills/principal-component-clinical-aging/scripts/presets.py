BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Methods, NHANES IV. Training wave 1999-2000. Age window 40-84 years.
TRAIN_MALES = 923
TRAIN_FEMALES = 852
TEST_MALES = 1094
TEST_FEMALES = 942
N_PCS = 18
PC_VARIANCE = 0.99
# Fig. 6. Cohort AUCs. Do not treat these as this person's score.
# Fig. 6c, 20-year mortality in the test cohort.
PCAGE_AUC_20Y = 0.8643
LINAGE_AUC_20Y = 0.8655
ASCVD_AUC_20Y = 0.7594
CHRONAGE_AUC_20Y = 0.8289
CFS_AUC_20Y = 0.6585
PHENOAGE_AUC_20Y = 0.8474
# Fig. 6d, NHANES III, 25-year follow-up.
LINAGE_NHANES3_AUC = 0.8741
CHRONAGE_NHANES3_AUC = 0.8590
# Fig. 7, CALinAge in the age range used for CALERIE.
CALINAGE_AUC = 0.8282
CA_CALERIE_AUC = 0.7910
# Fig. 6a, LinAge versus PCAge in the NHANES IV test cohort.
LINAGE_PCAGE_PCC = 0.92
# Fig. 6b, NHANES III.
LINAGE_CA_PCC_MALE = 0.79
LINAGE_CA_PCC_FEMALE = 0.87
NHANES3_MALES = 715
NHANES3_FEMALES = 819
# Methods. NT-proBNP was kept despite this missingness.
NT_PROBNP_MISSING = 0.144
COMORBIDITY_DENOMINATOR = 22
# Methods. Serum cotinine, ng/ml.
COTININE_BINS = (
    (10.0, 0, "不吸烟"),
    (100.0, 1, "轻度吸烟"),
    (200.0, 2, "中度吸烟"),
)
HEAVY_SMOKER_SCORE = 3
# Methods. Urine albumin-to-creatinine ratio, mg/g.
ACR_MICROALBUMINURIA = 30.0

COMORBIDITIES = (
    ("hypertension", "高血压"),
    ("diabetes mellitus", "糖尿病"),
    ("renal impairment", "肾功能损害"),
    ("asthma", "哮喘"),
    ("anemia", "贫血"),
    ("arthritis", "关节炎"),
    ("coronary heart disease", "冠心病"),
    ("angina", "心绞痛"),
    ("previous myocardial infarction", "既往心肌梗死"),
    ("previous stroke", "既往卒中"),
    ("emphysema", "肺气肿"),
    ("thyroid disease", "甲状腺疾病"),
    ("obesity", "肥胖"),
    ("chronic bronchitis", "慢性支气管炎"),
    ("liver disease", "肝病"),
    ("malignancy", "恶性肿瘤"),
    ("osteoporosis", "骨质疏松"),
    ("previous hip fracture", "既往髋部骨折"),
    ("previous wrist fracture", "既往腕部骨折"),
    ("previous spine fracture", "既往脊柱骨折"),
    ("cognitive impairment", "认知损害"),
    ("overnight hospitalization", "过夜住院"),
)


def smoking_score(cotinine_ng_ml: float) -> tuple[int, str]:
    for upper, score, label in COTININE_BINS:
        if cotinine_ng_ml < upper:
            return score, label
    return HEAVY_SMOKER_SCORE, "重度吸烟"


def self_health_index(fair: float, poor: float, better: float, worse: float) -> float:
    # Methods: ((fair x 2) + (poor x 4)) x (1 - (better x 0.5) + worse)
    return ((fair * 2.0) + (poor * 4.0)) * (1.0 - (better * 0.5) + worse)


def comorbidity_index(present: list[str]) -> tuple[float, list[str]]:
    known = {key: label for key, label in COMORBIDITIES}
    aliases = {}
    for key, label in COMORBIDITIES:
        aliases[key] = key
        aliases[label] = key
    picked = []
    for item in present:
        key = aliases.get(item.strip().lower()) or aliases.get(item.strip())
        if key is None:
            continue
        if key not in picked:
            picked.append(key)
    ordered = [key for key, _label in COMORBIDITIES if key in picked]
    return len(ordered) / COMORBIDITY_DENOMINATOR, ordered
