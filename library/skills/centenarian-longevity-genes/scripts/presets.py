"""Ying et al., Nature Communications 2024. Supplement signs and prose-named genes."""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Methods: 4,925 unique genes were tested in the gene-level burden analysis.
COHORT_MARKER = "4925"

TITLE = "百岁人群里点名的长寿基因"
LEAD = "下面只核对你点到的基因名。效应估计不乘成你的变异负担。"
CAN = "对上的基因写在方法名单里，并写明它来自补充表还是正文点名。方向不是你的分数。"
CANNOT = [
    "不能计算你的功能丧失变异负担，也不能指出哪些基因在另一队列里得到验证。",
    "缺的是 UK Biobank 验证标记列。补充表 1 有 gene、fdr、c2、estimate，没有这一标记列。图上的加号也没有单独成列。",
]

_TABLE = "补充表 1 里，百岁组这一行的错误发现率低于正文用的阈值，效应估计为负，表示功能丧失变异更少。这不是你的负担分数。"

ITEMS = (
    {"id": "ALG13", "line": f"ALG13。{_TABLE}"},
    {
        "id": "RGP1",
        "line": f"RGP1。{_TABLE}正文把它与 PCNX2、ANO9 并列为多个衰老相关性状上方向一致的长寿基因。",
    },
    {
        "id": "C14orf166",
        "aliases": ("RTRAF", "C14ORF166"),
        "line": f"C14orf166。{_TABLE}补充表基因名是 C14orf166。正文在雷帕霉素相关签名里使用名称 RTRAF。",
    },
    {
        "id": "OPN3",
        "line": f"OPN3。{_TABLE}正文写血液基因表达随年龄变化时点了 OPN3。",
    },
    {"id": "ABCA8", "line": f"ABCA8。{_TABLE}"},
    {"id": "DRC7", "line": f"DRC7。{_TABLE}"},
    {"id": "ITIH2", "line": f"ITIH2。{_TABLE}"},
    {"id": "MYOF", "line": f"MYOF。{_TABLE}"},
    {"id": "IGFN1", "line": f"IGFN1。{_TABLE}"},
    {"id": "TRMT2A", "line": f"TRMT2A。{_TABLE}"},
    {"id": "ERAP2", "line": f"ERAP2。{_TABLE}"},
    {
        "id": "PCNX2",
        "line": "PCNX2。正文把它与 RGP1、ANO9 并列为多个衰老相关性状上方向一致的长寿基因。补充表 1 的百岁组里，这个符号没有落在过阈值的那一组。",
    },
    {
        "id": "ANO9",
        "line": "ANO9。正文把它与 RGP1、PCNX2 并列为多个衰老相关性状上方向一致的长寿基因。补充表 1 里没有 ANO9 这一行。",
    },
    {
        "id": "DYNC1H1",
        "line": "DYNC1H1。正文写它只在寿命这一个性状上看到显著的保护效应，血浆蛋白随年龄的变化也点了它。",
    },
    {
        "id": "GALNT12",
        "line": "GALNT12。正文写它只在极端长寿的高百分位上看到显著的保护效应。",
    },
    {"id": "PKP4", "line": "PKP4。正文写它只在健康寿命上看到显著效应，其他性状没有。"},
    {"id": "ZNF446", "line": "ZNF446。正文写它对寿命相关性状的效应不一致。"},
    {"id": "PLA2G4B", "line": "PLA2G4B。正文写它对寿命相关性状的效应不一致。"},
    {
        "id": "EFNA3",
        "line": "EFNA3。正文写它对寿命相关性状的效应不一致。",
    },
    {
        "id": "ABCF3",
        "line": "ABCF3。正文写它对寿命相关性状的效应不一致，热量限制的签名也点了它。",
    },
    {
        "id": "MLXIP",
        "line": "MLXIP。正文写父母寿命的外显子关联在多重检验后仍点到它，生长激素缺乏的签名也点了它。",
    },
    {
        "id": "BCLAF1",
        "line": "BCLAF1。正文写启动子甲基化随年龄变化时，RGP1 和 BCLAF1 是没有显著变化的例外。",
    },
    {"id": "FLT4", "line": "FLT4。正文写血浆蛋白随年龄的变化点了 FLT4。"},
    {"id": "CKAP2L", "line": "CKAP2L。正文写热量限制的签名点了这个基因。"},
    {"id": "CEP68", "line": "CEP68。正文写热量限制的签名点了这个基因。"},
    {"id": "CTNND1", "line": "CTNND1。正文写雷帕霉素处理的签名点了这个基因。"},
    {
        "id": "HOGA1",
        "line": "HOGA1。正文写生长激素缺乏的签名点了它，干预后的寿命签名也点了它。",
    },
    {"id": "ANKRD33", "line": "ANKRD33。正文写生长激素缺乏的签名点了这个基因。"},
)

BY_ID = {item["id"]: item for item in ITEMS}
ALIASES = {}
for item in ITEMS:
    names = (item["id"], *item.get("aliases", ()))
    for name in names:
        ALIASES[name.casefold()] = item["id"]


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
