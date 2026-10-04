BOUNDARY = (
    "这是研究复现意义上的个人读出，不是治疗建议。"
    "不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。"
    "体检不增删方法算出的名单。"
)
TITLE = "睑板腺的局部甾体合成"
HIDDEN_COHORT = 12


def _raw(values, keys):
    for key in keys:
        if key in values:
            return values[key]
        for have, raw in values.items():
            if have.lower() == key.lower():
                return raw
    return None


def _num(values, keys):
    raw = _raw(values, keys)
    if raw is None:
        return None
    try:
        return float(raw)
    except ValueError:
        return None

# Results, citing the Michaelis constants the paper prints for NAD+.
KM_HSD3B1 = 34
KM_HSD3B2 = 86
ALIASES = (
    ("nmn", "NMN"),
    ("nicotinamidemononucleotide", "NMN"),
    ("烟酰胺单核苷酸", "NMN"),
    ("nr", "NR"),
    ("nicotinamideriboside", "NR"),
    ("烟酰胺核糖", "NR"),
)

def _side(value, km, name):
    if value > km:
        return f"高于正文写的 {name} 米氏常数 {km:g}"
    if value < km:
        return f"低于正文写的 {name} 米氏常数 {km:g}"
    return f"等于正文写的 {name} 米氏常数 {km:g}"

def assess(age, values, bad):
    computed, missing, items = [], [], []
    if bad:
        missing.append("有测量行读不了，那些行没有进入名单。")
    nad = _num(values, ("nad_uM", "NAD"))
    if nad is None:
        items.append(("NAD", "这次没有算。"))
        missing.append("缺 NAD 浓度，单位是微摩尔（nad_uM）。")
    else:
        sentence = _side(nad, KM_HSD3B1, "HSD3B1") + "，" + _side(nad, KM_HSD3B2, "HSD3B2") + "。"
        computed.append(f"NAD 是 {nad:g} 微摩尔。{sentence}")
        items.append(("NAD", sentence))
    for gene in ("HSD3B1", "Hsd3b6"):
        raw = _raw(values, (gene,))
        if raw is None:
            items.append((gene, "这次没有这项测量。"))
        else:
            computed.append(f"{gene} 的测量是 {raw}。没有系数，不算干眼分数。")
            items.append((gene, f"测量是 {raw}。"))
    items.append(("NMN", "论文点了这个前体。没有个人滴眼剂量系数。"))
    items.append(("NR", "论文点了这个前体。没有个人滴眼剂量系数。"))
    missing.append("正文没有把 NAD 浓度换成泪膜或睑板腺面积的系数列。")
    return computed, missing, items
