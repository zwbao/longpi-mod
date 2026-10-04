BOUNDARY = (
    "这是研究复现意义上的个人读出，不是治疗建议。"
    "不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。"
    "体检不增删方法算出的名单。"
)
TITLE = "面部皮肤的体细胞突变"
HIDDEN_COHORT = 13850


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

GENES = ("NOTCH1", "NOTCH2", "NOTCH3", "TP53", "FAT1")
# Results. Cohort summaries, not personal scores.
MUTATIONS_ALL = 13850
SBS_ALL = 10311
UK_PER_MB = 6.3
SG_PER_MB = 1.6
ALIASES = ()
YES = {"1", "yes", "y", "有", "mutant", "突变"}

def assess(age, values, bad):
    computed, missing, items = [], [], []
    if bad:
        missing.append("有测量行读不了，那些行没有进入名单。")
    country = _raw(values, ("country", "国家"))
    if country is not None:
        computed.append(f"国家记录是 {country}。两国供体的突变负荷均值不写在这里。")
        items.append(("国家", f"记录是 {country}。"))
    else:
        items.append(("国家", "这次没有国家记录。"))
    for gene in GENES:
        raw = _raw(values, (gene,))
        if raw is None:
            items.append((gene, "这次没有这项突变记录。"))
        elif raw.strip().lower() in YES:
            computed.append(f"{gene} 记为有。这不是风险分。")
            items.append((gene, "记为有。这不是风险分。"))
        else:
            computed.append(f"{gene} 的记录是 {raw}。没有按它计算风险。")
            items.append((gene, f"记录是 {raw}。没有按它计算风险。"))
    missing.append("正文没有把每人的突变负荷换成皮肤癌风险的系数列。")
    return computed, missing, items
