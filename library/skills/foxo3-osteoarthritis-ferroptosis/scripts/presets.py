"""Zhao et al., Nature Communications 2025. Named genes, no coefficients."""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Figure 3 legend: nuclear p53 quantified with n = 15.
COHORT_MARKER = "15"

TITLE = "肥胖骨关节炎里点名的基因"
LEAD = "下面只核对你点到的基因名是否是这篇论文写到的名字。没有系数可乘。"
CAN = "对上的基因写在方法名单里，并照录正文写明的方向。方向不是你的骨关节炎分数。"
CANNOT = [
    "不能计算你的骨关节炎风险或铁死亡分数。",
    "缺的是系数列和人类变异列。这篇论文没有给出可乘到个人基因型上的权重。",
]

ITEMS = (
    {
        "id": "FOXO3",
        "aliases": ("FOXO3A",),
        "line": "FOXO3。正文写向小鼠关节腔送入表达 FOXO3 的慢病毒后，高脂相关的软骨退变减轻。没有人类变异权重。",
    },
    {
        "id": "TP53",
        "aliases": ("P53",),
        "line": "TP53。正文写脂肪酸暴露时软骨细胞里的 p53 升高，并和 AKT、FOXO3 连成一条反应。没有系数列。",
    },
    {
        "id": "AKT1",
        "aliases": ("AKT",),
        "line": "AKT1。正文写 p53 会磷酸化下游 AKT。没有系数列。",
    },
    {
        "id": "COL2A1",
        "aliases": ("COL2A1",),
        "line": "COL2A1。正文写高脂条件下 Col2a1 下降。没有系数列。",
    },
    {
        "id": "MMP13",
        "line": "MMP13。正文写高脂条件下 Mmp13 上升。没有系数列。",
    },
    {
        "id": "GADD45A",
        "line": "GADD45A。正文写软骨细胞过表达 FOXO3 后 Gadd45a 升高。没有系数列。",
    },
    {
        "id": "AIFM2",
        "aliases": ("FSP1",),
        "line": "AIFM2。正文写成熟破骨细胞里铁死亡抑制蛋白 FSP1 下降。没有系数列。",
    },
    {
        "id": "GPX4",
        "line": "GPX4。正文写成熟破骨细胞里 GPX4 下降。没有系数列。",
    },
    {
        "id": "SLC7A11",
        "line": "SLC7A11。正文写成熟破骨细胞里 SLC7A11 下降。没有系数列。",
    },
)

BY_ID = {item["id"]: item for item in ITEMS}
ALIASES = {}
for item in ITEMS:
    for name in (item["id"], *item.get("aliases", ())):
        ALIASES[name.casefold()] = item["id"]
ALIASES["col2a1"] = "COL2A1"
ALIASES["mmp13"] = "MMP13"
ALIASES["gadd45a"] = "GADD45A"
ALIASES["foxo3"] = "FOXO3"
ALIASES["tp53"] = "TP53"
ALIASES["p53"] = "TP53"


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
