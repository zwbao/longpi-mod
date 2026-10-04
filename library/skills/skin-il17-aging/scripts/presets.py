BOUNDARY = (
    "这是研究复现意义上的个人读出，不是治疗建议。"
    "不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。"
    "体检不增删方法算出的名单。"
)
TITLE = "淋巴来源白介素与皮肤老化"
HIDDEN_COHORT = 15


# Methods. Adult window, aged window, and the week neutralization starts.
ADULT_WEEKS = (17, 25)
AGED_WEEKS = (80, 90)
NEUTRALIZATION_START_WEEKS = 73
# Methods. Each antibody dose in micrograms. Cohort detail, not a personal score.
DOSE_UG_EACH = 105
GENES = ("Il17a", "Il17f", "Il17ra", "Il17rc")
ALIASES = (
    ("il17a", "Il17a"),
    ("il-17a", "Il17a"),
    ("17f3", "Il17a"),
    ("il17f", "Il17f"),
    ("il-17f", "Il17f"),
    ("mm17f8f5", "Il17f"),
    ("il17ra", "Il17ra"),
    ("il17rc", "Il17rc"),
)

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


def assess(age, values, bad):
    computed, missing, items = [], [], []
    if bad:
        missing.append("有测量行读不了，那些行没有进入名单。")
    weeks = _num(values, ("age_weeks", "周龄"))
    if weeks is None:
        missing.append("缺小鼠周龄（age_weeks）。人的实足年龄不换算成这个窗口。")
        items.append(("年龄窗口", "这次没有算。"))
    else:
        if ADULT_WEEKS[0] <= weeks <= ADULT_WEEKS[1]:
            label = "落在正文的成年窗口。"
        elif AGED_WEEKS[0] <= weeks <= AGED_WEEKS[1]:
            label = "落在正文的年老窗口。"
        elif weeks == NEUTRALIZATION_START_WEEKS:
            label = "对上开始中和注射的周龄。"
        else:
            label = "不在正文写下的成年窗口、年老窗口或开始中和的周龄。"
        computed.append(f"小鼠周龄 {weeks:g}。{label}")
        items.append(("年龄窗口", label))
    any_gene = False
    for gene in GENES:
        raw = _raw(values, (gene,))
        if raw is None:
            items.append((gene, "这次没有这个基因的测量。"))
        else:
            any_gene = True
            computed.append(f"{gene} 的测量是 {raw}。没有系数，不算高低。")
            items.append((gene, f"测量是 {raw}。没有系数，不算高低。"))
    if not any_gene:
        missing.append("Il17a、Il17f、Il17ra、Il17rc 都没有测量。正文没有把表达量换成皮肤年龄的系数列。")
    else:
        missing.append("即便给了表达量，正文也没有把它们换成皮肤年龄的系数列。")
    return computed, missing, items
