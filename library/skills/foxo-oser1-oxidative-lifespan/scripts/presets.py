"""Song et al., Nature Communications 2024. Supplementary Tables 5 and 6."""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Supplementary Table 4: number of long-lived individuals.
COHORT_MARKER = "863"

TITLE = "氧化应激响应蛋白的长寿变异"
LEAD = "下面只核对你点到的 OSER1 基因名或 rs 编号。比值比不乘成你的分数。"
CAN = "对上的名字写在方法名单里。补充表 6 的方向是次要等位基因与长寿组同向，不是你的剂量得分。"
CANNOT = [
    "不能按次要等位基因剂量计算你的长寿比值。",
    "缺的是个人评分用的权重列和截距列。补充表 6 的比值比、标准误和 P 值是队列统计，没有拿来相乘。",
]

SIG = (
    "补充表 6 把这个变异放进长寿关联，并且它落在正文所说、达到更严阈值的那一个连锁群。"
    "次要等位基因与长寿组同向。这不是你的分数。"
)
NOM = (
    "补充表 6 把这个变异放进名义上相关的另一个连锁群。"
    "次要等位基因与长寿组同向。这不是你的分数。"
)
TESTED = "补充表 5 收录了这个 OSER1 变异。补充表 6 没有把它列入长寿关联。"

ITEMS = (
    {"id": "rs1474753", "line": f"rs1474753。{SIG}"},
    {"id": "rs6031460", "line": f"rs6031460。{SIG}"},
    {"id": "rs6031450", "line": f"rs6031450。{NOM}"},
    {"id": "rs6073366", "line": f"rs6073366。{NOM}"},
    {"id": "rs9875", "line": f"rs9875。{NOM}"},
    {"id": "rs6073369", "line": f"rs6073369。{NOM}"},
    {"id": "rs13044950", "line": f"rs13044950。{NOM}"},
    {"id": "rs6031449", "line": f"rs6031449。{TESTED}"},
    {"id": "rs8268", "line": f"rs8268。{TESTED}"},
    {"id": "rs9346", "line": f"rs9346。{TESTED}"},
    {"id": "rs11274", "line": f"rs11274。{TESTED}"},
    {"id": "rs1971447", "line": f"rs1971447。{TESTED}"},
    {"id": "rs6103674", "line": f"rs6103674。{TESTED}"},
    {"id": "rs6065709", "line": f"rs6065709。{TESTED}"},
    {"id": "rs4519596", "line": f"rs4519596。{TESTED}"},
    {"id": "rs4372972", "line": f"rs4372972。{TESTED}"},
    {"id": "rs3817994", "line": f"rs3817994。{TESTED}"},
    {"id": "rs7270729", "line": f"rs7270729。{TESTED}"},
    {"id": "rs7263518", "line": f"rs7263518。{TESTED}"},
    {"id": "rs6130566", "line": f"rs6130566。{TESTED}"},
    {"id": "rs6031453", "line": f"rs6031453。{TESTED}"},
    {"id": "rs6031454", "line": f"rs6031454。{TESTED}"},
    {"id": "rs57634151", "line": f"rs57634151。{TESTED}"},
    {"id": "rs6017287", "line": f"rs6017287。{TESTED}"},
    {"id": "rs2294966", "line": f"rs2294966。{TESTED}"},
    {"id": "rs6017288", "line": f"rs6017288。{TESTED}"},
    {"id": "rs6130568", "line": f"rs6130568。{TESTED}"},
    {"id": "rs2232286", "line": f"rs2232286。{TESTED}"},
    {"id": "rs2232282", "line": f"rs2232282。{TESTED}"},
    {"id": "rs6017289", "line": f"rs6017289。{TESTED}"},
    {"id": "rs956610", "line": f"rs956610。{TESTED}"},
    {"id": "rs1007125", "line": f"rs1007125。{TESTED}"},
    {"id": "rs956609", "line": f"rs956609。{TESTED}"},
    {"id": "rs2235807", "line": f"rs2235807。{TESTED}"},
    {"id": "rs2235806", "line": f"rs2235806。{TESTED}"},
    {"id": "rs2143606", "line": f"rs2143606。{TESTED}"},
    {"id": "rs2143607", "line": f"rs2143607。{TESTED}"},
    {"id": "rs731498", "line": f"rs731498。{TESTED}"},
    {"id": "rs731499", "line": f"rs731499。{TESTED}"},
    {"id": "rs4142441", "line": f"rs4142441。{TESTED}"},
    {"id": "rs3843762", "line": f"rs3843762。{TESTED}"},
    {"id": "rs6031456", "line": f"rs6031456。{TESTED}"},
    {"id": "rs6031458", "line": f"rs6031458。{TESTED}"},
    {"id": "rs16988852", "line": f"rs16988852。{TESTED}"},
    {"id": "rs16988857", "line": f"rs16988857。{TESTED}"},
    {"id": "rs6130569", "line": f"rs6130569。{TESTED}"},
    {"id": "rs73106287", "line": f"rs73106287。{TESTED}"},
    {"id": "rs73106290", "line": f"rs73106290。{TESTED}"},
    {"id": "rs73106293", "line": f"rs73106293。{TESTED}"},
    {
        "id": "OSER1",
        "line": "OSER1。正文点名它是 FOXO 调节的基因，并在蚕、线虫和果蝇里与寿命有关。人类长寿部分要另给补充表 6 里的 rs 编号，基因名本身没有权重。",
    },
    {
        "id": "FOXO1",
        "line": "FOXO1。补充表 3 预测它在 OSER1 启动子上有结合基序。正文没有把 FOXO1 的某个变异写成人类长寿关联。",
    },
    {
        "id": "FOXO3",
        "aliases": ("FOXO3A",),
        "line": "FOXO3。补充表 3 预测它在 OSER1 启动子上有结合基序。正文没有把 FOXO3 的某个变异写成人类长寿关联。",
    },
    {
        "id": "FOXO4",
        "line": "FOXO4。补充表 3 预测它在 OSER1 启动子上有结合基序。正文没有把 FOXO4 的某个变异写成人类长寿关联。",
    },
    {
        "id": "FOXO6",
        "line": "FOXO6。补充表 3 预测它在 OSER1 启动子上有结合基序。正文没有把 FOXO6 的某个变异写成人类长寿关联。",
    },
)

BY_ID = {item["id"]: item for item in ITEMS}
ALIASES = {}
for item in ITEMS:
    for name in (item["id"], *item.get("aliases", ())):
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
