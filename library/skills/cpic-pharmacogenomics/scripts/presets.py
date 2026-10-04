"""What this skill reads from a consumer genotype file, and which CPIC drugs it covers.

Every allele function, phenotype rule and drug recommendation comes from the
CPIC database snapshot in ../data/cpic_tables.json (CC0 1.0, built by
build_cpic_tables.py). This module only chooses:

- ARRAY_PANEL: for each gene that can be read from array data, the CPIC alleles
  looked for and the rsIDs that define them. An allele is listed only when every
  position that tells it apart from the reference is a single-base change that
  consumer arrays commonly report. Alleles defined by insertions, deletions,
  repeats, copy number or hybrid genes are not looked for.
- NOT_FROM_ARRAY: genes CPIC uses that array data cannot type.
- DRUGS: the CPIC guideline drugs this skill reports, with Chinese names.

Nothing here is a dose.
"""

from __future__ import annotations

DOI = "10.1038/gim.2016.87"

BOUNDARY = (
    "这是按 CPIC 公开指南对照基因型的查表结果，不是处方，也不是诊断。"
    "不要因为这份报告自己开始、停用或改变任何药物的用量；"
    "用药前请把这份结果给开药的医生或药师看。"
    "芯片只测了少数位点，「没测到变异」不等于没有变异。"
)

DOCTOR_LINE = "用药前请把这份结果给开药的医生或药师看。"

# Genes read from the array. "sites" are rsIDs in the order shown in the report.
# "alleles" are CPIC allele names (as in the CPIC allele definition tables).
# "reference_label" is how the no-variant haplotype is shown; CPIC's own
# reference allele name is in the data file.
ARRAY_PANEL = {
    "CYP2C19": {
        "sites": ["rs4244285", "rs4986893", "rs28399504", "rs12248560"],
        "alleles": ["*2", "*3", "*4", "*17"],
        "reference_label": "*1",
    },
    "CYP2C9": {
        "sites": ["rs1799853", "rs1057910", "rs72558187"],
        "alleles": ["*2", "*3", "*13"],
        "reference_label": "*1",
    },
    "TPMT": {
        "sites": ["rs1800462", "rs1800460", "rs1142345"],
        "alleles": ["*2", "*3A", "*3B", "*3C"],
        "reference_label": "*1",
    },
    "NUDT15": {
        "sites": ["rs116855232"],
        "alleles": ["*3"],
        "reference_label": "*1",
    },
    "DPYD": {
        "sites": ["rs3918290", "rs55886062", "rs67376798", "rs75017182", "rs56038477"],
        "alleles": [
            "c.1905+1G>A (*2A)",
            "c.1679T>G (*13)",
            "c.2846A>T",
            "c.1129-5923C>G",
            "c.1129-5923C>G, c.1236G>A (HapB3)",
        ],
        "reference_label": "*1",
    },
    "CYP3A5": {
        "sites": ["rs776746", "rs10264272"],
        "alleles": ["*3", "*6"],
        "reference_label": "*1",
    },
    "SLCO1B1": {
        "sites": ["rs4149056"],
        "alleles": ["*5", "*15"],
        "reference_label": "*1",
    },
    "ABCG2": {
        "sites": ["rs2231142"],
        "alleles": ["rs2231142 variant (T)"],
        "reference_label": "G",
    },
}

# Display names for CPIC alleles whose CPIC name is long.
ALLELE_LABELS = {
    "rs2231142 reference (G)": "G",
    "rs2231142 variant (T)": "T",
}

# Shown for warfarin only. CPIC gives no phenotype for these; the warfarin
# guideline puts the genotypes into a dosing algorithm the prescriber runs.
WARFARIN_SITES = {"VKORC1": "rs9923231", "CYP4F2": "rs2108622"}

