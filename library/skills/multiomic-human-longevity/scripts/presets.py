"""Mavromatis et al., Nature Communications 2023. Table 1 and Table 2 signs only."""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Table 1 note: Bonferroni threshold uses 0.05/37,917 cross-tissue features.
COHORT_MARKER = "37917"

TITLE = "多组学表观年龄里点名的基因"
LEAD = "下面只核对你点到的基因名是否出现在正文表 1 或表 2，并照录表上的正负号。"
CAN = "对上的基因写在方法名单里。正负号是队列统计的方向，不是你的分数。"
CANNOT = [
    "不能计算你的表观遗传年龄或长寿评分。",
    "缺的是可以乘到这个人身上的权重列和截距列。已打开的 Supplementary Data 1 有 TWAS Z-score，Data 6 有 Joint Beta，Data 13 有 Beta。这些是队列统计，没有截距列，没有拿来相乘。",
]

ITEMS = (
    {"id": "ZNF37A", "line": "ZNF37A。表 1：Hannum 年龄加速，TWAS Z 为正。"},
    {"id": "FLOT1", "line": "FLOT1。表 1：Hannum 年龄加速，TWAS Z 为负。正文把这个基因标为新的高置信基因。"},
    {"id": "KPNA4", "line": "KPNA4。表 1：Hannum 年龄加速，TWAS Z 为负。正文把这个基因标为新的高置信基因。"},
    {"id": "ZNF248", "line": "ZNF248。表 1：Hannum 年龄加速，TWAS Z 为正。"},
    {"id": "ENSG00000245156", "line": "ENSG00000245156。表 1：Hannum 年龄加速，TWAS Z 为负。"},
    {"id": "SESN1", "line": "SESN1。表 1：GrimAge 年龄加速，TWAS Z 为负。"},
    {"id": "ENSG00000272540", "line": "ENSG00000272540。表 1：GrimAge 年龄加速，TWAS Z 为正。"},
    {"id": "CD46", "line": "CD46。表 1：内在表观遗传年龄加速，TWAS Z 为负。"},
    {
        "id": "TPMT",
        "line": (
            "TPMT。表 1：内在表观遗传年龄加速，TWAS Z 为负；表 1：表型年龄加速，TWAS Z 为负；"
            "表 2：表型年龄加速，药物靶点孟德尔随机化的 beta 为正。"
            "正文写它加速表型年龄和内在表观遗传年龄加速。"
        ),
    },
    {"id": "TNKS1BP1", "line": "TNKS1BP1。表 1：内在表观遗传年龄加速，TWAS Z 为正。"},
    {"id": "RPN1", "line": "RPN1。表 1：内在表观遗传年龄加速，TWAS Z 为正。"},
    {"id": "AKIRIN1", "line": "AKIRIN1。表 1：内在表观遗传年龄加速，TWAS Z 为正。"},
    {"id": "TMEM121B", "line": "TMEM121B。表 1：内在表观遗传年龄加速，TWAS Z 为正。"},
    {
        "id": "NHLRC1",
        "line": (
            "NHLRC1。表 1：内在表观遗传年龄加速，TWAS Z 为负；表 1：表型年龄加速，TWAS Z 为负；"
            "表 2：内在表观遗传年龄加速，药物靶点孟德尔随机化的 beta 为负。"
            "正文写它减慢内在表观遗传年龄加速。"
        ),
    },
    {"id": "TMX2", "line": "TMX2。表 1：内在表观遗传年龄加速，TWAS Z 为正。正文把这个基因标为新的高置信基因。"},
    {"id": "KRT8P12", "line": "KRT8P12。表 1：内在表观遗传年龄加速，TWAS Z 为负。"},
    {"id": "ENSG00000260329", "line": "ENSG00000260329。表 1：内在表观遗传年龄加速，TWAS Z 为正。"},
    {"id": "CYP2J2", "line": "CYP2J2。表 1：表型年龄加速，TWAS Z 为正。"},
    {"id": "PURB", "line": "PURB。表 1：表型年龄加速，TWAS Z 为正。"},
    {"id": "KDM1B", "line": "KDM1B。表 1：表型年龄加速，TWAS Z 为正。"},
    {"id": "DBNDD1", "line": "DBNDD1。表 1：多变量长寿，TWAS Z 为正。"},
    {"id": "TOMM40", "line": "TOMM40。表 1：多变量长寿，TWAS Z 为正。"},
    {"id": "CDKN2B", "line": "CDKN2B。表 1：多变量长寿，TWAS Z 为正。"},
    {"id": "FGD6", "line": "FGD6。表 1：多变量长寿，TWAS Z 为正。"},
    {"id": "FES", "line": "FES。表 1：多变量长寿，TWAS Z 为负。"},
    {"id": "ENSG00000255710", "line": "ENSG00000255710。表 1：多变量长寿，TWAS Z 为正。"},
    {"id": "PHETA1", "line": "PHETA1。表 1：多变量长寿，TWAS Z 为负。"},
    {"id": "NFKB1", "line": "NFKB1。表 2：Hannum 年龄加速，药物靶点孟德尔随机化的 beta 为负。"},
    {"id": "HDGF", "line": "HDGF。表 2：Hannum 年龄加速，药物靶点孟德尔随机化的 beta 为负。"},
    {"id": "LTBR", "line": "LTBR。表 2：表型年龄加速，药物靶点孟德尔随机化的 beta 为正。"},
    {"id": "PSMA4", "line": "PSMA4。表 2：多变量长寿，药物靶点孟德尔随机化的 beta 为负。"},
    {"id": "CASP8", "line": "CASP8。表 2：多变量长寿，药物靶点孟德尔随机化的 beta 为正。"},
    {"id": "VDR", "line": "VDR。表 2：多变量长寿，加权中位数和逆方差加权的 beta 都为正。"},
    {"id": "WNT3", "line": "WNT3。表 2：多变量长寿，药物靶点孟德尔随机化的 beta 为正。"},
    {"id": "PTPN22", "line": "PTPN22。表 2：多变量长寿，药物靶点孟德尔随机化的 beta 为负。"},
    {"id": "CDC25A", "line": "CDC25A。表 2：多变量长寿，药物靶点孟德尔随机化的 beta 为正。"},
    {"id": "CTSK", "line": "CTSK。表 2：多变量长寿，药物靶点孟德尔随机化的 beta 为正。"},
    {
        "id": "C4B",
        "line": "C4B。正文写它加速 Hannum 年龄并降低多变量长寿，同时写明这一关联没有通过共定位，所以不在表 2 里。",
    },
)

BY_ID = {item["id"]: item for item in ITEMS}
ALIASES = {item["id"].casefold(): item["id"] for item in ITEMS}


def method_lines(measurements: dict) -> list[str]:
    seen = []
    for raw in measurements:
        key = ALIASES.get(raw.strip().casefold())
        if key and key not in seen:
            seen.append(key)
    order = {item["id"]: index for index, item in enumerate(ITEMS)}
    seen.sort(key=order.__getitem__)
    return [BY_ID[key]["line"] for key in seen]


def extra_cannot(measurements: dict) -> list[str]:
    if not measurements:
        return ["没有提供基因或变异。"]
    unknown = [raw for raw in measurements if raw.strip().casefold() not in ALIASES]
    if not unknown:
        return []
    shown = "、".join(unknown)
    return [f"这些名字对不上这篇论文点名的基因或变异：{shown}。"]
