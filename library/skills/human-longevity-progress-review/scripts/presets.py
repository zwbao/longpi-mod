"""Bonnet et al., Nature Communications 2026. Review with no named gene or variant."""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Abstract: subnational mortality trends, N = 450 regions.
COHORT_MARKER = "450"

TITLE = "人类寿命进展里对得上的基因"
LEAD = "这篇综述只在你点到的名字是它写过的基因或变异时才给出个人读出。"
CAN = "对照结果写在方法名单里。这篇综述没有点名基因或变异，所以名单是空的。"
CANNOT = [
    "不能计算你的预期寿命。",
    "缺的是基因列和变异列。论文报告的是地区预期寿命，没有可核对到一个人身上的基因或变异。",
]

ITEMS = ()
ALIASES = {}


def method_lines(measurements: dict) -> list[str]:
    del measurements
    return []


def extra_cannot(measurements: dict) -> list[str]:
    if not measurements:
        return ["没有提供基因或变异。"]
    shown = "、".join(measurements)
    return [f"这些名字对不上：{shown}。这篇综述没有点名基因或变异。"]