GENE_ZH = {
    "CYP2C19": "CYP2C19（氯吡格雷、部分胃药和抗抑郁药）",
    "CYP2C9": "CYP2C9（部分止痛药、苯妥英、华法林、氟伐他汀）",
    "TPMT": "TPMT（硫唑嘌呤类免疫抑制药）",
    "NUDT15": "NUDT15（硫唑嘌呤类免疫抑制药）",
    "DPYD": "DPYD（氟尿嘧啶类化疗药）",
    "CYP3A5": "CYP3A5（他克莫司）",
    "SLCO1B1": "SLCO1B1（他汀类降脂药）",
    "ABCG2": "ABCG2（瑞舒伐他汀）",
    "CYP2D6": "CYP2D6（可待因、曲马多、他莫昔芬、部分抗抑郁药和美托洛尔）",
    "HLA-B": "HLA-B（别嘌醇、卡马西平、奥卡西平、苯妥英）",
    "HLA-A": "HLA-A（卡马西平）",
}

# CPIC phenotype terms in plain Chinese.
PHENOTYPE_ZH = {
    "Ultrarapid Metabolizer": "超快代谢型",
    "Rapid Metabolizer": "快代谢型",
    "Normal Metabolizer": "正常代谢型",
    "Likely Intermediate Metabolizer": "可能是中间代谢型",
    "Intermediate Metabolizer": "中间代谢型",
    "Possible Intermediate Metabolizer": "可能是中间代谢型",
    "Likely Poor Metabolizer": "可能是慢代谢型",
    "Poor Metabolizer": "慢代谢型",
    "Increased Function": "功能增强",
    "Normal Function": "功能正常",
    "Decreased Function": "功能下降",
    "Possible Decreased Function": "可能功能下降",
    "Poor Function": "功能很差",
    "Indeterminate": "无法判定",
    "*15:02 positive": "携带 HLA-B*15:02",
    "*15:02 negative": "不携带 HLA-B*15:02",
    "*58:01 positive": "携带 HLA-B*58:01",
    "*58:01 negative": "不携带 HLA-B*58:01",
    "*31:01 positive": "携带 HLA-A*31:01",
    "*31:01 negative": "不携带 HLA-A*31:01",
}

# Genes CPIC uses that array data cannot type, and why. Shown in every report.
NOT_FROM_ARRAY = {
    "CYP2D6": (
        "芯片看不到 CYP2D6 整个基因缺失（*5）、多拷贝（例如 *1x2、*2x2）和与 CYP2D7 的杂合基因"
        "（例如 *36，在中国人里常和 *10 连在一起出现，写作 *36+*10）。"
        "*10 本身的位点也出现在 *4 等别的等位基因里，只看芯片分不开。"
        "所以这里不从芯片判断 CYP2D6。有医院或检测机构的 CYP2D6 检测报告，可以把报告上的结果（例如 *1/*10）交给助手再对照。"
    ),
    "HLA-B": "HLA 分型要专门的检测，芯片上的单个位点不能可靠地判断 HLA-B*58:01、*15:02、*57:01。有检测报告时，可以把报告上的结果交给助手再对照。",
    "HLA-A": "同上，HLA-A*31:01 要专门检测。",
    "UGT1A1": "UGT1A1*28 是一段 TA 重复，芯片一般读不出来，所以不判断。",
    "CYP2B6": "CYP2B6*6 要知道两个位点是否在同一条染色体上，芯片分不开，所以不判断（舍曲林按 CPIC 的「没有结果」一栏查）。",
    "G6PD": "G6PD 在 X 染色体上，致病变异很多且大多罕见，芯片不能判断，这里不涉及。",
}

# Dispatch order in the report: population labels in Chinese.
POPULATION_ZH = {
    "general": "",
    "adults": "成人",
    "CVI ACS PCI": "心血管：急性冠脉综合征或做过冠脉介入（支架）",
    "CVI non-ACS non-PCI": "心血管：其他心血管情况",
    "NVI": "脑血管：缺血性卒中或短暂性脑缺血发作等",
    "PHT naive": "以前没有用过苯妥英",
    "PHT use >3mos": "已经连续用苯妥英超过三个月",
    "CBZ naive": "以前没有用过卡马西平",
    "CBZ use >3mos": "已经连续用卡马西平超过三个月",
    "CBZ-no alternatives": "没有其他可换的药",
    "OXC naive": "以前没有用过奥卡西平",
    "OXC use >3 mos": "已经连续用奥卡西平超过三个月",
}

