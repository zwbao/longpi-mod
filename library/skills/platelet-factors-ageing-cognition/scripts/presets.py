"""Schroer et al., Nature 2023. Named markers only. No PF4 cutoff and no weights."""

from __future__ import annotations

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

TITLE = "# 血小板因子与老年认知"

# Young plasma preparation DEG count in the main text. Stays out of the report.
PLASMA_DEGS = 605
FORBIDDEN = "605"
MUST = "PF4"
ABSENT = "ZZZNO"

SAMPLE_MEASUREMENTS = """name,value
PF4,3.2
Tnf,1.1
ZZZNO,9
"""

MARKERS = (
    ("PF4", ("pf4", "cxcl4", "plateletfactor4"), "正文写年轻小鼠和年轻健康人的制备物里这一项更高。图上没有印出数值切点，所以不分成高或低。"),
    ("TNF", ("tnf", "tnfa"), "给老年小鼠用血小板因子之后，海马和血浆里的这一项下降。这是小鼠实验的方向，不是你的切点。"),
    ("NFKB1", ("nfkb1",), "给老年小鼠用血小板因子之后，海马里的这一项下降。这是小鼠实验的方向，不是你的切点。"),
    ("IL1B", ("il1b",), "给老年小鼠用血小板因子之后，海马里的这一项下降。这是小鼠实验的方向，不是你的切点。"),
    ("C1QB", ("c1qb",), "给老年小鼠用血小板因子之后，海马里的这一项下降。这是小鼠实验的方向，不是你的切点。"),
    ("ITGAM", ("itgam", "cd11b"), "给老年小鼠用血小板因子之后，海马里的小胶质激活标志下降。这是小鼠实验的方向，不是你的切点。"),
    ("BDNF", ("bdnf",), "给老年小鼠用血小板因子之后，海马里的这一项升高。这是小鼠实验的方向，不是你的切点。"),
    ("NTF3", ("ntf3",), "给老年小鼠用血小板因子之后，海马里的这一项升高。这是小鼠实验的方向，不是你的切点。"),
    ("TMEM108", ("tmem108",), "给老年小鼠用血小板因子之后，海马里的这一项升高。这是小鼠实验的方向，不是你的切点。"),
    ("CCL2", ("ccl2",), "给老年小鼠用血小板因子之后，血浆里的这一项下降。这是小鼠实验的方向，不是你的切点。"),
    ("PPIA", ("ppia", "cypa"), "给老年小鼠用血小板因子之后，血浆里的这一项下降。这是小鼠实验的方向，不是你的切点。"),
    ("B2M", ("b2m",), "正文写血浆里的这一项没有跟着下降。这里只照录方向。"),
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
    items = []
    med_names = []
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
    intro = "这次只照录正文点名的血小板因子和炎症标志，不给它们配权重。"
    can = "你交来的标志会带上正文里的方向。没有交的数会写明这次没有这个数。"
    cannot = "不能把血小板因子分成高或低，因为图上没有年轻与年长的数值切点列。也不能算认知评分，因为没有系数列，也没有截距列。"
    return intro, can, cannot, items, med_names
