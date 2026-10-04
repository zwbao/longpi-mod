"""Numbers named in Firsanov et al., Nature 2025. No invented repair weights."""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Fig. 4. NHEJ frequency is GFP+ / DsRed+.
# Fig. 2 and the transformation section. This paper's fibroblast combinations.
HITS_HUMAN = ("hTERT", "HRAS(G12V)", "SV40 大 T", "SV40 小 T")
HITS_BOWHEAD_AGAR = ("hTERT", "HRAS(G12V)", "SV40 大 T")
HITS_BOWHEAD_CRISPR = ("hTERT", "TP53", "RB1", "HRAS(G12V)")

# Fig. 5 caption. Drosophila coxme / coxph. Not a human score.
LNHR_HUMAN_LIFESPAN = -0.31
LNHR_WHALE_LIFESPAN = -0.29
LNHR_HUMAN_IRRADIATION = -2.0
LNHR_WHALE_IRRADIATION = -0.69

# Data availability. Kept out of the personal report.
BIOPROJECT = "PRJNA1314725"