# Populations not reported: this library is for adults.
SKIP_POPULATIONS = {"pediatrics"}

# CPIC drug name -> Chinese generic name and names people write on a list
# (other generic spellings, common Chinese brand names, English brand names).
DRUGS = {
    "clopidogrel": ("氯吡格雷", ["硫酸氢氯吡格雷", "波立维", "泰嘉", "plavix"]),
    "omeprazole": ("奥美拉唑", ["洛赛克", "losec", "prilosec"]),
    "lansoprazole": ("兰索拉唑", ["达克普隆", "prevacid"]),
    "pantoprazole": ("泮托拉唑", ["潘妥洛克", "pantoloc", "protonix"]),
    "dexlansoprazole": ("右兰索拉唑", ["dexilant"]),
    "voriconazole": ("伏立康唑", ["威凡", "vfend"]),
    "citalopram": ("西酞普兰", ["喜普妙", "celexa"]),
    "escitalopram": ("艾司西酞普兰", ["草酸艾司西酞普兰", "来士普", "lexapro"]),
    "sertraline": ("舍曲林", ["盐酸舍曲林", "左洛复", "zoloft"]),
    "paroxetine": ("帕罗西汀", ["赛乐特", "paxil", "seroxat"]),
    "fluvoxamine": ("氟伏沙明", ["兰释", "luvox"]),
    "venlafaxine": ("文拉法辛", ["怡诺思", "effexor"]),
    "vortioxetine": ("伏硫西汀", ["心达悦", "trintellix", "brintellix"]),
    "amitriptyline": ("阿米替林", ["elavil"]),
    "nortriptyline": ("去甲替林", ["pamelor"]),
    "clomipramine": ("氯米帕明", ["安拿芬尼", "anafranil"]),
    "desipramine": ("地昔帕明", ["norpramin"]),
    "doxepin": ("多塞平", ["多虑平", "sinequan"]),
    "imipramine": ("丙米嗪", ["tofranil"]),
    "trimipramine": ("曲米帕明", ["surmontil"]),
    "celecoxib": ("塞来昔布", ["西乐葆", "celebrex"]),
    "flurbiprofen": ("氟比洛芬", ["ansaid"]),
    "ibuprofen": ("布洛芬", ["芬必得", "advil", "motrin"]),
    "lornoxicam": ("氯诺昔康", []),
    "meloxicam": ("美洛昔康", ["莫比可", "mobic"]),
    "piroxicam": ("吡罗昔康", ["feldene"]),
    "tenoxicam": ("替诺昔康", []),
    "phenytoin": ("苯妥英", ["苯妥英钠", "大仑丁", "dilantin"]),
    "fosphenytoin": ("磷苯妥英", ["cerebyx"]),
    "atorvastatin": ("阿托伐他汀", ["阿托伐他汀钙", "立普妥", "阿乐", "lipitor"]),
    "fluvastatin": ("氟伐他汀", ["来适可", "lescol"]),
    "lovastatin": ("洛伐他汀", ["mevacor"]),
    "pitavastatin": ("匹伐他汀", ["livalo"]),
    "pravastatin": ("普伐他汀", ["普拉固", "pravachol"]),
    "rosuvastatin": ("瑞舒伐他汀", ["瑞舒伐他汀钙", "可定", "crestor"]),
    "simvastatin": ("辛伐他汀", ["舒降之", "zocor"]),
    "azathioprine": ("硫唑嘌呤", ["依木兰", "imuran"]),
    "mercaptopurine": ("巯嘌呤", ["6-巯基嘌呤", "6-mp", "purinethol"]),
    "thioguanine": ("硫鸟嘌呤", ["6-硫鸟嘌呤", "tabloid"]),
    "fluorouracil": ("氟尿嘧啶", ["5-氟尿嘧啶", "5-fu"]),
    "capecitabine": ("卡培他滨", ["希罗达", "xeloda"]),
    "tacrolimus": ("他克莫司", ["普乐可复", "prograf"]),
    "codeine": ("可待因", ["磷酸可待因"]),
    "tramadol": ("曲马多", ["盐酸曲马多", "奇曼丁", "ultram"]),
    "hydrocodone": ("氢可酮", ["vicodin"]),
    "tamoxifen": ("他莫昔芬", ["三苯氧胺", "诺瓦得士", "nolvadex"]),
    "metoprolol": ("美托洛尔", ["酒石酸美托洛尔", "琥珀酸美托洛尔", "倍他乐克", "betaloc", "lopressor"]),
    "allopurinol": ("别嘌醇", ["别嘌呤醇", "zyloprim"]),
    "carbamazepine": ("卡马西平", ["得理多", "tegretol"]),
    "oxcarbazepine": ("奥卡西平", ["曲莱", "trileptal"]),
    "warfarin": ("华法林", ["华法林钠", "coumadin"]),
}

