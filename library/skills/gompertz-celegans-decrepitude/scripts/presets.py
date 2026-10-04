"""Identities stated in the main text. Fitted Gompertz parameters are not stored here.

doi:10.1038/s41467-026-71780-7. Equation (1) is mu(x) = alpha * exp(beta * x).
The healthspan identity is in the Results: H-span_abs + G-span_abs = lifespan,
and the two relative spans sum to 1. Figure 1a prints illustrative alpha and beta
only as a schematic (0.002 and 0.2), not as fitted cohort parameters.
"""

from __future__ import annotations

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

TITLE = "衰弱期比例"

# Data availability: six trials, all scored individuals. Stays out of the report.
COHORT_N = 8830

MISSING = (
    "不能算死亡概率。已打开的 41467_2026_71780_MOESM4_ESM.xlsx 没有 α 列和 β 列，"
    "列名是 Trial、Cohort、Lifespan (days since L4)、Frequency、Censor、H-span、G-span、P/pIC/pnIC。"
    "41467_2026_71780_MOESM1_ESM.pdf 已打开，共 26 页。"
    "Supplementary Table 1 的说明是各队列寿命和 log-rank 比较，不是 α、β 系数表。"
    "表 1 到表 7 的数字在图片里，没有抽成列。"
    "表 7 的说明是线虫子群体的 β，表 5 的说明是健康期变化对 α、β 的影响。"
    "这些是队列处理效应，不是个人死亡概率。不用图 1a 示意图上的参数去填。"
)


def _num(text: str | None) -> float | None:
    if text is None or text == "":
        return None
    return float(text)


def build(measurements: dict[str, str], age: float | None) -> tuple[str, list[str]]:
    del age
    health = _num(measurements.get("h_span_days", measurements.get("H-span")))
    gero = _num(measurements.get("g_span_days", measurements.get("G-span")))
    items = ["能算的：", ""]
    if health is None or gero is None:
        items.append("没有同时给出健康期天数和衰弱期天数，相对比例不算。")
        lead = "这次没有同时给出两段天数。"
    elif health < 0 or gero < 0:
        items.append("天数里有负数，相对比例不算。")
        lead = "天数不能为负。"
    elif health + gero == 0:
        items.append("两段天数相加是 0，相对比例不算。")
        lead = "两段天数相加是 0。"
    else:
        total = health + gero
        health_rel = health / total
        gero_rel = gero / total
        items.append(f"- 健康期 {health:g} 天，衰弱期 {gero:g} 天，相加是 {total:g} 天。")
        items.append(f"- 相对健康期 {health_rel:.4f}，相对衰弱期 {gero_rel:.4f}。")
        lead = "这次用正文里的恒等式，把两段天数换成占寿命的比例。"
    items.extend(["", "不能算的：", "", MISSING])
    return lead, items
