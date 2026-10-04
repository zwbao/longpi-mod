BOUNDARY = (
    "这是研究复现意义上的个人读出，不是治疗建议。"
    "不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。"
    "体检不增删方法算出的名单。"
)
TITLE = "早衰皮肤的碱基编辑"
HIDDEN_COHORT = "20.8"


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

# Abstract. Fraction of skin cells corrected in the mouse experiment. Not a personal score.
CORRECTED_LOW = "20.8"
CORRECTED_HIGH = "24.1"
MUTANT = {"t", "c>t", "c>t ", "mutant", "hgps", "突变", "progerin"}
WILD = {"c", "wildtype", "wild", "野生"}
ALIASES = ()

def assess(age, values, bad):
    computed, missing, items = [], [], []
    if bad:
        missing.append("有测量行读不了，那些行没有进入名单。")
    raw = _raw(values, ("lmna", "c1824", "基因型"))
    if raw is None:
        items.append(("LMNA c.1824C>T", "这次没有等位基因记录。"))
        missing.append("缺 LMNA c.1824 的等位记录。")
    else:
        token = raw.strip().lower().replace(" ", "")
        if token in MUTANT or token.replace(" ", "") in {"c>t"}:
            computed.append("等位记录对上正文要校正的早衰突变。")
            items.append(("LMNA c.1824C>T", "对上这个突变。"))
        elif token in WILD:
            computed.append("等位记录不是正文要校正的那个突变。")
            items.append(("LMNA c.1824C>T", "不是这个突变。"))
        else:
            computed.append(f"等位记录是 {raw}。读数对不上正文的两种写法，不算。")
            items.append(("LMNA c.1824C>T", "读数对不上，不算。"))
    missing.append("正文没有把校正细胞比例换成皮肤表型分数的系数列。小鼠实验的校正比例不写在这里。")
    return computed, missing, items