# CPIC guideline ids (api.cpicpgx.org guideline.id) whose drugs are reported.
GUIDELINE_IDS = [
    100411,  # CYP2C19 and Clopidogrel
    110076,  # CYP2C19 and Proton Pump Inhibitors
    100410,  # CYP2C19 and Voriconazole
    100413,  # SSRIs/SNRIs
    100414,  # Tricyclic antidepressants
    110058,  # CYP2C9 and NSAIDs
    100412,  # CYP2C9, HLA-B and Phenytoin
    100426,  # SLCO1B1, ABCG2, CYP2C9 and Statins
    100428,  # TPMT, NUDT15 and Thiopurines
    100419,  # DPYD and Fluoropyrimidines
    100418,  # CYP3A5 and Tacrolimus
    100416,  # CYP2D6, OPRM1, COMT and Opioids
    100415,  # CYP2D6 and Tamoxifen
    5290480,  # CYP2D6 ... and Beta-Blockers
    100422,  # HLA-B and Allopurinol
    100423,  # HLA-A, HLA-B and Carbamazepine and Oxcarbazepine
    100425,  # CYP2C9, VKORC1, CYP4F2 and Warfarin (flow chart, no table rows)
]

# The guideline paper for each CPIC guideline id (the current version).
GUIDELINE_DOI = {
    100411: "10.1002/cpt.2526",
    110076: "10.1002/cpt.2015",
    100410: "10.1002/cpt.583",
    100413: "10.1002/cpt.2903",
    100414: "10.1002/cpt.597",
    110058: "10.1002/cpt.1830",
    100412: "10.1002/cpt.2008",
    100426: "10.1002/cpt.2557",
    100428: "10.1002/cpt.70209",
    100419: "10.1002/cpt.911",
    100418: "10.1002/cpt.113",
    100416: "10.1002/cpt.2149",
    100415: "10.1002/cpt.1007",
    5290480: "10.1002/cpt.3351",
    100422: "10.1002/cpt.161",
    100423: "10.1002/cpt.1004",
    100425: "10.1002/cpt.668",
}

CATEGORY_ZH = {
    "avoid": "CPIC 建议考虑换药或避免使用",
    "caution": "CPIC 建议调整用法或加强监测",
    "standard": "CPIC 认为可以按常规用法",
    "none": "CPIC 对这个结果没有给出推荐",
}

# Warfarin: CPIC 2017 (doi:10.1002/cpt.668) gives a flow chart, not table
# rows. For people not of African ancestry it says to calculate the dose with
# a validated pharmacogenetic algorithm that includes VKORC1-1639G>A and
# CYP2C9*2 and *3. That is the prescriber's calculation; this skill does not do it.
WARFARIN_ZH = (
    "CPIC 华法林指南（2017）是流程图：医生用包含 CYP2C9 和 VKORC1 基因型的剂量公式定起始剂量，"
    "用药后仍按凝血指标（INR）调整。这里不算剂量。"
)
