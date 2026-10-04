BOUNDARY = (
    "这是研究复现意义上的个人读出，不是治疗建议。"
    "不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。"
    "体检不增删方法算出的名单。"
)
TITLE = "果蝇胰岛素样肽与节律"
HIDDEN_COHORT = 656


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

YOUNG_DAYS = 3
AGED_DAYS = 40
GENES = ("LKRSDH", "dilp2", "dilp3", "dilp5", "art4")
# Results. Overlap count of aged-mutant DEGs. Not a personal score.
AGED_OVERLAP_DEGS = 656
ALIASES = ()

def assess(age, values, bad):
    computed, missing, items = [], [], []
    if bad:
        missing.append("有测量行读不了，那些行没有进入名单。")
    days = _num(values, ("age_days", "日龄"))
    if days is None:
        items.append(("日龄窗口", "这次没有算。"))
        missing.append("缺果蝇日龄（age_days）。人的岁数不换算。正文的年轻对照是 3 日，年老对照是 40 日。")
    elif days == YOUNG_DAYS:
        computed.append("日龄是 3，对上正文的年轻对照。")
        items.append(("日龄窗口", "3 日，年轻对照。"))
    elif days == AGED_DAYS:
        computed.append("日龄是 40，对上正文的年老对照。")
        items.append(("日龄窗口", "40 日，年老对照。"))
    else:
        computed.append("这个日龄不是正文的 3 日或 40 日。")
        items.append(("日龄窗口", "不是 3 日或 40 日。"))
    for gene in GENES:
        raw = _raw(values, (gene,))
        if raw is None:
            items.append((gene, "这次没有这项测量。"))
        else:
            computed.append(f"{gene} 的测量是 {raw}。没有倍数列，不算上调或下调。")
            items.append((gene, f"测量是 {raw}。没有倍数列，不算上调或下调。"))
    missing.append("Supplementary Data 1 的差异倍数列这次没有下载，不用 0 填，也不判上调。")
    return computed, missing, items
