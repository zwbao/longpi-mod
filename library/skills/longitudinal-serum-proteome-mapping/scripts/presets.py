"""Published counts from Tang et al., Nature Metabolism 2025.

Fig. 5 protein directions and Fig. 6 AUCs. GLMMLasso ids are the stdlog names in analysis_model.R.
"""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

AUC_408 = 0.72
AUC_86 = 0.70
AUC_22 = 0.70
AUC_AGE_SEX_BMI = 0.63
AUC_FULL = 0.72
PHAS_ANY_CHRONIC_LOWER_PERCENT = 72
PHAS_T2D_LOWER_PERCENT = 53
PHAS_DYSLIPIDEMIA_LOWER_PERCENT = 32
PHAS_FATTY_LIVER_LOWER_PERCENT = 53
PHAS_HYPERTENSION_LOWER_PERCENT = 40
A1AT_T2D_LOWER_PERCENT = 30
A1AT_FATTY_LIVER_LOWER_PERCENT = 17
A2GL_T2D_LOWER_PERCENT = 29
A2GL_FATTY_LIVER_LOWER_PERCENT = 17
RF_NTREE = 1000
RF_TOP_MTRY = 3
RF_TOP_N = 22
RF_SEED = 10
AGE_MODEL_IDS = (
    "a0a0b4j1x5",
    "a0a0c4dh34",
    "a6nfn9",
    "o14791",
    "o43866",
    "o95445",
    "p00734",
    "p00739",
    "p00740",
    "p00746",
    "p00747",
    "p00748",
    "p00915",
    "p01009",
    "p01023",
    "p01024",
    "p01031",
    "p01344",
    "p01602",
    "p01619",
    "p01780",
    "p01860",
    "p01871",
    "p01876",
    "p02654",
    "p02671",
    "p02743",
    "p02748",
    "p02749",
    "p02750",
    "p02751",
    "p02760",
    "p02765",
    "p02774",
    "p02775",
    "p02787",
    "p02790",
    "p03952",
    "p04004",
    "p04114",
    "p04180",
    "p04275",
    "p05154",
    "p05155",
    "p05156",
    "p06312",
    "p06727",
    "p08697",
    "p0dji8",
    "p10643",
    "p14151",
    "p15814",
    "p17936",
    "p18428",
    "p19827",
    "p23142",
    "p27169",
    "p33076",
    "p35858",
    "p36955",
    "p43652",
    "p49406",
    "p49908",
    "p51884",
    "p55056",
    "p68871",
    "p69905",
    "q06033",
    "q12756",
    "q15848",
    "q16880",
    "q562r1",
    "q5jvf3",
    "q5u651",
    "q75n90",
    "q8n9b5",
    "q8nce0",
    "q92185",
    "q96ap0",
    "q99684",
    "q9brj2",
    "q9nq79",
    "q9p278",
    "q9p2d8",
    "q9upu7",
    "q9y613",
)

PROTEINS = (
    ("α-1-抗胰蛋白酶", "1 个标准差对应 T2D 风险低 30%、脂肪肝低 17%。Fig. 5。"),
    ("富亮氨酸 α-2-糖蛋白", "1 个标准差对应 T2D 风险低 29%、脂肪肝低 17%。Fig. 5。"),
    ("α-2-巨球蛋白", "正文写它与至少两种衰老相关代谢病有关。Fig. 5 这段没有给出百分比。"),
    ("脂联素", "正文写它与至少两种衰老相关代谢病有关。Fig. 5 这段没有给出百分比。"),
    ("锌指蛋白 Gfi-1", "正文写它与至少两种衰老相关代谢病有关。Fig. 5 这段没有给出百分比。"),
    ("ITIH3", "正文写它与至少两种衰老相关代谢病有关。Fig. 5 这段没有给出百分比。"),
    ("RAIN", "正文写它与至少两种衰老相关代谢病有关。Fig. 5 这段没有给出百分比。"),
    ("玻连蛋白", "正文写它与至少两种衰老相关代谢病有关。Fig. 5 这段没有给出百分比。"),
)
PROTEIN_ALIASES = (
    ("α-1-抗胰蛋白酶", "α-1-抗胰蛋白酶"),
    ("a1at", "α-1-抗胰蛋白酶"),
    ("serpina1", "α-1-抗胰蛋白酶"),
    ("alpha-1-antitrypsin", "α-1-抗胰蛋白酶"),
    ("富亮氨酸 α-2-糖蛋白", "富亮氨酸 α-2-糖蛋白"),
    ("富亮氨酸α-2-糖蛋白", "富亮氨酸 α-2-糖蛋白"),
    ("a2gl", "富亮氨酸 α-2-糖蛋白"),
    ("lrg1", "富亮氨酸 α-2-糖蛋白"),
    ("α-2-巨球蛋白", "α-2-巨球蛋白"),
    ("a2mg", "α-2-巨球蛋白"),
    ("脂联素", "脂联素"),
    ("adipo", "脂联素"),
    ("adiponectin", "脂联素"),
    ("锌指蛋白 gfi-1", "锌指蛋白 Gfi-1"),
    ("gfi1", "锌指蛋白 Gfi-1"),
    ("itih3", "ITIH3"),
    ("rain", "RAIN"),
    ("玻连蛋白", "玻连蛋白"),
    ("vtnc", "玻连蛋白"),
    ("vitronectin", "玻连蛋白"),
)
