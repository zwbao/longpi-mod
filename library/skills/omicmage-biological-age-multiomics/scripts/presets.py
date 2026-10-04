BOUNDARY = '这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。'

EMR_SCALE = 9.70296
EMR_OFFSET = 51.68254
TRAIN_N = 21885
TEST_N = 9379
TEST_RHO = 0.76
MORTALITY_HR_TEST = 4.53
DNAM_CPG = 1097
DNAM_MAE_TRAIN = 8.33
DNAM_MAE_TEST = 8.50

def emr_age(linear_predictor: float) -> float:
    return EMR_SCALE * linear_predictor + EMR_OFFSET

# Fig. 4 panel sizes printed in the figure. Blank bullets were not filled in.
FIG4_PROTEIN_PANEL = 16
FIG4_METABOLITE_PANEL = 14
FIG4_CLINICAL_PANEL = 10

# Clinical column recovered 9 of 10. Protein column recovered 13 unique names
# after dropping a repeated PON1 line, a repeated CPB2 line, and blank bullets.
# Albumin is listed once: it appears in both the protein column and as liver albumin.
CLINICAL = (
    "bun", "creatinine", "albumin", "hba1c", "rdw",
    "hemoglobin", "glucose", "hematocrit", "alp",
)
PROTEINS = (
    "vcan", "pon1", "igfbp2", "h2bc12", "bmp1", "chrdl1", "itih3",
    "cpb2", "mxra5", "rnase1", "albumin", "st13", "mimecan",
)
METABOLITES = (
    "hpag", "gluconate", "carotene_diol", "n_acetyl_isoputreanine",
    "vanillactate", "androsterone_sulfate", "stearoyl_adrenoyl_gpc",
    "phenylacetylglutamine", "ureidopropionate", "cystine", "uridine",
    "methoxyphenol_sulfate", "ribitol", "margaroyl_gpe",
)

RETAINED = [
    ("bun", "尿素氮"),
    ("creatinine", "肌酐"),
    ("albumin", "白蛋白"),
    ("hba1c", "糖化血红蛋白"),
    ("rdw", "红细胞分布宽度"),
    ("hemoglobin", "血红蛋白"),
    ("glucose", "葡萄糖"),
    ("hematocrit", "红细胞压积"),
    ("alp", "碱性磷酸酶"),
    ("vcan", "多功能蛋白聚糖核心蛋白"),
    ("pon1", "血清对氧磷酶"),
    ("igfbp2", "胰岛素样生长因子结合蛋白2"),
    ("h2bc12", "组蛋白H2B 1-K型"),
    ("bmp1", "骨形态发生蛋白1"),
    ("chrdl1", "脊索蛋白样蛋白1"),
    ("itih3", "间α胰蛋白酶抑制重链H3"),
    ("cpb2", "羧肽酶B2"),
    ("mxra5", "基质重塑相关蛋白5"),
    ("rnase1", "胰核糖核酸酶"),
    ("st13", "Hsc70相互作用蛋白"),
    ("mimecan", "骨甘蛋白"),
    ("hpag", "4-羟苯乙酰谷氨酰胺"),
    ("gluconate", "葡萄糖酸"),
    ("carotene_diol", "胡萝卜素二醇"),
    ("n_acetyl_isoputreanine", "N-乙酰异腐胺"),
    ("vanillactate", "香草乳酸"),
    ("androsterone_sulfate", "雄酮硫酸盐"),
    ("stearoyl_adrenoyl_gpc", "1-硬脂酰-2-肾上腺酰-GPC"),
    ("phenylacetylglutamine", "苯乙酰谷氨酰胺"),
    ("ureidopropionate", "3-脲基丙酸"),
    ("cystine", "胱氨酸"),
    ("uridine", "尿苷"),
    ("methoxyphenol_sulfate", "4-甲氧基苯酚硫酸盐"),
    ("ribitol", "核糖醇"),
    ("margaroyl_gpe", "1-十七烷酰-GPE"),
]

ALIASES = {
    "尿素氮": "bun", "bun": "bun", "血尿素氮": "bun",
    "肌酐": "creatinine", "creatinine": "creatinine",
    "白蛋白": "albumin", "albumin": "albumin", "肝白蛋白": "albumin",
    "糖化血红蛋白": "hba1c", "hba1c": "hba1c",
    "红细胞分布宽度": "rdw", "rdw": "rdw",
    "血红蛋白": "hemoglobin", "hemoglobin": "hemoglobin",
    "葡萄糖": "glucose", "glucose": "glucose",
    "红细胞压积": "hematocrit", "hematocrit": "hematocrit",
    "碱性磷酸酶": "alp", "alp": "alp",
    "多功能蛋白聚糖": "vcan", "versican": "vcan", "vcan": "vcan",
    "pon1": "pon1", "igfbp2": "igfbp2", "bmp1": "bmp1",
    "h2bc12": "h2bc12", "hist1h2bk": "h2bc12",
    "chrdl1": "chrdl1", "q9bu40": "chrdl1",
    "itih3": "itih3", "cpb2": "cpb2", "mxra5": "mxra5",
    "rnase1": "rnase1", "st13": "st13",
    "骨甘蛋白": "mimecan", "mimecan": "mimecan", "ogn": "mimecan",
    "胱氨酸": "cystine", "尿苷": "uridine", "核糖醇": "ribitol",
    "vanillactate": "vanillactate", "phenylacetylglutamine": "phenylacetylglutamine",
    "carotene diol": "carotene_diol", "n-acetyl-isoputreanine": "n_acetyl_isoputreanine",
    "胡萝卜素二醇": "carotene_diol", "香草乳酸": "vanillactate",
    "苯乙酰谷氨酰胺": "phenylacetylglutamine",
    "3-脲基丙酸": "ureidopropionate",
    "bmi": "bmi", "dbp": "dbp", "alt": "alt", "ast": "ast",
    "eosinophil": "eosinophil", "neutrophil": "neutrophil",
    "platelet": "platelet", "血小板": "platelet",
    "triglyceride": "triglyceride", "charlson": "charlson",
    "smoking": "smoking", "吸烟": "smoking",
}

AOU_INPUTS = (
    "bmi", "dbp", "albumin", "alt", "alp", "ast", "eosinophil", "rdw",
    "glucose", "hematocrit", "neutrophil", "platelet", "triglyceride", "bun",
    "charlson", "smoking",
)
