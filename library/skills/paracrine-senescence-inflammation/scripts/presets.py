"""Tsuji et al., Nature Aging 2022. Named SASP genes only. No senescence score."""

from __future__ import annotations

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

TITLE = "# 感染后的旁分泌衰老"

# Hamster inoculum in the methods. Stays out of the personal report.
HAMSTER_PFU = 560000
FORBIDDEN = "560000"
MUST = "CDKN2A"
ABSENT = "ZZZNO"

SAMPLE_MEASUREMENTS = """name,value
CDKN2A,1.4
IL8,2
ZZZNO,9
"""

DRUGS = (
    ("依那西普", "这是文中的 TNF 抑制剂，不是给你的剂量。"),
    ("ABT-263", "这是文中在仓鼠和小鼠里用过的衰老细胞清除药，不是给你的剂量。"),
    ("达沙替尼", "这是细胞实验里和槲皮素一起用过的名字，不是给你的剂量。"),
    ("槲皮素", "这是细胞实验里和达沙替尼一起用过的名字，不是给你的剂量。"),
)
DRUG_ALIASES = {
    "依那西普": ("etanercept", "依那西普"),
    "ABT-263": ("abt263", "navitoclax", "abt-263"),
    "达沙替尼": ("dasatinib",),
    "槲皮素": ("quercetin",),
}

MARKERS = (
    ("CDKN2A", ("cdkn2a", "p16", "p16ink4a"), "正文写重症后急性期的肺细胞里这一项升高。这不是你的切点。"),
    ("IL32", ("il32",), "正文写重症后急性期的肺细胞里这一项升高。这不是你的切点。"),
    ("CXCL14", ("cxcl14",), "正文写重症后急性期的肺细胞里这一项升高。这不是你的切点。"),
    ("MMP10", ("mmp10",), "正文写重症后急性期的肺细胞里这一项升高。这不是你的切点。"),
    ("IL1B", ("il1b",), "正文写病毒测不到之后，这一项仍然维持。这不是你的切点。"),
    ("IL8", ("il8", "cxcl8"), "正文写病毒测不到之后，这一项仍然维持。这不是你的切点。"),
    ("IFNB1", ("ifnb", "ifnb1"), "正文写感染早期升高，随后下降。这不是你的切点。"),
    ("IL6", ("il6",), "正文写感染早期升高，随后下降。这不是你的切点。"),
    ("TNF", ("tnf", "tnfa"), "正文写感染早期升高，随后下降。这不是你的切点。"),
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
        .replace("β", "b")
        .replace("α", "a")
    )


def _headers(row):
    return {
        (key or "").strip().lower().replace(" ", "").replace("_", ""): (value or "").strip()
        for key, value in row.items()
        if key
    }


def evaluate(rows, age):
    del age
    found = {}
    for row in rows:
        keys = _headers(row)
        name = keys.get("name") or keys.get("item") or keys.get("gene") or keys.get("项目") or ""
        value = keys.get("value") or keys.get("结果") or keys.get("expression") or ""
        if name:
            found[norm(name)] = value
    items = [f"{name}。{sentence}" for name, sentence in DRUGS]
    med_names = [name for name, _sentence in DRUGS]
    for aliases in DRUG_ALIASES.values():
        med_names.extend(aliases)
    for display, aliases, sentence in MARKERS:
        med_names.append(display)
        med_names.extend(aliases)
        value = ""
        for alias in (display, *aliases):
            if norm(alias) in found:
                value = found[norm(alias)]
                break
        if value:
            items.append(f"{display}。你给的数是 {value}。{sentence}")
        else:
            items.append(f"{display}。这次没有这个数。{sentence}")
    intro = "这次只照录正文点名的衰老和炎症标志，不配权重。"
    can = "你交来的标志会带上正文里的方向。实验用的药名写在名单里，不是给你的剂量。"
    cannot = "不能计算衰老评分。正文没有给出系数列，也没有截距列。打开的补充信息 PDF 是图，不是系数表。"
    return intro, can, cannot, items, med_names
