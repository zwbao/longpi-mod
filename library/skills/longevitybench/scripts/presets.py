"""Numbers copied from Insilico-org/longeclaw as of main on 2026-06-09.

drugage.py and control_laws.py read these constants. Do not restate them in
SKILL.md or in the report headings.
"""

from __future__ import annotations

# longevityclaw/drugage.py score_compound
BASE_POSITIVE_DIVISOR = 100.0
BASE_NEGATIVE_DIVISOR = 50.0
SPECIES_BONUS_PER = 0.05
SPECIES_BONUS_CAP = 0.2
ITP_BONUS = 0.15
CONSISTENCY_WEIGHT = 0.1
SCORE_FLOOR = 0.0
SCORE_CEILING = 1.0
RANK_MIN_STUDIES = 2
TOP_STUDIES_KEPT = 5

# Snapshot of data/drugage/drugage.csv in that repository.
DRUGAGE_URL = (
    "https://raw.githubusercontent.com/Insilico-org/longeclaw/main/data/drugage/drugage.csv"
)
DRUGAGE_SHA256 = "7ed9771440fa4e1e30be0d3c8e92d919254b572ab40c81e2440ba78c885401d4"
DRUGAGE_DATA_ROWS = 3423
DRUGAGE_COMPOUNDS = 1046
DRUGAGE_RANKED_MIN2 = 599
DRUGAGE_ITP_COMPOUNDS = 54
# score_compound("Rapamycin") on that snapshot, rounded to 4 decimals in the source.
RAPAMYCIN_SCORE = 0.5411
RAPAMYCIN_STUDIES = 37
RAPAMYCIN_SPECIES = 3
RAPAMYCIN_MEAN_CHANGE = 14.38

# longevityclaw/control_laws.py
HALLMARKS = [
    "genomic_instability",
    "telomere_attrition",
    "epigenetic_alterations",
    "loss_of_proteostasis",
    "disabled_macroautophagy",
    "deregulated_nutrient_sensing",
    "mitochondrial_dysfunction",
    "cellular_senescence",
    "stem_cell_exhaustion",
    "altered_intercellular_communication",
    "chronic_inflammation",
    "dysbiosis",
]

HALLMARK_WEIGHTS = {
    "genomic_instability": 1.2,
    "telomere_attrition": 1.1,
    "epigenetic_alterations": 1.3,
    "loss_of_proteostasis": 1.0,
    "disabled_macroautophagy": 0.9,
    "deregulated_nutrient_sensing": 1.1,
    "mitochondrial_dysfunction": 1.2,
    "cellular_senescence": 1.4,
    "stem_cell_exhaustion": 1.0,
    "altered_intercellular_communication": 0.8,
    "chronic_inflammation": 1.3,
    "dysbiosis": 0.7,
}

# create_typical_aging_state: 0 at age 20, 1 at age 100.
AGE_ORIGIN = 20.0
AGE_SPAN = 80.0
HALLMARK_RATES = {
    "genomic_instability": 0.8,
    "telomere_attrition": 1.0,
    "epigenetic_alterations": 0.9,
    "loss_of_proteostasis": 0.7,
    "disabled_macroautophagy": 0.6,
    "deregulated_nutrient_sensing": 0.75,
    "mitochondrial_dysfunction": 0.85,
    "cellular_senescence": 0.95,
    "stem_cell_exhaustion": 0.65,
    "altered_intercellular_communication": 0.5,
    "chronic_inflammation": 0.9,
    "dysbiosis": 0.4,
}

# effect * effect * LIE_SCALE. Negative total_interaction is flagged synergistic
# in the source because both effects are negative.
LIE_SCALE = 0.5
DISTANCE_PENALTY = 10.0
DEFAULT_AGE = 50.0
# control_law_analysis(50) on the source module.
AGE_50_CONTROL_COST = 65.851562
AGE_50_SEQUENCE = [
    "caloric_restriction",
    "senolytics_dq",
    "nad_precursors",
    "spermidine",
    "exercise",
    "rapamycin",
]

