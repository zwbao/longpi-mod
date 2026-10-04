"""Oral microbiome OMAA, doi:10.1038/s41467-026-72096-2. PMC13347023."""

from __future__ import annotations

BOUNDARY = '这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。'

TOTAL_N = 4675
DISCOVERY_N = 2029
VALIDATION_N = 2646
EXTERNAL_N = 1293
GENERA = 64
EXTERNAL_GENERA = 37
DISC_RHO = 0.44
DISC_MAE = 8.69
VAL_RHO = 0.35
VAL_MAE = 9.16
EXT_RHO = 0.22
EXT_MAE = 12.63
MORT_HR = 1.05
FRAIL_OR = 1.05
EGFR_BETA = -0.066
CANCER_AUC_WITH = 0.70
CANCER_AUC_WITHOUT = 0.67
MI_AUC_WITH = 0.79
MI_AUC_WITHOUT = 0.76
AGE_MIN = 30
AGE_MAX = 70
FI_FRAIL = 0.25
STOMATOBACULUM_EDF = 5.17
ORIBACTERIUM_EDF = 4.28
CLOP_DISC_USERS = 43
CLOP_DISC_NONUSERS = 1986
CLOP_VAL_USERS = 32
CLOP_VAL_NONUSERS = 2614
WEIGHTS_PRESENT = False

MEDICINES = {
    "氯吡格雷": "氯吡格雷",
    "clopidogrel": "氯吡格雷",
    "阿替洛尔": "阿替洛尔",
    "atenolol": "阿替洛尔",
    "赖诺普利": "赖诺普利",
    "lisinopril": "赖诺普利",
}

AGE_GENERA = (
    'Alloscardovia',
    'Bifidobacterium',
    'Parascardovia',
    'Corynebacterium_1',
    'Rothia',
    'Unclassified_78',
    'Coprobacter',
    'Unclassified_81',
    'Prevotella_2',
    'Prevotella_6',
    'Unclassified_96',
    'Unclassified_110',
    'Incertae_Sedis',
    'Unclassified_175',
    '[Eubacterium]_brachy_group',
    'Stomatobaculum',
    'Peptococcus',
    'Filifactor',
    'Peptoclostridium',
    'Ruminococcaceae_UCG-002',
    'Ruminococcus_2',
    'Bulleidia',
    'Veillonella',
    'Actinobacillus',
    'Treponema_2',
    'Fretibacterium',
    'Mycoplasma',
    'Akkermansia',
    'Granulicatella',
    'Alloprevotella',
    'Lactobacillus',
    'Stenotrophomonas',
    'Lachnoanaerobaculum',
    'Dialister',
    'Acinetobacter',
    'Streptococcus',
    'Faecalibacterium',
    'Actinomyces',
    'Unclassified_357',
    'Eikenella',
    'Unclassified_332',
    'Pseudomonas',
    'Unclassified_105',
    'Megasphaera',
    'Unclassified_191',
    'Peptostreptococcus',
    'Unclassified_73',
    'Atopobium',
    'Unclassified_277',
    'Capnocytophaga',
    'Oribacterium',
    'Leptotrichia',
    'Prevotella_7',
    'Gemella',
    'Defluviitaleaceae_UCG-011',
    'Unclassified_259',
    'Scardovia',
    'Streptobacillus',
    'Lautropia',
    'Solobacterium',
    'Unclassified_205',
    'Unclassified_140',
    'Neisseria',
    'Selenomonas_3',
)
