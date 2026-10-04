"""Seegren et al., Nature Aging 2023. Fig. 1 markers. No age-regression weights."""

from __future__ import annotations

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

TITLE = "# 衰老相关的炎症标志"

# Whole-blood transcriptome count in the abstract. Stays out of the report.
BLOOD_N = 700
FORBIDDEN = "700"
MUST = "MCU"
ABSENT = "ZZZNO"

SAMPLE_MEASUREMENTS = """name,value
MCU,8
CCL4,1.5
ZZZNO,9
"""

INFLAMMATORY = (
    "DUSP2", "CD69", "CCL4", "DUSP5", "AREG", "JUN", "LIF", "ATF3", "NR4A1", "EGR2",
    "RHOB", "VEGFA", "OLR1", "PTGS2", "PLAU", "FOS", "CCL5", "CD83", "EGR1", "PTGER4",
)
CALCIUM = ("MCU", "MICU1")
BINS = (
    (20, 29, "20–29"),
    (30, 39, "30–39"),
    (40, 49, "40–49"),
    (50, 59, "50–59"),
    (60, 69, "60–69"),
)


def norm(text):
    return (
        (text or "")
        .strip()
        .casefold()
        .replace(" ", "")
        .replace("-", "")
        .replace("_", "")
        .replace("–", "")
    )


def _headers(row):
    return {
        (key or "").strip().lower().replace(" ", "").replace("_", ""): (value or "").strip()
        for key, value in row.items()
        if key
    }


def _age_sentence(age):
    if age is None:
        return "没有提供年龄，所以没有对上图一的年龄档。"
    for low, high, label in BINS:
        if low <= age <= high:
            return f"年龄落到图一使用的 {label} 岁这一档。这一档不是分数。"
    return "图一的全血年龄档从 20 岁画到 69 岁。这次的年龄不在这些档里。"


def evaluate(rows, age):
    found = {}
    for row in rows:
        keys = _headers(row)
        name = keys.get("name") or keys.get("item") or keys.get("gene") or keys.get("项目") or ""
        value = keys.get("value") or keys.get("结果") or keys.get("expression") or ""
        if name:
            found[norm(name)] = value
    items = []
    med_names = []
    for display in CALCIUM:
        med_names.append(display)
        value = found.get(norm(display), "")
        sentence = "正文写它与年龄反向相关。图里没有印出斜率列和截距列，所以不算年龄残差。"
        if value:
            items.append(f"{display}。你给的数是 {value}。{sentence}")
        else:
            items.append(f"{display}。这次没有这个数。{sentence}")
    for display in INFLAMMATORY:
        med_names.append(display)
        value = found.get(norm(display), "")
        sentence = "图一的热图把这个基因画在年长者全血里更高的一边。没有系数。"
        if value:
            items.append(f"{display}。你给的数是 {value}。{sentence}")
        else:
            items.append(f"{display}。这次没有这个数。{sentence}")
    intro = _age_sentence(age) + "这次只照录图一点名的炎症标志和两个钙转运基因。"
    can = "你交来的基因会带上图一里的方向。没有交的数会写明这次没有这个数。"
    cannot = (
        "不能计算炎症年龄。缺 MCU 对年龄的斜率列和截距列，也缺 MICU1 的这两列。"
        "打开的补充表是钙成像曲线，列是时间和处理，不是回归系数。"
    )
    return intro, can, cannot, items, med_names