# name, description, effects, confidence, evidence_level, drug_class, display
INTERVENTIONS = [
    {
        "key": "rapamycin",
        "name": "Rapamycin",
        "display": "雷帕霉素",
        "description": "mTOR inhibitor, extends lifespan in multiple species",
        "effects": {
            "deregulated_nutrient_sensing": -0.3,
            "disabled_macroautophagy": -0.25,
            "cellular_senescence": -0.15,
            "loss_of_proteostasis": -0.1,
        },
        "confidence": 0.8,
        "evidence_level": "clinical",
        "drug_class": "mtor_inhibitor",
    },
    {
        "key": "metformin",
        "name": "Metformin",
        "display": "二甲双胍",
        "description": "AMPK activator, diabetes drug with longevity benefits",
        "effects": {
            "deregulated_nutrient_sensing": -0.2,
            "mitochondrial_dysfunction": -0.15,
            "chronic_inflammation": -0.1,
            "cellular_senescence": -0.1,
        },
        "confidence": 0.75,
        "evidence_level": "clinical",
        "drug_class": "ampk_activator",
    },
    {
        "key": "senolytics_dq",
        "name": "Dasatinib + Quercetin",
        "display": "达沙替尼加槲皮素",
        "description": "Senolytic combination targeting senescent cells",
        "effects": {
            "cellular_senescence": -0.4,
            "chronic_inflammation": -0.2,
            "altered_intercellular_communication": -0.15,
            "stem_cell_exhaustion": -0.1,
        },
        "confidence": 0.7,
        "evidence_level": "clinical",
        "drug_class": "senolytic",
    },
    {
        "key": "nad_precursors",
        "name": "NAD+ Precursors (NMN/NR)",
        "display": "NAD+前体",
        "description": "Boost NAD+ levels, support mitochondrial function",
        "effects": {
            "mitochondrial_dysfunction": -0.2,
            "epigenetic_alterations": -0.1,
            "stem_cell_exhaustion": -0.1,
            "genomic_instability": -0.05,
        },
        "confidence": 0.6,
        "evidence_level": "preclinical",
        "drug_class": "nad_booster",
    },
    {
        "key": "spermidine",
        "name": "Spermidine",
        "display": "亚精胺",
        "description": "Natural polyamine that induces autophagy",
        "effects": {
            "disabled_macroautophagy": -0.25,
            "loss_of_proteostasis": -0.15,
            "mitochondrial_dysfunction": -0.1,
            "epigenetic_alterations": -0.05,
        },
        "confidence": 0.65,
        "evidence_level": "clinical",
        "drug_class": "autophagy_inducer",
    },
    {
        "key": "caloric_restriction",
        "name": "Caloric Restriction",
        "display": "热量限制",
        "description": "30% calorie reduction, robust lifespan extension",
        "effects": {
            "deregulated_nutrient_sensing": -0.35,
            "disabled_macroautophagy": -0.2,
            "mitochondrial_dysfunction": -0.15,
            "chronic_inflammation": -0.15,
            "cellular_senescence": -0.1,
        },
        "confidence": 0.9,
        "evidence_level": "meta-analysis",
        "drug_class": "dietary",
    },
    {
        "key": "exercise",
        "name": "Regular Exercise",
        "display": "规律运动",
        "description": "Moderate aerobic + resistance training",
        "effects": {
            "mitochondrial_dysfunction": -0.2,
            "chronic_inflammation": -0.15,
            "stem_cell_exhaustion": -0.1,
            "loss_of_proteostasis": -0.1,
            "deregulated_nutrient_sensing": -0.1,
        },
        "confidence": 0.95,
        "evidence_level": "meta-analysis",
        "drug_class": "lifestyle",
    },
    {
        "key": "fisetin",
        "name": "Fisetin",
        "display": "非瑟酮",
        "description": "Natural senolytic flavonoid",
        "effects": {
            "cellular_senescence": -0.3,
            "chronic_inflammation": -0.15,
        },
        "confidence": 0.5,
        "evidence_level": "preclinical",
        "drug_class": "senolytic",
    },
]

BOUNDARY = (
    "这是 Longevity Claw 仓库里 DrugAge 已发表寿命实验的回顾性排序，"
    "加上 arXiv:2605.16781 的标志物向量场顺序。"
    "名次低，或名单里没有某个名字，不是停用的理由。"
    "体检不增删这份名单。"
    "它不预测生存，不证明衰老机制，也不构成开始或停用任何药物的理由。"
)
