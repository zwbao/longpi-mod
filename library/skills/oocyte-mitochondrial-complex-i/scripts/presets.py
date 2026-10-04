"""Stage calls printed in Rodríguez-Nuevo et al., Nature 2022.

Fig. 4 and Fig. 5 state assembly and rotenone survival. Supplementary Table 1
is replicate abundance, not a personal coefficient.
"""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Fig. 1d text: early oocytes dying after menadione. Cohort result, not a personal score.
MENADIONE_DEATH_PERCENT = "78.3"

# Supplementary Table 1 columns that were opened. There is no intercept.
SUPPLEMENT_COLUMNS = (
    "Description",
    "Gene Names",
    "Unique Peptides",
    "Abundances: Stage I, replicate 1",
    "Abundances: Stage I, replicate 2",
    "Abundances: Stage I, replicate 3",
    "Abundances: Stage VI, replicate 1",
    "Abundances: Stage VI, replicate 2",
    "Abundances: Stage VI, replicate 3",
    "Abundances: Muscle, replicate 1",
    "Abundances: Muscle, replicate 2",
    "Abundances: Muscle, replicate 3",
)

STAGES = {
    "I": "图 4 和图 5 写 I 期复合体一没有组装，也没有胶内活性，鱼藤酮里过夜仍存活。",
    "II": "图 5 写 II 期复合体一活性几乎测不到，鱼藤酮里过夜仍存活。",
    "III": "图 5 写 III 期复合体一活性升到平台，鱼藤酮里过夜不能存活。",
    "VI": "图 4 和图 5 写 VI 期复合体一已经组装并有活性，鱼藤酮里过夜不能存活。",
}

STAGE_ALIASES = {
    "i": "I",
    "1": "I",
    "stage i": "I",
    "stage1": "I",
    "early": "I",
    "primordial": "I",
    "早期": "I",
    "原始": "I",
    "原始卵泡": "I",
    "ii": "II",
    "2": "II",
    "stage ii": "II",
    "iii": "III",
    "3": "III",
    "stage iii": "III",
    "maturing": "III",
    "vi": "VI",
    "6": "VI",
    "stage vi": "VI",
    "late": "VI",
    "mature": "VI",
    "晚期": "VI",
}

# Fig. 2d: early and late oocytes died after inhibitors of complexes II–V.
COMPLEXES = {
    "I": "复合体一是否必需取决于阶段：早期不靠它存活，晚期则死亡。没有阶段时不能放到某一期。",
    "II": "图 2 写早期和晚期卵母细胞在复合体二抑制剂丙二酸处理后都死亡。",
    "III": "图 2 写早期和晚期卵母细胞在复合体三抑制剂抗霉素 A 处理后都死亡。",
    "IV": "图 2 写早期和晚期卵母细胞在复合体四抑制剂氰化钾处理后都死亡。",
    "V": "图 2 写早期和晚期卵母细胞在复合体五抑制剂处理后都死亡。",
}
